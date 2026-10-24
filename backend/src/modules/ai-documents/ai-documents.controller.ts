import { Request, Response, NextFunction } from 'express';
import { aiDocumentsService } from './ai-documents.service';
import {
  generateDocumentSchema,
  saveVersionSchema,
  attachApplicationSchema,
  listDocumentsQuerySchema,
  exportQuerySchema,
} from './ai-documents.validation';
import { AppError } from '../../middleware/error-handler';

export class AiDocumentsController {
  async generateDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const validated = generateDocumentSchema.parse(req.body);

      const result = await aiDocumentsService.generateDocumentDraft(userId, validated);
      res.status(201).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async listDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const query = listDocumentsQuerySchema.parse(req.query);

      const result = await aiDocumentsService.listDocuments(userId, query);
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getDocumentById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const documentId = req.params.id as string;

      const document = await aiDocumentsService.getDocumentById(userId, documentId);
      res.status(200).json({
        status: 'success',
        data: { document },
      });
    } catch (err) {
      next(err);
    }
  }

  async saveVersion(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const documentId = req.params.id as string;
      const validated = saveVersionSchema.parse(req.body);

      const version = await aiDocumentsService.saveEditedVersion(userId, documentId, validated);
      res.status(201).json({
        status: 'success',
        data: { version },
      });
    } catch (err) {
      next(err);
    }
  }

  async exportDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const documentId = req.params.id as string;
      const versionNumber = parseInt(req.params.versionNumber as string, 10);

      if (isNaN(versionNumber) || versionNumber < 1) {
        throw AppError.badRequest('Invalid version number');
      }

      const query = exportQuerySchema.parse(req.query);
      const exported = await aiDocumentsService.exportDocumentFile(
        userId,
        documentId,
        versionNumber,
        query.format
      );

      res.setHeader('Content-Type', exported.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
      res.setHeader('Content-Length', exported.buffer.length);
      res.setHeader('Cache-Control', 'private, no-cache');

      res.status(200).send(exported.buffer);
    } catch (err) {
      next(err);
    }
  }

  async attachToApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const documentId = req.params.id as string;
      const validated = attachApplicationSchema.parse(req.body);

      const result = await aiDocumentsService.attachToApplication(userId, documentId, validated);
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const documentId = req.params.id as string;

      const result = await aiDocumentsService.deleteDocument(userId, documentId);
      res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const aiDocumentsController = new AiDocumentsController();
