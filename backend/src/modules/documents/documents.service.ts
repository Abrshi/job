import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../lib/logger';
import { googleDriveService } from './google-drive.service';
import { documentExtractorService, ExtractedProfileData } from './document-extractor.service';
import { DocumentType } from '@prisma/client';

export class DocumentsService {
  /**
   * Upload a CV or professional document, store in Google Drive, and extract profile info
   */
  async uploadDocument(
    userId: string,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    documentType: DocumentType = DocumentType.CV
  ) {
    // 1. Validate file format, magic bytes, and size limits
    documentExtractorService.validateFile(file.buffer, file.originalname, file.mimetype);

    // 2. Calculate SHA-256 checksum
    const checksum = documentExtractorService.calculateChecksum(file.buffer);

    // 3. Store in Google Drive (private application folder)
    const driveUpload = await googleDriveService.uploadFile({
      buffer: file.buffer,
      filename: `${userId}_${Date.now()}_${file.originalname}`,
      mimeType: file.mimetype,
    });

    // 4. Create document record in database
    const document = await prisma.userDocument.create({
      data: {
        userId,
        driveFileId: driveUpload.fileId,
        documentType,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size || file.buffer.length,
        fileChecksum: checksum,
        storageProvider: googleDriveService.isLiveStorage ? 'GOOGLE_DRIVE' : 'LOCAL_MOCK',
        processingStatus: 'COMPLETED',
        extractionStatus: 'EXTRACTING',
      },
    });

    // 5. Run text extraction and structured parsing
    let extractedText = '';
    let extractedData: ExtractedProfileData | null = null;
    let extractionStatus: 'EXTRACTED' | 'FAILED' = 'EXTRACTED';
    let errorMessage: string | null = null;

    try {
      extractedText = await documentExtractorService.extractText(file.buffer, file.originalname);
      extractedData = await documentExtractorService.extractStructuredProfile(extractedText);
    } catch (err) {
      extractionStatus = 'FAILED';
      errorMessage = (err as Error).message || 'Extraction failed';
      logger.error('Document extraction failed for uploaded file', {
        documentId: document.id,
        error: errorMessage,
      });
    }

    // 6. Update document with extracted payload
    const updated = await prisma.userDocument.update({
      where: { id: document.id },
      data: {
        extractedText: extractedText || null,
        extractedData: extractedData ? (extractedData as any) : undefined,
        extractionStatus,
        errorMessage,
      },
    });

    return updated;
  }

  /**
   * List user's private documents
   */
  async listUserDocuments(userId: string) {
    return prisma.userDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        documentType: true,
        originalFilename: true,
        mimeType: true,
        fileSize: true,
        storageProvider: true,
        processingStatus: true,
        extractionStatus: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        // Omit raw extracted text from list queries to keep payload lightweight
      },
    });
  }

  /**
   * Get single document metadata and extracted data (authorized to owner)
   */
  async getDocumentById(userId: string, documentId: string) {
    const document = await prisma.userDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw AppError.notFound('Document not found');
    }

    if (document.userId !== userId) {
      throw AppError.forbidden('You do not have permission to access this document');
    }

    return document;
  }

  /**
   * Download original document file from Google Drive (authorized)
   */
  async downloadDocument(userId: string, documentId: string) {
    const document = await this.getDocumentById(userId, documentId);

    const download = await googleDriveService.downloadFile(document.driveFileId);
    return {
      buffer: download.buffer,
      mimeType: document.mimeType || download.mimeType,
      filename: document.originalFilename || download.filename || 'document',
    };
  }

  /**
   * Delete document from Google Drive and remove database record
   */
  async deleteDocument(userId: string, documentId: string) {
    const document = await this.getDocumentById(userId, documentId);

    // Delete from Drive storage
    await googleDriveService.deleteFile(document.driveFileId);

    // Remove database record
    await prisma.userDocument.delete({
      where: { id: documentId },
    });

    return { success: true };
  }

  /**
   * Retry text and AI extraction for an existing document
   */
  async retryExtraction(userId: string, documentId: string) {
    const document = await this.getDocumentById(userId, documentId);

    const { buffer } = await googleDriveService.downloadFile(document.driveFileId);

    await prisma.userDocument.update({
      where: { id: documentId },
      data: { extractionStatus: 'EXTRACTING', errorMessage: null },
    });

    try {
      const extractedText = await documentExtractorService.extractText(buffer, document.originalFilename);
      const extractedData = await documentExtractorService.extractStructuredProfile(extractedText);

      return prisma.userDocument.update({
        where: { id: documentId },
        data: {
          extractedText,
          extractedData: extractedData as any,
          extractionStatus: 'EXTRACTED',
          errorMessage: null,
        },
      });
    } catch (err) {
      return prisma.userDocument.update({
        where: { id: documentId },
        data: {
          extractionStatus: 'FAILED',
          errorMessage: (err as Error).message || 'Extraction retry failed',
        },
      });
    }
  }
}

export const documentsService = new DocumentsService();

