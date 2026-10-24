import {
  uploadFile as coreUploadFile,
  uploadFileToDrive as coreUploadFileToDrive,
  downloadFile as coreDownloadFile,
  deleteFile as coreDeleteFile,
  isGoogleDriveConfigured as coreIsConfigured,
  UploadFileResult,
  DownloadFileResult,
} from '../../lib/storage/uploader';
import { logger } from '../../lib/logger';
import { AppError } from '../../middleware/error-handler';

export { UploadFileResult, DownloadFileResult };
export { coreUploadFile as uploadFile, coreUploadFileToDrive as uploadFileToDrive };

export interface DriveUploadResult extends UploadFileResult {}
export interface DriveDownloadResult extends DownloadFileResult {}

export class GoogleDriveService {
  public get isLiveStorage(): boolean {
    return coreIsConfigured();
  }

  /**
   * Upload a document to Google Drive (with automatic resilient local fallback)
   */
  async uploadFile(params: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    folderId?: string;
  }): Promise<DriveUploadResult> {
    try {
      return await coreUploadFile(params);
    } catch (err) {
      logger.error('File upload failed', {
        filename: params.filename,
        error: (err as Error).message,
      });
      throw AppError.internal('Failed to store document in storage. Please try again later.', err);
    }
  }

  /**
   * Download a document by its file ID
   */
  async downloadFile(fileId: string): Promise<DriveDownloadResult> {
    try {
      return await coreDownloadFile(fileId);
    } catch (err) {
      logger.error('File download failed', {
        fileId,
        error: (err as Error).message,
      });
      throw AppError.notFound('Stored document could not be retrieved from storage');
    }
  }

  /**
   * Delete a document by its file ID
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      return await coreDeleteFile(fileId);
    } catch (err) {
      logger.warn('File deletion warning', {
        fileId,
        error: (err as Error).message,
      });
      return false;
    }
  }
}

export const googleDriveService = new GoogleDriveService();

