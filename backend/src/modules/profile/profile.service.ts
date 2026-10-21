import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { UpdateProfileInput } from './profile.validation';
import { Prisma } from '@prisma/client';

export class ProfileService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        profile: true,
      },
    });

    if (!user) {
      throw AppError.notFound('User account not found', 'USER_NOT_FOUND');
    }

    // Ensure profile row exists
    let profile = user.profile;
    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          userId,
          displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
        },
      });
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      displayName: profile.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
      headline: profile.headline,
      country: profile.country,
      city: profile.city,
      preferredWorkArrangement: profile.preferredWorkArrangement,
      preferredEmploymentType: profile.preferredEmploymentType,
      preferredExperienceLevel: profile.preferredExperienceLevel,
      minSalary: profile.minSalary ? Number(profile.minSalary) : null,
      salaryCurrency: profile.salaryCurrency || 'ETB',
      preferredCategories: (profile.preferredCategories as string[]) || [],
      preferredLocations: (profile.preferredLocations as string[]) || [],
      updatedAt: profile.updatedAt,
    };
  }

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw AppError.notFound('User account not found', 'USER_NOT_FOUND');
    }

    // 1. Update basic user details if provided
    const userUpdate: Prisma.UserUpdateInput = {};
    if (data.firstName !== undefined) userUpdate.firstName = data.firstName;
    if (data.lastName !== undefined) userUpdate.lastName = data.lastName;

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: userUpdate,
      });
    }

    // 2. Prepare profile upsert payload
    const profileData: Prisma.UserProfileUpdateInput = {};
    if (data.displayName !== undefined) profileData.displayName = data.displayName;
    if (data.headline !== undefined) profileData.headline = data.headline;
    if (data.country !== undefined) profileData.country = data.country;
    if (data.city !== undefined) profileData.city = data.city;
    if (data.preferredWorkArrangement !== undefined) {
      profileData.preferredWorkArrangement = data.preferredWorkArrangement;
    }
    if (data.preferredEmploymentType !== undefined) {
      profileData.preferredEmploymentType = data.preferredEmploymentType;
    }
    if (data.preferredExperienceLevel !== undefined) {
      profileData.preferredExperienceLevel = data.preferredExperienceLevel;
    }
    if (data.minSalary !== undefined) {
      profileData.minSalary = data.minSalary !== null ? new Prisma.Decimal(data.minSalary) : null;
    }
    if (data.salaryCurrency !== undefined) {
      profileData.salaryCurrency = data.salaryCurrency;
    }
    if (data.preferredCategories !== undefined) {
      profileData.preferredCategories = data.preferredCategories
        ? (data.preferredCategories as Prisma.InputJsonValue)
        : Prisma.DbNull;
    }
    if (data.preferredLocations !== undefined) {
      profileData.preferredLocations = data.preferredLocations
        ? (data.preferredLocations as Prisma.InputJsonValue)
        : Prisma.DbNull;
    }

    await prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: data.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
        headline: data.headline,
        country: data.country,
        city: data.city,
        preferredWorkArrangement: data.preferredWorkArrangement,
        preferredEmploymentType: data.preferredEmploymentType,
        preferredExperienceLevel: data.preferredExperienceLevel,
        minSalary: data.minSalary !== null && data.minSalary !== undefined ? new Prisma.Decimal(data.minSalary) : null,
        salaryCurrency: data.salaryCurrency || 'ETB',
        preferredCategories: data.preferredCategories ? (data.preferredCategories as Prisma.InputJsonValue) : Prisma.DbNull,
        preferredLocations: data.preferredLocations ? (data.preferredLocations as Prisma.InputJsonValue) : Prisma.DbNull,
      },
      update: profileData,
    });

    return this.getProfile(userId);
  }
}

export const profileService = new ProfileService();
