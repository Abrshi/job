import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../lib/logger';
import { generateNumericOtp, generateVerificationToken, hashVerificationCode, verifyCodeHash } from '../../utils/otp.util';
import { normalizePhoneNumber } from '../../utils/phone.util';
import { emailService } from '../email/email.service';
import { smsService } from '../sms/sms.service';
import { profileCompletionService } from '../profile/profile-completion.service';
import { VerificationType } from '@prisma/client';

const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

export class VerificationService {
  /**
   * Request email verification link and OTP.
   */
  async requestEmailVerification(userId: string): Promise<{ success: boolean; message: string; cooldownSeconds: number }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, isEmailVerified: true },
    });

    if (!user) {
      throw AppError.notFound('User account not found', 'USER_NOT_FOUND');
    }

    if (user.isEmailVerified) {
      return {
        success: true,
        message: 'Email is already verified.',
        cooldownSeconds: 0,
      };
    }

    const normalizedEmail = user.email.toLowerCase().trim();

    // Check rate limit / cooldown
    const latestCode = await prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        type: VerificationType.EMAIL_VERIFICATION,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (latestCode) {
      const elapsedMs = Date.now() - new Date(latestCode.createdAt).getTime();
      if (elapsedMs < RESEND_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000);
        throw AppError.tooManyRequests(
          `Please wait ${remainingSeconds} seconds before requesting a new verification email.`,
          'COOLDOWN_ACTIVE'
        );
      }
    }

    // Mark previous active codes as used
    await prisma.verificationCode.updateMany({
      where: {
        userId: user.id,
        type: VerificationType.EMAIL_VERIFICATION,
        isUsed: false,
      },
      data: { isUsed: true },
    });

    const otpCode = generateNumericOtp();
    const linkToken = generateVerificationToken();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

    // Save both the OTP code hash and the link token hash
    await prisma.verificationCode.createMany({
      data: [
        {
          userId: user.id,
          type: VerificationType.EMAIL_VERIFICATION,
          target: normalizedEmail,
          codeHash: hashVerificationCode(otpCode),
          expiresAt,
          maxAttempts: MAX_ATTEMPTS,
        },
        {
          userId: user.id,
          type: VerificationType.EMAIL_VERIFICATION,
          target: normalizedEmail,
          codeHash: hashVerificationCode(linkToken),
          expiresAt,
          maxAttempts: MAX_ATTEMPTS,
        },
      ],
    });

    // Send email asynchronously (non-blocking)
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined;
    emailService
      .sendVerificationEmail({
        to: normalizedEmail,
        recipientName: displayName,
        verificationToken: linkToken,
        verificationCode: otpCode,
        expiresInMinutes: 10,
      })
      .catch((err) => {
        logger.error(`[VerificationService] Background email send failed: ${err.message}`);
      });

    return {
      success: true,
      message: 'Verification email has been sent. Please check your inbox.',
      cooldownSeconds: 60,
    };
  }

  /**
   * Resend email verification by email address (for unauthenticated or unverified users).
   */
  async resendEmailVerificationByEmail(rawEmail: string): Promise<{ success: boolean; message: string; cooldownSeconds: number }> {
    const normalizedEmail = (rawEmail || '').toLowerCase().trim();
    if (!normalizedEmail) {
      throw AppError.badRequest('Email address is required.', 'EMAIL_REQUIRED');
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, isEmailVerified: true },
    });

    // Prevent email enumeration: return generic success even if user not found
    if (!user) {
      return {
        success: true,
        message: 'If an account exists with that email, a verification link has been sent.',
        cooldownSeconds: 60,
      };
    }

    if (user.isEmailVerified) {
      return {
        success: true,
        message: 'This email is already verified.',
        cooldownSeconds: 0,
      };
    }

    return this.requestEmailVerification(user.id);
  }

  /**
   * Verify email using either token (from link) or 6-digit OTP code.
   */
  async verifyEmail(params: { token?: string; code?: string; email?: string }): Promise<{ success: boolean; message: string }> {
    const { token, code, email } = params;

    if (!token && !code) {
      throw AppError.badRequest('Verification token or 6-digit code is required.', 'TOKEN_OR_CODE_REQUIRED');
    }

    const rawInput = token ? token.trim() : (code || '').trim();
    const hashed = hashVerificationCode(rawInput);

    const whereClause: any = {
      type: VerificationType.EMAIL_VERIFICATION,
      codeHash: hashed,
      isUsed: false,
    };

    if (email) {
      whereClause.target = email.toLowerCase().trim();
    }

    const record = await prisma.verificationCode.findFirst({
      where: whereClause,
      include: { user: true },
    });

    if (!record) {
      // If code was provided, check if attempts can be incremented on active target
      if (email && code) {
        const targetActive = await prisma.verificationCode.findFirst({
          where: {
            target: email.toLowerCase().trim(),
            type: VerificationType.EMAIL_VERIFICATION,
            isUsed: false,
            expiresAt: { gt: new Date() },
          },
        });
        if (targetActive) {
          const updated = await prisma.verificationCode.update({
            where: { id: targetActive.id },
            data: { attempts: { increment: 1 } },
          });
          if (updated.attempts >= updated.maxAttempts) {
            await prisma.verificationCode.update({
              where: { id: targetActive.id },
              data: { isUsed: true },
            });
            throw AppError.badRequest(
              'Maximum verification attempts exceeded. Please request a new verification code.',
              'MAX_ATTEMPTS_EXCEEDED'
            );
          }
        }
      }
      throw AppError.badRequest('Invalid or expired verification link/code.', 'INVALID_OR_EXPIRED_CODE');
    }

    // Check expiration
    if (new Date() > new Date(record.expiresAt)) {
      await prisma.verificationCode.update({
        where: { id: record.id },
        data: { isUsed: true },
      });
      throw AppError.badRequest('Verification code has expired. Please request a new one.', 'CODE_EXPIRED');
    }

    // Check attempts
    if (record.attempts >= record.maxAttempts) {
      await prisma.verificationCode.update({
        where: { id: record.id },
        data: { isUsed: true },
      });
      throw AppError.badRequest(
        'Maximum verification attempts exceeded. Please request a new verification code.',
        'MAX_ATTEMPTS_EXCEEDED'
      );
    }

    // Mark verified
    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: {
          isEmailVerified: true,
          emailVerifiedAt: now,
        },
      }),
      prisma.verificationCode.updateMany({
        where: {
          userId: record.userId,
          type: VerificationType.EMAIL_VERIFICATION,
        },
        data: {
          isUsed: true,
          consumedAt: now,
        },
      }),
    ]);

    // Recalculate profile completion
    await this.refreshProfileCompletion(record.userId);

    logger.info(`[VerificationService] User ${record.userId} verified email successfully.`);
    return {
      success: true,
      message: 'Email verified successfully!',
    };
  }

  /**
   * Request phone verification SMS with 6-digit OTP.
   */
  async requestPhoneVerification(userId: string, rawPhone: string): Promise<{
    success: boolean;
    message: string;
    phoneNumber: string;
    cooldownSeconds: number;
    gatewayStatus?: string;
  }> {
    const normalized = normalizePhoneNumber(rawPhone);
    if (!normalized.isValid || !normalized.e164) {
      throw AppError.badRequest(
        normalized.error || 'Please provide a valid phone number (e.g., +251 91 123 4567 or 0911234567).',
        'INVALID_PHONE_FORMAT'
      );
    }

    const e164 = normalized.e164;

    // Check rate limit / cooldown
    const latestCode = await prisma.verificationCode.findFirst({
      where: {
        userId,
        type: VerificationType.PHONE_VERIFICATION,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (latestCode) {
      const elapsedMs = Date.now() - new Date(latestCode.createdAt).getTime();
      if (elapsedMs < RESEND_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000);
        throw AppError.tooManyRequests(
          `Please wait ${remainingSeconds} seconds before requesting another SMS code.`,
          'COOLDOWN_ACTIVE'
        );
      }
    }

    // Mark previous active codes as used
    await prisma.verificationCode.updateMany({
      where: {
        userId,
        type: VerificationType.PHONE_VERIFICATION,
        isUsed: false,
      },
      data: { isUsed: true },
    });

    const otpCode = generateNumericOtp();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

    await prisma.verificationCode.create({
      data: {
        userId,
        type: VerificationType.PHONE_VERIFICATION,
        target: e164,
        codeHash: hashVerificationCode(otpCode),
        expiresAt,
        maxAttempts: MAX_ATTEMPTS,
      },
    });

    // Send SMS via SMSBridge
    const smsResult = await smsService.sendVerificationOtp(e164, otpCode, 10);

    return {
      success: true,
      message: smsResult.success
        ? `Verification SMS code sent to ${e164}.`
        : `Verification code generated. Gateway status: ${smsResult.error || smsResult.status || 'queued'}.`,
      phoneNumber: e164,
      cooldownSeconds: 60,
      gatewayStatus: smsResult.status,
    };
  }

  /**
   * Confirm phone verification using 6-digit OTP code.
   */
  async confirmPhoneVerification(userId: string, code: string): Promise<{ success: boolean; message: string; phoneNumber: string }> {
    const trimmedCode = (code || '').trim();
    if (!trimmedCode) {
      throw AppError.badRequest('Verification code is required.', 'CODE_REQUIRED');
    }

    const record = await prisma.verificationCode.findFirst({
      where: {
        userId,
        type: VerificationType.PHONE_VERIFICATION,
        isUsed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw AppError.badRequest('No pending phone verification found. Please request a new code.', 'NO_PENDING_VERIFICATION');
    }

    if (new Date() > new Date(record.expiresAt)) {
      await prisma.verificationCode.update({
        where: { id: record.id },
        data: { isUsed: true },
      });
      throw AppError.badRequest('Verification code has expired. Please request a new one.', 'CODE_EXPIRED');
    }

    if (record.attempts >= record.maxAttempts) {
      await prisma.verificationCode.update({
        where: { id: record.id },
        data: { isUsed: true },
      });
      throw AppError.badRequest('Maximum attempts exceeded. Please request a new verification code.', 'MAX_ATTEMPTS_EXCEEDED');
    }

    const isMatch = verifyCodeHash(trimmedCode, record.codeHash);
    if (!isMatch) {
      const updated = await prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });

      const remaining = updated.maxAttempts - updated.attempts;
      if (remaining <= 0) {
        await prisma.verificationCode.update({
          where: { id: record.id },
          data: { isUsed: true },
        });
        throw AppError.badRequest('Maximum attempts exceeded. Please request a new code.', 'MAX_ATTEMPTS_EXCEEDED');
      }

      throw AppError.badRequest(`Invalid verification code. ${remaining} attempts remaining.`, 'INVALID_CODE');
    }

    // Mark used and verify profile
    const now = new Date();
    await prisma.$transaction([
      prisma.verificationCode.update({
        where: { id: record.id },
        data: {
          isUsed: true,
          consumedAt: now,
        },
      }),
      prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          phoneNumber: record.target,
          isPhoneVerified: true,
          phoneVerifiedAt: now,
        },
        update: {
          phoneNumber: record.target,
          isPhoneVerified: true,
          phoneVerifiedAt: now,
        },
      }),
    ]);

    // Recalculate profile completion
    await this.refreshProfileCompletion(userId);

    logger.info(`[VerificationService] User ${userId} successfully verified phone number ${record.target}.`);
    return {
      success: true,
      message: 'Phone number verified successfully!',
      phoneNumber: record.target,
    };
  }

  /**
   * Get verification status for a user.
   */
  async getVerificationStatus(userId: string): Promise<{
    email: string;
    isEmailVerified: boolean;
    emailVerifiedAt: Date | null;
    phoneNumber: string | null;
    isPhoneVerified: boolean;
    phoneVerifiedAt: Date | null;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw AppError.notFound('User not found', 'USER_NOT_FOUND');
    }

    return {
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneNumber: user.profile?.phoneNumber || null,
      isPhoneVerified: Boolean(user.profile?.isPhoneVerified),
      phoneVerifiedAt: user.profile?.phoneVerifiedAt || null,
    };
  }

  /**
   * Helper to refresh profile completion percentage in the database.
   */
  private async refreshProfileCompletion(userId: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: {
            include: {
              experiences: true,
              educations: true,
              certifications: true,
              projects: true,
              skills: true,
              languages: true,
              achievements: true,
            },
          },
        },
      });

      if (!user?.profile) return;

      const completion = profileCompletionService.calculateCompletion({
        ...user.profile,
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
        },
      });

      await prisma.userProfile.update({
        where: { id: user.profile.id },
        data: { completionPercentage: completion.percentage },
      });
    } catch (err: any) {
      logger.error(`[VerificationService] Failed to recalculate completion for user ${userId}: ${err.message}`);
    }
  }
}

export const verificationService = new VerificationService();
