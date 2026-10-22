import { Request, Response, NextFunction } from 'express';
import { documentsService } from './documents.service';
import { AppError } from '../../middleware/error-handler';
import { DocumentType } from '@prisma/client';

export const uploadDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) {
      throw AppError.badRequest('No document file was uploaded', 'FILE_REQUIRED', [
        { field: 'file', message: 'Please select a PDF or Word document (.pdf, .docx)' },
      ]);
    }

    const docType = (req.body.documentType as DocumentType) || DocumentType.CV;
    const document = await documentsService.uploadDocument(req.user!.userId, file, docType);

    res.status(201).json({
      status: 'success',
      message: 'Document uploaded and analyzed successfully',
      data: { document },
    });
  } catch (err) {
    next(err);
  }
};

export const listDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const documents = await documentsService.listUserDocuments(req.user!.userId);
    res.status(200).json({
      status: 'success',
      data: { documents },
    });
  } catch (err) {
    next(err);
  }
};

export const getDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const document = await documentsService.getDocumentById(req.user!.userId, id);
    res.status(200).json({
      status: 'success',
      data: { document },
    });
  } catch (err) {
    next(err);
  }
};

export const downloadDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const file = await documentsService.downloadDocument(req.user!.userId, id);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
    res.send(file.buffer);
  } catch (err) {
    next(err);
  }
};

export const deleteDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await documentsService.deleteDocument(req.user!.userId, id);
    res.status(200).json({
      status: 'success',
      message: 'Document deleted successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const retryExtraction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const document = await documentsService.retryExtraction(req.user!.userId, id);
    res.status(200).json({
      status: 'success',
      message: 'Document extraction re-triggered',
      data: { document },
    });
  } catch (err) {
    next(err);
  }
};
