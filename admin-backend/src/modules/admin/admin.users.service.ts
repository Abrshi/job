import argon2 from 'argon2';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { logAdminAction } from './admin.audit';
import { Prisma, Role } from '@prisma/client';

export interface AdminUserQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
  isEmailVerified?: boolean;
}

export class AdminUsersService {
  async getUsers(options: AdminUserQueryOptions) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (options.search) {
      const q = options.search.trim();
      where.OR = [
        { email: { contains: q } },
        { firstName: { contains: q } },
        { lastName: { contains: q } },
      ];
    }

    if (options.role) where.role = options.role;
    if (options.isActive !== undefined) where.isActive = options.isActive;
    if (options.isEmailVerified !== undefined) where.isEmailVerified = options.isEmailVerified;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          profile: {
            select: {
              headline: true,
              phoneNumber: true,
              isPhoneVerified: true,
              city: true,
              country: true,
            },
          },
          _count: {
            select: {
              applications: true,
              savedJobs: true,
              documents: true,
              savedSearches: true,
              refreshSessions: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        _count: {
          select: {
            applications: true,
            savedJobs: true,
            documents: true,
            savedSearches: true,
            refreshSessions: true,
          },
        },
      },
    });

    if (!user) {
      throw AppError.notFound(`User with id '${id}' not found`, 'USER_NOT_FOUND');
    }

    return user;
  }

  async getUserActivity(id: string) {
    const user = await this.getUserById(id);

    const [applications, savedJobs, documents, savedSearches] = await Promise.all([
      prisma.jobApplication.findMany({
        where: { userId: id },
        orderBy: { appliedAt: 'desc' },
        take: 20,
        include: {
          job: {
            select: {
              id: true,
              normalizedTitle: true,
              companyName: true,
              status: true,
              city: true,
              country: true,
            },
          },
        },
      }),
      prisma.savedJob.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          job: {
            select: {
              id: true,
              normalizedTitle: true,
              companyName: true,
              status: true,
            },
          },
        },
      }),
      prisma.userDocument.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          originalFilename: true,
          fileSize: true,
          mimeType: true,
          processingStatus: true,
          extractionStatus: true,
          createdAt: true,
        },
      }),
      prisma.savedSearch.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          name: true,
          keywords: true,
          location: true,
          categorySlug: true,
          frequency: true,
          isActive: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      user,
      activitySummary: {
        totalApplications: applications.length,
        totalSavedJobs: savedJobs.length,
        totalDocuments: documents.length,
        totalSavedSearches: savedSearches.length,
        lastLoginAt: user.lastLoginAt,
        registeredAt: user.createdAt,
      },
      applications,
      savedJobs,
      documents,
      savedSearches,
    };
  }

  async createUser(
    data: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
      role?: Role;
      isActive?: boolean;
    },
    admin: { id: string; email: string },
    ipAddress?: string
  ) {
    const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() } });
    if (existing) {
      throw AppError.conflict('A user with this email address already exists', 'EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await argon2.hash(data.password, { type: argon2.argon2id });

    const newUser = await prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        passwordHash,
        firstName: data.firstName?.trim() || null,
        lastName: data.lastName?.trim() || null,
        role: data.role || 'CANDIDATE',
        isActive: data.isActive !== undefined ? data.isActive : true,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            displayName: [data.firstName, data.lastName].filter(Boolean).join(' ') || data.email,
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_CREATED',
      targetType: 'USER',
      targetId: newUser.id,
      details: { email: newUser.email, role: newUser.role },
      ipAddress,
    });

    return newUser;
  }

  async updateUser(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      role?: Role;
      isActive?: boolean;
      password?: string;
    },
    admin: { id: string; email: string },
    ipAddress?: string
  ) {
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      throw AppError.notFound(`User with id '${id}' not found`, 'USER_NOT_FOUND');
    }

    // Role protection checks
    if (data.role && data.role !== targetUser.role) {
      if (id === admin.id && data.role !== 'ADMIN') {
        throw AppError.badRequest('Administrators cannot remove their own administrator role', 'SELF_DEMOTION_PREVENTED');
      }
      if (targetUser.role === 'ADMIN' && data.role !== 'ADMIN') {
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
        if (adminCount <= 1) {
          throw AppError.badRequest('Cannot demote the last system administrator', 'LAST_ADMIN_PROTECTED');
        }
      }
    }

    // Status protection checks
    if (data.isActive !== undefined && data.isActive !== targetUser.isActive) {
      if (id === admin.id && !data.isActive) {
        throw AppError.badRequest('Administrators cannot deactivate their own account', 'SELF_DEACTIVATION_PREVENTED');
      }
      if (targetUser.role === 'ADMIN' && !data.isActive) {
        const activeAdminCount = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
        if (activeAdminCount <= 1) {
          throw AppError.badRequest('Cannot deactivate the last active administrator', 'LAST_ADMIN_PROTECTED');
        }
      }
    }

    const updateData: any = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) updateData.email = data.email.toLowerCase().trim();
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (data.password && data.password.trim().length >= 6) {
      updateData.passwordHash = await argon2.hash(data.password.trim(), { type: argon2.argon2id });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        updatedAt: true,
      },
    });

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_UPDATED',
      targetType: 'USER',
      targetId: id,
      details: { updatedFields: Object.keys(updateData), targetEmail: updated.email },
      ipAddress,
    });

    return updated;
  }

  async deleteUser(
    id: string,
    admin: { id: string; email: string },
    ipAddress?: string
  ) {
    if (id === admin.id) {
      throw AppError.badRequest('Administrators cannot delete their own account', 'SELF_DELETION_PREVENTED');
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      throw AppError.notFound(`User with id '${id}' not found`, 'USER_NOT_FOUND');
    }

    if (targetUser.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        throw AppError.badRequest('Cannot delete the last system administrator', 'LAST_ADMIN_PROTECTED');
      }
    }

    await prisma.user.delete({ where: { id } });

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_DELETED',
      targetType: 'USER',
      targetId: id,
      details: { targetEmail: targetUser.email, role: targetUser.role },
      ipAddress,
    });

    return { deleted: true };
  }

  async getGlobalActivity(limit = 30) {
    const [recentApplications, recentUsers, recentDocuments] = await Promise.all([
      prisma.jobApplication.findMany({
        take: limit,
        orderBy: { appliedAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          job: { select: { id: true, normalizedTitle: true, companyName: true } },
        },
      }),
      prisma.user.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
      }),
      prisma.userDocument.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    // Synthesize into a chronological activity feed
    const events: any[] = [];

    recentApplications.forEach((app) => {
      const jobTitle = app.job?.normalizedTitle || (app as any).jobTitle || 'Job Application';
      const company = app.job?.companyName || (app as any).companyName || 'Company';
      events.push({
        id: `app-${app.id}`,
        type: 'JOB_APPLICATION',
        title: `Applied for ${jobTitle}`,
        subtitle: `at ${company}`,
        timestamp: app.appliedAt,
        user: { id: app.user.id, email: app.user.email, name: [app.user.firstName, app.user.lastName].filter(Boolean).join(' ') },
        status: app.status,
      });
    });

    recentUsers.forEach((u) => {
      events.push({
        id: `user-${u.id}`,
        type: 'USER_REGISTERED',
        title: `New ${u.role.toLowerCase()} account created`,
        subtitle: u.email,
        timestamp: u.createdAt,
        user: { id: u.id, email: u.email, name: [u.firstName, u.lastName].filter(Boolean).join(' ') },
        status: 'SUCCESS',
      });
    });

    recentDocuments.forEach((doc) => {
      events.push({
        id: `doc-${doc.id}`,
        type: 'DOCUMENT_UPLOADED',
        title: `Uploaded document "${doc.originalFilename}"`,
        subtitle: `Status: ${doc.processingStatus}`,
        timestamp: doc.createdAt,
        user: { id: doc.user.id, email: doc.user.email, name: [doc.user.firstName, doc.user.lastName].filter(Boolean).join(' ') },
        status: doc.processingStatus,
      });
    });

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return events.slice(0, limit);
  }

  async updateUserStatus(
    id: string,
    isActive: boolean,
    admin: { id: string; email: string },
    ipAddress?: string
  ) {
    if (id === admin.id && !isActive) {
      throw AppError.badRequest(
        'Administrators cannot deactivate their own account',
        'SELF_DEACTIVATION_PREVENTED'
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      throw AppError.notFound(`User with id '${id}' not found`, 'USER_NOT_FOUND');
    }

    // Protect last active administrator
    if (targetUser.role === 'ADMIN' && !isActive) {
      const activeAdminCount = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true },
      });
      if (activeAdminCount <= 1) {
        throw AppError.badRequest(
          'Cannot deactivate the last active administrator',
          'LAST_ADMIN_PROTECTED'
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        updatedAt: true,
      },
    });

    // If deactivated, revoke all active sessions
    if (!isActive) {
      await prisma.refreshSession.updateMany({
        where: { userId: id, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_STATUS_CHANGE',
      targetType: 'USER',
      targetId: id,
      details: { previousStatus: targetUser.isActive, newStatus: isActive, targetEmail: targetUser.email },
      ipAddress,
    });

    return updated;
  }

  async updateUserRole(
    id: string,
    role: Role,
    admin: { id: string; email: string },
    ipAddress?: string
  ) {
    if (id === admin.id && role !== 'ADMIN') {
      throw AppError.badRequest(
        'Administrators cannot remove their own administrator role',
        'SELF_DEMOTION_PREVENTED'
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      throw AppError.notFound(`User with id '${id}' not found`, 'USER_NOT_FOUND');
    }

    // Protect last administrator
    if (targetUser.role === 'ADMIN' && role !== 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' },
      });
      if (adminCount <= 1) {
        throw AppError.badRequest(
          'Cannot remove the last system administrator',
          'LAST_ADMIN_PROTECTED'
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        updatedAt: true,
      },
    });

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_ROLE_CHANGE',
      targetType: 'USER',
      targetId: id,
      details: { previousRole: targetUser.role, newRole: role, targetEmail: targetUser.email },
      ipAddress,
    });

    return updated;
  }
}

export const adminUsersService = new AdminUsersService();
