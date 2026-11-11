import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error-handler';
import { logAdminAction } from '../admin/admin.audit';
import { Prisma, TelegramMessageStatus } from '@prisma/client';

export interface AdminUserContext {
  id: string;
  email: string;
  role?: string;
  ipAddress?: string;
}

export interface RegisterChannelInput {
  identifier: string;
  title?: string;
  telegramChannelId?: string;
  authorizationRecord: string;
  explicitConsentConfirmation: boolean;
  isActive?: boolean;
}

export interface UpdateChannelInput {
  title?: string;
  username?: string;
  authorizationRecord?: string;
  isActive?: boolean;
  isAuthorized?: boolean;
}

export class TelegramChannelsService {
  /**
   * Helper to normalize a public link, @username, or numeric ID into structured channel keys
   */
  normalizeIdentifier(rawIdentifier: string): { username?: string; channelId?: string } {
    let clean = rawIdentifier.trim();

    // Remove URL prefixes like https://t.me/ or t.me/
    clean = clean.replace(/^(https?:\/\/)?(www\.)?t\.me\//i, '').replace(/^\/+/, '');
    // Remove leading @
    clean = clean.replace(/^@/, '');

    // Check if numeric or channel ID with -100 prefix
    if (/^-?\d+$/.test(clean)) {
      return { channelId: clean };
    }

    return { username: clean.toLowerCase() };
  }

  /**
   * Send dynamic synchronization signal to the independent Telegram worker
   */
  async notifyWorkerSync(): Promise<boolean> {
    try {
      const url = `${env.TELEGRAM_WORKER_URL}/api/v1/worker/sync`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.TELEGRAM_INTERNAL_API_SECRET}`,
        },
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        logger.info('[TelegramChannelsService] Notified Telegram worker of channel changes.');
        return true;
      } else {
        logger.warn(`[TelegramChannelsService] Telegram worker returned HTTP ${response.status} on sync signal.`);
        return false;
      }
    } catch (err: unknown) {
      logger.warn(`[TelegramChannelsService] Could not reach Telegram worker for immediate sync (${(err as Error).message}). Worker will catch up on periodic interval.`);
      return false;
    }
  }

  /**
   * List registered channels with filtering and pagination
   */
  async listChannels(options: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'all' | 'active' | 'paused' | 'unauthorized';
  } = {}): Promise<{ channels: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.TelegramChannelWhereInput = {};

    if (options.status === 'active') {
      where.isActive = true;
      where.isAuthorized = true;
    } else if (options.status === 'paused') {
      where.isActive = false;
      where.isAuthorized = true;
    } else if (options.status === 'unauthorized') {
      where.isAuthorized = false;
    }

    if (options.search) {
      const q = options.search.trim();
      where.OR = [
        { title: { contains: q } },
        { username: { contains: q } },
        { telegramChannelId: { contains: q } },
      ];
    }

    const [total, channels] = await Promise.all([
      prisma.telegramChannel.count({ where }),
      prisma.telegramChannel.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isActive: 'desc' }, { lastEventAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          _count: {
            select: { messages: true },
          },
        },
      }),
    ]);

    return { channels, total, page, limit };
  }

  /**
   * Get channel by ID with message breakdown and recent events
   */
  async getChannelById(id: string): Promise<any> {
    const channel = await prisma.telegramChannel.findUnique({
      where: { id },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    if (!channel) {
      throw AppError.notFound(`Telegram channel with ID '${id}' not found.`);
    }

    // Message status breakdown
    const [processed, duplicate, failed, pending, ignored, recentMessages] = await Promise.all([
      prisma.telegramMessage.count({ where: { channelId: id, processingStatus: TelegramMessageStatus.PROCESSED } }),
      prisma.telegramMessage.count({ where: { channelId: id, processingStatus: TelegramMessageStatus.DUPLICATE } }),
      prisma.telegramMessage.count({ where: { channelId: id, processingStatus: TelegramMessageStatus.FAILED } }),
      prisma.telegramMessage.count({ where: { channelId: id, processingStatus: TelegramMessageStatus.PENDING } }),
      prisma.telegramMessage.count({ where: { channelId: id, processingStatus: TelegramMessageStatus.IGNORED } }),
      prisma.telegramMessage.findMany({
        where: { channelId: id },
        take: 10,
        orderBy: { detectedAt: 'desc' },
        include: {
          job: {
            select: { id: true, normalizedTitle: true, companyName: true, status: true },
          },
        },
      }),
    ]);

    return {
      channel,
      metrics: {
        total: channel._count.messages,
        processed,
        duplicate,
        failed,
        pending,
        ignored,
      },
      recentMessages,
    };
  }

  /**
   * Register a new authorized Telegram channel
   */
  async registerChannel(dto: RegisterChannelInput, adminUser: AdminUserContext): Promise<any> {
    if (!dto.explicitConsentConfirmation) {
      throw AppError.badRequest(
        'Explicit confirmation is required. You must certify that the channel owner has authorized data collection.',
        'MISSING_EXPLICIT_AUTHORIZATION'
      );
    }

    if (!dto.authorizationRecord || dto.authorizationRecord.trim().length < 10) {
      throw AppError.badRequest(
        'Documented authorization reference (contract, written consent reference, or agreement) is required.',
        'INSUFFICIENT_AUTHORIZATION_RECORD'
      );
    }

    const { username, channelId: parsedId } = this.normalizeIdentifier(dto.identifier);

    // Determine canonical Telegram ID
    let telegramChannelId = dto.telegramChannelId?.trim() || parsedId;
    let resolvedTitle = dto.title?.trim();

    // If no numeric Telegram channel ID was provided, attempt live resolution via worker
    if (!telegramChannelId && username) {
      try {
        const verifyRes = await fetch(`${env.TELEGRAM_WORKER_URL}/api/v1/worker/verify-channel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.TELEGRAM_INTERNAL_API_SECRET}`,
          },
          body: JSON.stringify({ identifier: username }),
          signal: AbortSignal.timeout(3000),
        });

        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (verifyData.accessible && verifyData.channel?.id) {
            telegramChannelId = `-100${verifyData.channel.id}`;
            if (!resolvedTitle && verifyData.channel.title) {
              resolvedTitle = verifyData.channel.title;
            }
          }
        }
      } catch (err) {
        // Fall back gracefully if worker is busy or starting
      }
    }

    if (!telegramChannelId) {
      telegramChannelId = username ? `user_${username}` : `channel_${Date.now()}`;
    }

    const existing = await prisma.telegramChannel.findFirst({
      where: {
        OR: [
          { telegramChannelId },
          ...(username ? [{ username: username.toLowerCase() }] : []),
        ],
      },
    });

    if (existing) {
      throw AppError.conflict(
        `A Telegram channel matching '${dto.identifier}' is already registered (${existing.title}).`,
        'CHANNEL_ALREADY_EXISTS'
      );
    }

    const title = resolvedTitle || dto.title?.trim() || (username ? `@${username}` : `Telegram Channel ${telegramChannelId}`);

    const channel = await prisma.telegramChannel.create({
      data: {
        telegramChannelId,
        username: username || null,
        title,
        isActive: dto.isActive !== false,
        isAuthorized: true,
        authorizationRecord: dto.authorizationRecord.trim(),
      },
    });

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'REGISTER_TELEGRAM_CHANNEL',
      targetType: 'TELEGRAM_CHANNEL',
      targetId: channel.id,
      details: {
        telegramChannelId,
        username,
        title,
        authorizationRecord: dto.authorizationRecord,
      },
      ipAddress: adminUser.ipAddress,
    });

    // Notify worker dynamically without restart
    await this.notifyWorkerSync();

    return channel;
  }

  /**
   * Edit channel metadata or authorization status
   */
  async updateChannel(id: string, updates: UpdateChannelInput, adminUser: AdminUserContext): Promise<any> {
    const existing = await prisma.telegramChannel.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound(`Telegram channel with ID '${id}' not found.`);
    }

    const channel = await prisma.telegramChannel.update({
      where: { id },
      data: {
        title: updates.title !== undefined ? updates.title.trim() : undefined,
        username: updates.username !== undefined ? updates.username.trim().replace(/^@/, '').toLowerCase() : undefined,
        authorizationRecord: updates.authorizationRecord !== undefined ? updates.authorizationRecord.trim() : undefined,
        isActive: updates.isActive !== undefined ? updates.isActive : undefined,
        isAuthorized: updates.isAuthorized !== undefined ? updates.isAuthorized : undefined,
      },
    });

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'UPDATE_TELEGRAM_CHANNEL',
      targetType: 'TELEGRAM_CHANNEL',
      targetId: channel.id,
      details: updates,
      ipAddress: adminUser.ipAddress,
    });

    await this.notifyWorkerSync();

    return channel;
  }

  /**
   * Verify Telegram channel access and metadata via worker or web preview
   */
  async verifyChannel(id: string, adminUser: AdminUserContext): Promise<any> {
    const channel = await prisma.telegramChannel.findUnique({ where: { id } });
    if (!channel) {
      throw AppError.notFound(`Telegram channel with ID '${id}' not found.`);
    }

    const identifier = channel.username ? `@${channel.username}` : channel.telegramChannelId;

    let workerVerification: any = null;
    try {
      const response = await fetch(`${env.TELEGRAM_WORKER_URL}/api/v1/worker/verify-channel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.TELEGRAM_INTERNAL_API_SECRET}`,
        },
        body: JSON.stringify({ identifier }),
        signal: AbortSignal.timeout(4000),
      });

      if (response.ok) {
        workerVerification = await response.json();
      }
    } catch (err: unknown) {
      logger.warn(`[TelegramChannelsService] Worker verification check notice: ${(err as Error).message}`);
    }

    const verificationResult = {
      channelId: channel.id,
      telegramChannelId: channel.telegramChannelId,
      username: channel.username,
      title: channel.title,
      isConfiguredAuthorized: channel.isAuthorized,
      isActive: channel.isActive,
      verifiedAt: new Date().toISOString(),
      workerAccessible: workerVerification?.accessible ?? null,
      workerDetails: workerVerification?.channel || null,
      publicUrl: channel.username ? `https://t.me/${channel.username}` : null,
    };

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'VERIFY_TELEGRAM_CHANNEL',
      targetType: 'TELEGRAM_CHANNEL',
      targetId: channel.id,
      details: verificationResult,
      ipAddress: adminUser.ipAddress,
    });

    return verificationResult;
  }

  /**
   * Activate listening for channel
   */
  async activateChannel(id: string, adminUser: AdminUserContext): Promise<any> {
    const channel = await prisma.telegramChannel.update({
      where: { id },
      data: { isActive: true, isAuthorized: true },
    });

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'ACTIVATE_TELEGRAM_CHANNEL',
      targetType: 'TELEGRAM_CHANNEL',
      targetId: id,
      ipAddress: adminUser.ipAddress,
    });

    await this.notifyWorkerSync();
    return channel;
  }

  /**
   * Pause listening for channel
   */
  async pauseChannel(id: string, adminUser: AdminUserContext): Promise<any> {
    const channel = await prisma.telegramChannel.update({
      where: { id },
      data: { isActive: false },
    });

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'PAUSE_TELEGRAM_CHANNEL',
      targetType: 'TELEGRAM_CHANNEL',
      targetId: id,
      ipAddress: adminUser.ipAddress,
    });

    await this.notifyWorkerSync();
    return channel;
  }

  /**
   * Deactivate and revoke authorization for channel
   */
  async deactivateChannel(id: string, adminUser: AdminUserContext): Promise<any> {
    const channel = await prisma.telegramChannel.update({
      where: { id },
      data: { isActive: false, isAuthorized: false },
    });

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'DEACTIVATE_TELEGRAM_CHANNEL',
      targetType: 'TELEGRAM_CHANNEL',
      targetId: id,
      ipAddress: adminUser.ipAddress,
    });

    await this.notifyWorkerSync();
    return channel;
  }

  /**
   * Delete channel permanently
   */
  async deleteChannel(id: string, adminUser: AdminUserContext): Promise<any> {
    const existing = await prisma.telegramChannel.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound(`Telegram channel with ID '${id}' not found.`);
    }

    const deleted = await prisma.telegramChannel.delete({
      where: { id },
    });

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'DELETE_TELEGRAM_CHANNEL',
      targetType: 'TELEGRAM_CHANNEL',
      targetId: id,
      details: {
        telegramChannelId: existing.telegramChannelId,
        username: existing.username,
        title: existing.title,
      },
      ipAddress: adminUser.ipAddress,
    });

    // Notify worker dynamically to remove channel from memory
    await this.notifyWorkerSync();

    return deleted;
  }

  /**
   * List ingested Telegram messages with filters & job linkage
   */
  async listMessages(options: {
    page?: number;
    limit?: number;
    channelId?: string;
    status?: TelegramMessageStatus;
    search?: string;
  } = {}): Promise<{ messages: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.TelegramMessageWhereInput = {};

    if (options.channelId) {
      where.channelId = options.channelId;
    }

    if (options.status) {
      where.processingStatus = options.status;
    }

    if (options.search) {
      where.originalText = { contains: options.search.trim() };
    }

    const [total, messages] = await Promise.all([
      prisma.telegramMessage.count({ where }),
      prisma.telegramMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { detectedAt: 'desc' },
        include: {
          channel: {
            select: { id: true, title: true, username: true, telegramChannelId: true },
          },
          job: {
            select: { id: true, normalizedTitle: true, companyName: true, status: true },
          },
        },
      }),
    ]);

    return { messages, total, page, limit };
  }

  /**
   * Query global operational status (Worker health + Database telemetry)
   */
  async getGlobalStatus(): Promise<any> {
    // 1. Query Telegram worker operational endpoint
    let workerStatus: any = null;
    let workerError: string | null = null;

    try {
      const response = await fetch(`${env.TELEGRAM_WORKER_URL}/status`, {
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        workerStatus = await response.json();
      } else {
        workerError = `Worker returned HTTP ${response.status}`;
      }
    } catch (err: unknown) {
      workerError = (err as Error).message || 'Worker unreachable';
    }

    // 2. Query Database telemetry
    const [
      totalChannels,
      activeChannels,
      authorizedChannels,
      totalMessages,
      processedMessages,
      duplicateMessages,
      failedMessages,
      pendingMessages,
      latestMessage,
      latestDelivered,
    ] = await Promise.all([
      prisma.telegramChannel.count(),
      prisma.telegramChannel.count({ where: { isActive: true, isAuthorized: true } }),
      prisma.telegramChannel.count({ where: { isAuthorized: true } }),
      prisma.telegramMessage.count(),
      prisma.telegramMessage.count({ where: { processingStatus: TelegramMessageStatus.PROCESSED } }),
      prisma.telegramMessage.count({ where: { processingStatus: TelegramMessageStatus.DUPLICATE } }),
      prisma.telegramMessage.count({ where: { processingStatus: TelegramMessageStatus.FAILED } }),
      prisma.telegramMessage.count({ where: { processingStatus: TelegramMessageStatus.PENDING } }),
      prisma.telegramMessage.findFirst({
        orderBy: { detectedAt: 'desc' },
        include: { channel: { select: { title: true, username: true } } },
      }),
      prisma.telegramMessage.findFirst({
        where: { processingStatus: TelegramMessageStatus.PROCESSED },
        orderBy: { updatedAt: 'desc' },
        include: { channel: { select: { title: true, username: true } }, job: { select: { id: true, normalizedTitle: true } } },
      }),
    ]);

    return {
      worker: {
        status: workerStatus ? workerStatus.status : 'offline',
        isOnline: Boolean(workerStatus),
        connectedToTelegram: workerStatus?.telegram?.connected ?? false,
        isListening: workerStatus?.telegram?.listening ?? false,
        uptimeSeconds: workerStatus?.uptimeSeconds ?? 0,
        workerError,
        rawWorkerStats: workerStatus,
      },
      telemetry: {
        channels: {
          total: totalChannels,
          active: activeChannels,
          authorized: authorizedChannels,
          paused: totalChannels - activeChannels,
        },
        messages: {
          total: totalMessages,
          processed: processedMessages,
          duplicate: duplicateMessages,
          failed: failedMessages,
          pending: pendingMessages,
        },
        latestMessageReceived: latestMessage
          ? {
              id: latestMessage.id,
              channelTitle: latestMessage.channel.title,
              publishedAt: latestMessage.publishedAt,
              detectedAt: latestMessage.detectedAt,
              status: latestMessage.processingStatus,
            }
          : null,
        latestSuccessfulDelivery: latestDelivered
          ? {
              id: latestDelivered.id,
              channelTitle: latestDelivered.channel.title,
              deliveredAt: latestDelivered.updatedAt,
              jobId: latestDelivered.jobId,
              jobTitle: latestDelivered.job?.normalizedTitle,
            }
          : null,
      },
    };
  }

  /**
   * Query failed deliveries and outbox telemetry
   */
  async listDeliveries(options: { page?: number; limit?: number } = {}): Promise<any> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const [totalFailed, failedMessages] = await Promise.all([
      prisma.telegramMessage.count({ where: { processingStatus: TelegramMessageStatus.FAILED } }),
      prisma.telegramMessage.findMany({
        where: { processingStatus: TelegramMessageStatus.FAILED },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          channel: { select: { id: true, title: true, username: true } },
        },
      }),
    ]);

    // Also query worker outbox if reachable
    let workerOutbox: any = null;
    try {
      const response = await fetch(`${env.TELEGRAM_WORKER_URL}/api/v1/worker/outbox?limit=20`, {
        headers: { Authorization: `Bearer ${env.TELEGRAM_INTERNAL_API_SECRET}` },
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        workerOutbox = await response.json();
      }
    } catch {
      // Worker outbox query is optional
    }

    return {
      failedDeliveries: failedMessages,
      totalFailed,
      page,
      limit,
      workerOutbox,
    };
  }

  /**
   * Retry a failed message delivery
   */
  async retryDelivery(messageId: string, adminUser: AdminUserContext): Promise<any> {
    const message = await prisma.telegramMessage.findUnique({
      where: { id: messageId },
      include: { channel: true },
    });

    if (!message) {
      throw AppError.notFound(`Telegram message record '${messageId}' not found.`);
    }

    // Reset processing status back to PENDING and clear previous error
    const updated = await prisma.telegramMessage.update({
      where: { id: messageId },
      data: {
        processingStatus: TelegramMessageStatus.PENDING,
        errorMessage: null,
      },
    });

    // Notify worker outbox if the outbox item matches `${channelId}_${msgId}`
    try {
      const outboxId = `${message.channel.telegramChannelId}_${message.telegramMessageId}`;
      await fetch(`${env.TELEGRAM_WORKER_URL}/api/v1/worker/outbox/${outboxId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.TELEGRAM_INTERNAL_API_SECRET}` },
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Ignored if outbox item doesn't exist
    }

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'RETRY_TELEGRAM_DELIVERY',
      targetType: 'TELEGRAM_MESSAGE',
      targetId: messageId,
      details: {
        channelId: message.channelId,
        telegramMessageId: message.telegramMessageId,
      },
      ipAddress: adminUser.ipAddress,
    });

    return {
      success: true,
      message: 'Message queued for reprocessing.',
      record: updated,
    };
  }

  /**
   * Toggle global worker listening state (Pause / Resume)
   */
  async toggleWorkerState(active: boolean, confirmation: boolean, adminUser: AdminUserContext): Promise<any> {
    if (!confirmation) {
      throw AppError.badRequest('Explicit confirmation is required to change worker operational state.');
    }

    const response = await fetch(`${env.TELEGRAM_WORKER_URL}/api/v1/worker/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.TELEGRAM_INTERNAL_API_SECRET}`,
      },
      body: JSON.stringify({ active }),
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      throw AppError.badRequest(`Worker returned HTTP ${response.status} when toggling state.`);
    }

    const data = await response.json();

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'TOGGLE_TELEGRAM_WORKER',
      targetType: 'TELEGRAM_WORKER',
      details: {
        active,
        result: data,
      },
      ipAddress: adminUser.ipAddress,
    });

    return data;
  }
}

export const telegramChannelsService = new TelegramChannelsService();
