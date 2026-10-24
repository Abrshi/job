import argon2 from 'argon2';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error-handler';
import { authRepository, AuthRepository } from './auth.repository';
import { AuthTokens, AuthUserPayload, LoginDTO, RegisterDTO, UserResponse } from './auth.types';
import { verificationService } from '../verification/verification.service';
import { logger } from '../../lib/logger';

export class AuthService {
  constructor(private readonly repo: AuthRepository = authRepository) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateTokens(payload: AuthUserPayload): AuthTokens {
    const accessOptions: SignOptions = {
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as unknown as SignOptions['expiresIn'],
    };
    const refreshOptions: SignOptions = {
      expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as unknown as SignOptions['expiresIn'],
    };

    const accessToken = jwt.sign(payload, env.ACCESS_TOKEN_SECRET, accessOptions);
    const refreshToken = jwt.sign({ userId: payload.userId }, env.REFRESH_TOKEN_SECRET, refreshOptions);

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDTO): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) {
      throw AppError.conflict('Email is already registered', 'EMAIL_ALREADY_EXISTS', [
        { field: 'email', message: 'Email is already registered' },
      ]);
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const user = await this.repo.createUser({
      ...dto,
      passwordHash,
    });

    const tokens = this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Store hashed refresh token in database (never raw tokens)
    const tokenHash = this.hashToken(tokens.refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.repo.createSession(user.id, tokenHash, expiresAt);

    // Automatically dispatch email verification in background
    verificationService.requestEmailVerification(user.id).catch((err) => {
      logger.error(`[AuthService] Auto-dispatch verification email failed: ${err.message}`);
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        avatarUrl: (user as any).profile?.avatarUrl || null,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  async login(dto: LoginDTO): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    const user = await this.repo.findByEmail(dto.email);
    if (!user) {
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const isMatch = await argon2.verify(user.passwordHash, dto.password);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const tokens = this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const tokenHash = this.hashToken(tokens.refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.repo.createSession(user.id, tokenHash, expiresAt);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        avatarUrl: (user as any).profile?.avatarUrl || null,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET);
    } catch {
      throw AppError.unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const tokenHash = this.hashToken(refreshToken);
    const session = await this.repo.findSessionByTokenHash(tokenHash);

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      throw AppError.unauthorized('Refresh token is invalid or has been revoked', 'INVALID_REFRESH_TOKEN');
    }

    // Revoke old session (Rotation)
    await this.repo.revokeSession(session.id);

    const user = session.user;
    const tokens = this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Store new rotated refresh session
    const newTokenHash = this.hashToken(tokens.refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.repo.createSession(user.id, newTokenHash, expiresAt);

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.repo.findSessionByTokenHash(tokenHash);
    if (session) {
      await this.repo.revokeSession(session.id);
    }
  }

  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found', 'USER_NOT_FOUND');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      avatarUrl: (user as any).profile?.avatarUrl || null,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();

