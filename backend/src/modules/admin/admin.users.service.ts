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
          _count: {
            select: { refreshSessions: true },
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
        _count: {
          select: { refreshSessions: true },
        },
      },
    });

    if (!user) {
      throw AppError.notFound(`User with id '${id}' not found`, 'USER_NOT_FOUND');
    }

    return user;
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
