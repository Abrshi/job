import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { Prisma } from '@prisma/client';

export interface AuditLogParams {
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

export async function logAdminAction(params: AuditLogParams): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId: params.adminId,
        adminEmail: params.adminEmail,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId || null,
        details: params.details ? (params.details as Prisma.InputJsonValue) : Prisma.DbNull,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (err: unknown) {
    logger.error('Failed to persist admin audit log:', (err as Error).message);
  }
}
