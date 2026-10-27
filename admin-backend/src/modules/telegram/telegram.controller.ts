import { Request, Response, NextFunction } from 'express';
import { telegramPublisherService, TelegramPublisherService } from './telegram-publisher.service';
import { telegramApiClient, TelegramApiClient } from './telegram-api.client';

export class TelegramController {
  constructor(
    private readonly publisherService: TelegramPublisherService = telegramPublisherService,
    private readonly apiClient: TelegramApiClient = telegramApiClient
  ) {}

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

