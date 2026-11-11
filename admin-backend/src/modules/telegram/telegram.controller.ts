import { Request, Response, NextFunction } from 'express';
import { telegramPublisherService, TelegramPublisherService } from './telegram-publisher.service';
import { telegramApiClient, TelegramApiClient } from './telegram-api.client';
import { telegramChannelsService, TelegramChannelsService, AdminUserContext } from './telegram-channels.service';

function getAdminUser(req: Request): AdminUserContext {
  return {
    id: req.user!.userId,
    email: req.user!.email,
    role: req.user?.role,
    ipAddress: req.ip,
  };
}

export class TelegramController {
  constructor(
    private readonly publisherService: TelegramPublisherService = telegramPublisherService,
    private readonly apiClient: TelegramApiClient = telegramApiClient,
    private readonly channelsService: TelegramChannelsService = telegramChannelsService
  ) {}

  // =========================================================================
  // Ingestion & Channel Governance Handlers
  // =========================================================================

  listChannels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.channelsService.listChannels({
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: req.query.search as string | undefined,
        status: req.query.status as any,
      });

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  syncChannels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ok = await this.channelsService.notifyWorkerSync();
      res.status(200).json({
        status: 'success',
        message: ok ? 'Telegram worker synchronized channels.' : 'Sync signal queued.',
        data: { synced: ok },
      });
    } catch (err) {
      next(err);
    }
  };

  getChannel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await this.channelsService.getChannelById(id);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  registerChannel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const channel = await this.channelsService.registerChannel(req.body, getAdminUser(req));

      res.status(201).json({
        status: 'success',
        message: 'Telegram channel registered successfully.',
        data: { channel },
      });
    } catch (err) {
      next(err);
    }
  };

  updateChannel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const channel = await this.channelsService.updateChannel(id, req.body, getAdminUser(req));

      res.status(200).json({
        status: 'success',
        message: 'Channel updated successfully.',
        data: { channel },
      });
    } catch (err) {
      next(err);
    }
  };

  verifyChannel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await this.channelsService.verifyChannel(id, getAdminUser(req));

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  activateChannel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const channel = await this.channelsService.activateChannel(id, getAdminUser(req));

      res.status(200).json({
        status: 'success',
        message: `Listening activated for channel: ${channel.title}`,
        data: { channel },
      });
    } catch (err) {
      next(err);
    }
  };

  pauseChannel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const channel = await this.channelsService.pauseChannel(id, getAdminUser(req));

      res.status(200).json({
        status: 'success',
        message: `Listening paused for channel: ${channel.title}`,
        data: { channel },
      });
    } catch (err) {
      next(err);
    }
  };

  deactivateChannel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const channel = await this.channelsService.deactivateChannel(id, getAdminUser(req));

      res.status(200).json({
        status: 'success',
        message: `Channel deactivated and revoked: ${channel.title}`,
        data: { channel },
      });
    } catch (err) {
      next(err);
    }
  };

  deleteChannel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const channel = await this.channelsService.deleteChannel(id, getAdminUser(req));

      res.status(200).json({
        status: 'success',
        message: `Channel '${channel.title}' deleted permanently.`,
        data: { channel },
      });
    } catch (err) {
      next(err);
    }
  };

  listMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.channelsService.listMessages({
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        channelId: req.query.channelId as string | undefined,
        status: req.query.status as any,
        search: req.query.search as string | undefined,
      });

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  getGlobalStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = await this.channelsService.getGlobalStatus();
      res.status(200).json({
        status: 'success',
        data: status,
      });
    } catch (err) {
      next(err);
    }
  };

  listDeliveries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.channelsService.listDeliveries({
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  retryDelivery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await this.channelsService.retryDelivery(id, getAdminUser(req));

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  toggleWorker = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { active, confirmation } = req.body;
      const result = await this.channelsService.toggleWorkerState(Boolean(active), Boolean(confirmation), getAdminUser(req));

      res.status(200).json({
        status: 'success',
        message: active ? 'Worker listening resumed.' : 'Worker listening paused.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  // =========================================================================
  // Outbound Telegram Publishing Bot Handlers
  // =========================================================================

  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.publisherService.getStats();
      res.status(200).json({
        status: 'success',
        data: stats,
      });
    } catch (err) {
      next(err);
    }
  };

  testConnection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.apiClient.testConnection();
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  publishJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
      const force = req.body?.force === true;

      const result = await this.publisherService.publishJob(jobId, { force });

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  triggerBackfill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dryRun = req.body?.dryRun !== false; // default true for safety
      const limit = typeof req.body?.limit === 'number' ? req.body.limit : 20;
      const minSalary = typeof req.body?.minSalary === 'number' ? req.body.minSalary : undefined;
      const sourceId = typeof req.body?.sourceId === 'string' ? req.body.sourceId : undefined;

      const result = await this.publisherService.backfill({
        dryRun,
        limit,
        minSalary,
        sourceId,
      });

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  triggerBatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = typeof req.body?.limit === 'number' ? req.body.limit : 10;
      const result = await this.publisherService.processPendingEligibleJobs(limit);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const telegramController = new TelegramController();
