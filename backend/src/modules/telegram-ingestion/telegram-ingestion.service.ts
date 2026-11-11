import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { AppError } from '../../middleware/error-handler';
import { jobsRepository } from '../jobs/jobs.repository';
import { classificationService } from '../classification/classification.service';
import { generateJobFingerprint } from '../sources/adapters/fingerprint.util';
import { NormalizedJob } from '../sources/adapters/source-adapter.interface';
import { IngestTelegramMessageDto, IngestionResult, TelegramChannelDto } from './telegram-ingestion.types';
import { Prisma, SourceType, WorkArrangement, TelegramMessageStatus } from '@prisma/client';

export class TelegramIngestionService {
  private telegramSourceId: string | null = null;

  /**
   * Ensure a dedicated JobSource exists for Telegram channel ingestion
   */
  async getOrCreateTelegramSource(): Promise<string> {
    if (this.telegramSourceId) {
      return this.telegramSourceId;
    }

    let source = await prisma.jobSource.findUnique({
      where: { slug: 'telegram' },
    });

    if (!source) {
      logger.info('[TelegramIngestion] Initializing Telegram JobSource record in database...');
      source = await prisma.jobSource.create({
        data: {
          name: 'Telegram Channels',
          slug: 'telegram',
          type: SourceType.SCRAPER,
          endpointUrl: 'https://telegram.org',
          isActive: true,
          pollingInterval: 0, // Real-time push via worker
        },
      });
    }

    this.telegramSourceId = source.id;
    return source.id;
  }

  /**
   * List all authorized and active channels for the Telegram worker
   */
  async listAuthorizedChannels(): Promise<any[]> {
    return prisma.telegramChannel.findMany({
      where: {
        isAuthorized: true,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * List all channels (including inactive) for admin governance
   */
  async listAllChannels(options: { page?: number; limit?: number; search?: string } = {}): Promise<{ channels: any[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.TelegramChannelWhereInput = {};
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

    return { total, channels };
  }

  /**
   * Register or update an authorized Telegram channel
   */
  async registerOrUpdateChannel(dto: TelegramChannelDto): Promise<any> {
    const channel = await prisma.telegramChannel.upsert({
      where: { telegramChannelId: dto.telegramChannelId },
      update: {
        title: dto.title,
        username: dto.username || undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        isAuthorized: dto.isAuthorized !== undefined ? dto.isAuthorized : true,
        authorizationRecord: dto.authorizationRecord,
      },
      create: {
        telegramChannelId: dto.telegramChannelId,
        username: dto.username,
        title: dto.title,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        isAuthorized: dto.isAuthorized !== undefined ? dto.isAuthorized : true,
        authorizationRecord: dto.authorizationRecord || 'Initial authorized registration',
      },
    });

    logger.info(`[TelegramIngestion] Registered/updated Telegram channel: ${channel.title} (${channel.telegramChannelId})`);
    return channel;
  }

  /**
   * Toggle channel active status
   */
  async updateChannel(id: string, updates: Partial<TelegramChannelDto>): Promise<any> {
    const existing = await prisma.telegramChannel.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound(`Telegram channel with ID '${id}' not found.`);
    }

    return prisma.telegramChannel.update({
      where: { id },
      data: {
        title: updates.title,
        username: updates.username,
        isActive: updates.isActive,
        isAuthorized: updates.isAuthorized,
        authorizationRecord: updates.authorizationRecord,
      },
    });
  }

  /**
   * Delete channel permanently
   */
  async deleteChannel(id: string): Promise<any> {
    const existing = await prisma.telegramChannel.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound(`Telegram channel with ID '${id}' not found.`);
    }

    return prisma.telegramChannel.delete({
      where: { id },
    });
  }

  /**
   * Ingest and process an incoming message from the Telegram worker
   */
  async ingestMessage(dto: IngestTelegramMessageDto): Promise<IngestionResult> {
    const publishedDate = new Date(dto.publishedAt);
    const detectedDate = dto.detectedAt ? new Date(dto.detectedAt) : new Date();

    // 1. Verify channel registration and authorization
    let channel = await prisma.telegramChannel.findUnique({
      where: { telegramChannelId: dto.channelId },
    });

    if (!channel && dto.channelUsername) {
      // Check if channel was registered via admin dashboard by username/link
      const cleanUsername = dto.channelUsername.toLowerCase().replace(/^@/, '');
      const existingByUsername = await prisma.telegramChannel.findFirst({
        where: { username: cleanUsername },
      });

      if (existingByUsername) {
        channel = await prisma.telegramChannel.update({
          where: { id: existingByUsername.id },
          data: {
            telegramChannelId: dto.channelId,
            title: dto.channelTitle || existingByUsername.title,
          },
        });
        logger.info(`[TelegramIngestion] Promoted channel '${channel.title}' from placeholder ID to real Telegram ID: ${dto.channelId}`);
      }
    }

    if (!channel) {
      // Check if auto-registering authorized known channels
      if (dto.channelTitle || dto.channelUsername) {
        channel = await this.registerOrUpdateChannel({
          telegramChannelId: dto.channelId,
          username: dto.channelUsername,
          title: dto.channelTitle || dto.channelUsername || `Channel ${dto.channelId}`,
          isActive: true,
          isAuthorized: true,
          authorizationRecord: 'Auto-registered from authorized worker stream',
        });
      } else {
        logger.warn(`[TelegramIngestion] Rejecting message from unregistered channel: ${dto.channelId}`);
        throw AppError.forbidden(`Channel '${dto.channelId}' is not registered or authorized.`);
      }
    }

    if (!channel) {
      throw AppError.forbidden(`Channel '${dto.channelId}' could not be resolved.`);
    }

    if (!channel.isAuthorized || !channel.isActive) {
      logger.warn(`[TelegramIngestion] Rejecting message from inactive or unauthorized channel: ${channel.title} (${channel.telegramChannelId})`);
      throw AppError.forbidden(`Channel '${channel.title}' is currently inactive or unauthorized.`);
    }

    // 2. Duplicate detection check (idempotency key: channelId + messageId)
    const existing = await prisma.telegramMessage.findUnique({
      where: {
        channelId_telegramMessageId: {
          channelId: channel.id,
          telegramMessageId: dto.messageId,
        },
      },
    });

    if (existing) {
      logger.info(`[TelegramIngestion] Duplicate message ignored: Channel '${channel.title}', Message ID #${dto.messageId}`);
      return {
        success: true,
        duplicate: true,
        telegramMessageRecordId: existing.id,
        processingStatus: existing.processingStatus,
        jobId: existing.jobId || undefined,
      };
    }

    // 3. Persist raw Telegram message record
    const messageRecord = await prisma.telegramMessage.create({
      data: {
        channelId: channel.id,
        telegramMessageId: dto.messageId,
        originalText: dto.originalText,
        publishedAt: publishedDate,
        detectedAt: detectedDate,
        sourceUrl: dto.sourceUrl,
        mediaMetadata: dto.mediaMetadata ? (dto.mediaMetadata as Prisma.InputJsonValue) : Prisma.DbNull,
        rawPayload: dto.rawPayload ? (dto.rawPayload as Prisma.InputJsonValue) : Prisma.DbNull,
        processingStatus: TelegramMessageStatus.PENDING,
      },
    });

    // Update channel activity tracking
    await prisma.telegramChannel.update({
      where: { id: channel.id },
      data: {
        lastMessageId: dto.messageId,
        lastEventAt: detectedDate,
      },
    });

    // 4. Extract job details using heuristic parser
    const extraction = this.extractJobFromText(dto.originalText, {
      sourceUrl: dto.sourceUrl,
      channelTitle: channel.title,
    });

    if (!extraction.isJob) {
      logger.info(`[TelegramIngestion] Message #${dto.messageId} does not appear to be a job vacancy. Marking IGNORED.`);
      await prisma.telegramMessage.update({
        where: { id: messageRecord.id },
        data: {
          processingStatus: TelegramMessageStatus.IGNORED,
          errorMessage: 'Message text lacks required vacancy indicators.',
        },
      });

      return {
        success: true,
        duplicate: false,
        telegramMessageRecordId: messageRecord.id,
        processingStatus: TelegramMessageStatus.IGNORED,
      };
    }

    // 5. Ingest into canonical Job table
    try {
      const sourceId = await this.getOrCreateTelegramSource();
      const externalId = `tg-${channel.telegramChannelId}-${dto.messageId}`;
      const fingerprint = generateJobFingerprint({
        externalId,
        originalUrl: dto.sourceUrl,
        title: extraction.title,
        companyName: extraction.companyName,
        descriptionSnippet: extraction.description.slice(0, 150),
      });

      const normalizedJob: NormalizedJob = {
        sourceId,
        externalId,
        fingerprint,
        originalUrl: dto.sourceUrl || `https://t.me/c/${channel.telegramChannelId.replace('-100', '')}/${dto.messageId}`,
        applicationUrl: extraction.applicationUrl || dto.sourceUrl || null,
        rawPayload: {
          telegramChannelId: channel.telegramChannelId,
          telegramMessageId: dto.messageId,
          channelTitle: channel.title,
          ...dto.rawPayload,
        },
        originalTitle: extraction.title,
        originalDescription: dto.originalText,
        normalizedTitle: extraction.title,
        normalizedDescription: extraction.description,
        companyName: extraction.companyName || channel.title,
        country: 'Ethiopia',
        city: extraction.city || 'Addis Ababa',
        isRemote: extraction.isRemote,
        workArrangement: extraction.workArrangement,
        remoteEligibility: extraction.isRemote ? 'Worldwide / Ethiopia Remote' : null,
        employmentType: extraction.employmentType,
        experienceLevel: extraction.experienceLevel,
        salaryMin: extraction.salaryMin,
        salaryMax: extraction.salaryMax,
        salaryCurrency: extraction.salaryCurrency || (extraction.salaryMin ? 'ETB' : null),
        salaryPeriod: extraction.salaryPeriod,
        publishedAt: publishedDate,
        closingDate: extraction.closingDate,
      };

      const { job, isNew } = await jobsRepository.upsertJob(normalizedJob);

      // Link job to Telegram message record
      await prisma.telegramMessage.update({
        where: { id: messageRecord.id },
        data: {
          jobId: job.id,
          processingStatus: TelegramMessageStatus.PROCESSED,
        },
      });

      // 6. Trigger AI classification asynchronously for new or unclassified job
      if (isNew && job.classificationStatus === 'PENDING' && process.env.NODE_ENV !== 'test') {
        classificationService.classifyJobById(job.id).catch((err) => {
          logger.warn(`[TelegramIngestion] Async classification notice for job ${job.id}: ${err.message}`);
        });
      }

      logger.info(`[TelegramIngestion] Successfully ingested job from Telegram #${dto.messageId}: "${job.normalizedTitle}" (Job ID: ${job.id})`);
      return {
        success: true,
        duplicate: false,
        telegramMessageRecordId: messageRecord.id,
        processingStatus: TelegramMessageStatus.PROCESSED,
        jobId: job.id,
      };
    } catch (err) {
      const errorMsg = (err as Error).message || String(err);
      logger.error(`[TelegramIngestion] Failed to process job from Telegram message #${dto.messageId}: ${errorMsg}`);

      await prisma.telegramMessage.update({
        where: { id: messageRecord.id },
        data: {
          processingStatus: TelegramMessageStatus.FAILED,
          errorMessage: errorMsg,
        },
      });

      return {
        success: false,
        duplicate: false,
        telegramMessageRecordId: messageRecord.id,
        processingStatus: TelegramMessageStatus.FAILED,
        error: errorMsg,
      };
    }
  }

  /**
   * Lightweight heuristic parser for Telegram messages (English & Amharic job postings)
   */
  private extractJobFromText(
    text: string,
    meta: { sourceUrl?: string; channelTitle?: string }
  ): {
    isJob: boolean;
    title: string;
    companyName?: string;
    description: string;
    city?: string;
    isRemote: boolean;
    workArrangement: WorkArrangement;
    employmentType?: any;
    experienceLevel?: any;
    salaryMin?: number | null;
    salaryMax?: number | null;
    salaryCurrency?: string;
    salaryPeriod?: any;
    applicationUrl?: string;
    closingDate?: Date | null;
  } {
    const raw = text.trim();
    if (!raw || raw.length < 30) {
      return { isJob: false, title: '', description: '', isRemote: false, workArrangement: WorkArrangement.ON_SITE };
    }

    const lower = raw.toLowerCase();

    // Check for vacancy markers in English and Amharic
    const vacancyKeywords = [
      'job', 'vacancy', 'position', 'hiring', 'qualification', 'requirement',
      'experience', 'salary', 'deadline', 'apply', 'responsibilities',
      'የስራ መደብ', 'ክፍት የስራ', 'የስራ አይነት', 'ደመወዝ', 'የማመልከቻ', 'ልምድ', 'ተፈላጊ ችሎታ'
    ];

    const matchCount = vacancyKeywords.filter((kw) => lower.includes(kw)).length;
    if (matchCount < 2) {
      return { isJob: false, title: '', description: '', isRemote: false, workArrangement: WorkArrangement.ON_SITE };
    }

    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Extract Title
    let title = '';
    for (const line of lines) {
      const m = line.match(/(?:position|job\s*title|title|role|የስራ\s*መደብ|የስራ\s*አይነት)\s*[:\-–]\s*(.+)/i);
      if (m && m[1]) {
        title = m[1].replace(/[*_#]/g, '').trim();
        break;
      }
    }

    if (!title && lines.length > 0) {
      // Use the first non-header, non-URL line as title candidate
      for (const line of lines) {
        const clean = line.replace(/[*_#]/g, '').trim();
        if (clean.length >= 4 && clean.length <= 100 && !clean.startsWith('http') && !clean.startsWith('@')) {
          title = clean;
          break;
        }
      }
    }

    if (!title) {
      title = `${meta.channelTitle || 'Telegram'} Vacancy`;
    }

    // 2. Extract Company Name
    let companyName: string | undefined;
    for (const line of lines) {
      const m = line.match(/(?:company|organization|employer|ድርጅት|ተቋም)\s*[:\-–]\s*(.+)/i);
      if (m && m[1]) {
        companyName = m[1].replace(/[*_#]/g, '').trim();
        break;
      }
    }

    // 3. Extract Location & Work Arrangement
    const isRemote = lower.includes('remote') || lower.includes('work from home') || lower.includes('ኦንላይን');
    const isHybrid = lower.includes('hybrid');
    let workArrangement: WorkArrangement = WorkArrangement.ON_SITE;
    if (isRemote) workArrangement = WorkArrangement.REMOTE;
    else if (isHybrid) workArrangement = WorkArrangement.HYBRID;

    let city: string | undefined;
    if (lower.includes('addis ababa') || lower.includes('አዲስ አበባ')) city = 'Addis Ababa';
    else if (lower.includes('hawassa') || lower.includes('ሀዋሳ')) city = 'Hawassa';
    else if (lower.includes('adama') || lower.includes('አዳማ') || lower.includes('nazret')) city = 'Adama';
    else if (lower.includes('bahir dar') || lower.includes('ባህር ዳር')) city = 'Bahir Dar';
    else if (lower.includes('dire dawa') || lower.includes('ድሬዳዋ')) city = 'Dire Dawa';

    // 4. Extract Application Link / Contact
    let applicationUrl: string | undefined;
    const urlMatch = raw.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      applicationUrl = urlMatch[0].replace(/[.,;)\]]+$/, '');
    }

    // 5. Extract Salary Range if available
    let salaryMin: number | null = null;
    let salaryMax: number | null = null;
    const salaryMatch = raw.match(/(?:salary|ደመወዝ)\s*[:\-–]?\s*([0-9,]+)(?:\s*[-–to]+\s*([0-9,]+))?/i);
    if (salaryMatch) {
      const p1 = parseInt(salaryMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(p1) && p1 > 1000 && p1 < 10000000) {
        salaryMin = p1;
        if (salaryMatch[2]) {
          const p2 = parseInt(salaryMatch[2].replace(/,/g, ''), 10);
          if (!isNaN(p2) && p2 >= p1) {
            salaryMax = p2;
          }
        }
      }
    }

    // 6. Extract Closing / Deadline Date if available
    let closingDate: Date | null = null;
    const deadlineMatch = raw.match(/(?:deadline|closing\s*date|ማመልከቻ\s*ማብቂያ)\s*[:\-–]?\s*([A-Za-z0-9,/\s-]{6,25})/i);
    if (deadlineMatch) {
      const parsed = new Date(deadlineMatch[1].trim());
      if (!isNaN(parsed.getTime()) && parsed > new Date()) {
        closingDate = parsed;
      }
    }

    return {
      isJob: true,
      title,
      companyName,
      description: raw,
      city,
      isRemote,
      workArrangement,
      salaryMin,
      salaryMax,
      salaryCurrency: salaryMin ? 'ETB' : undefined,
      applicationUrl,
      closingDate,
    };
  }

  /**
   * Health and operational status for Telegram ingestion
   */
  async getStatus(): Promise<any> {
    const [totalChannels, activeChannels, totalMessages, processedMessages, failedMessages] = await Promise.all([
      prisma.telegramChannel.count(),
      prisma.telegramChannel.count({ where: { isActive: true, isAuthorized: true } }),
      prisma.telegramMessage.count(),
      prisma.telegramMessage.count({ where: { processingStatus: TelegramMessageStatus.PROCESSED } }),
      prisma.telegramMessage.count({ where: { processingStatus: TelegramMessageStatus.FAILED } }),
    ]);

    const latestMessage = await prisma.telegramMessage.findFirst({
      orderBy: { detectedAt: 'desc' },
      select: {
        id: true,
        telegramMessageId: true,
        detectedAt: true,
        publishedAt: true,
        processingStatus: true,
        channel: {
          select: { title: true, username: true },
        },
      },
    });

    return {
      status: 'healthy',
      channels: {
        total: totalChannels,
        active: activeChannels,
      },
      messages: {
        total: totalMessages,
        processed: processedMessages,
        failed: failedMessages,
      },
      latestMessage,
      timestamp: new Date().toISOString(),
    };
  }
}

export const telegramIngestionService = new TelegramIngestionService();
