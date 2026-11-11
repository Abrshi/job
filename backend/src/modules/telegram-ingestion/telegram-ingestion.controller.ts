import { Request, Response, NextFunction } from 'express';
import { telegramIngestionService } from './telegram-ingestion.service';
import { logger } from '../../lib/logger';

export class TelegramIngestionController {
  /**
   * Handle incoming message webhook from Telegram worker
   * POST /api/v1/internal/telegram/messages
   */
  async ingestMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await telegramIngestionService.ingestMessage(req.body);
      const statusCode = result.duplicate ? 200 : (result.success ? 201 : 422);

      res.status(statusCode).json({
        status: result.success ? 'success' : 'error',
        success: result.success,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Return list of authorized channels for the Telegram worker to monitor
   * GET /api/v1/internal/telegram/channels
   */
  async getAuthorizedChannels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const channels = await telegramIngestionService.listAuthorizedChannels();
      res.status(200).json({
        status: 'success',
        success: true,
        data: {
          channels,
          count: channels.length,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Register or update an authorized channel
   * POST /api/v1/internal/telegram/channels
   */
  async registerChannel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const channel = await telegramIngestionService.registerOrUpdateChannel(req.body);
      res.status(201).json({
        status: 'success',
        success: true,
        data: { channel },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete an authorized channel
   * DELETE /api/v1/internal/telegram/channels/:id
   */
  async deleteChannel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const channel = await telegramIngestionService.deleteChannel(id);
      res.status(200).json({
        status: 'success',
        success: true,
        data: { channel },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get operational health & message counts
   * GET /api/v1/internal/telegram/status
   */
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await telegramIngestionService.getStatus();
      res.status(200).json({
        status: 'success',
        success: true,
        data: status,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const telegramIngestionController = new TelegramIngestionController();
