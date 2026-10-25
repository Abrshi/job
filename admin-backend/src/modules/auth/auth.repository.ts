import { prisma } from '../../lib/prisma';
import { RegisterDTO } from './auth.types';

export class AuthRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { profile: { select: { avatarUrl: true } } },
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { profile: { select: { avatarUrl: true } } },
    });
  }

  async createUser(data: RegisterDTO & { passwordHash: string }) {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'CANDIDATE',
      },
    });
  }

  async createSession(userId: string, tokenHash: string, expiresAt: Date) {
    return prisma.refreshSession.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findSessionByTokenHash(tokenHash: string) {
    return prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  async revokeSession(id: string) {
    return prisma.refreshSession.update({
      where: { id },
      data: { isRevoked: true },
    });
  }

  async revokeAllUserSessions(userId: string) {
    return prisma.refreshSession.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }
}

export const authRepository = new AuthRepository();

