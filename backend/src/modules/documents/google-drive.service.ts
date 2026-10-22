import { google, drive_v3 } from 'googleapis';
import { Readable } from 'node:stream';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { AppError } from '../../middleware/error-handler';

export interface DriveUploadResult {
  fileId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  webViewLink?: string;
}

export interface DriveDownloadResult {
  buffer: Buffer;
  mimeType: string;
  filename?: string;
}

export class GoogleDriveService {
  private driveClient: drive_v3.Drive | null = null;
  private isConfigured = false;
  // Local in-memory / dev fallback cache when service account is not yet configured in dev/testing
  private mockStorage = new Map<string, { buffer: Buffer; mimeType: string; filename: string }>();

  constructor() {
    this.initialize();
  }

  private initialize() {
    const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = env.GOOGLE_PRIVATE_KEY;
    const folderId = env.GOOGLE_DRIVE_FOLDER_ID;

    if (email && rawKey && folderId) {
      try {
        const formattedKey = rawKey.replace(/\\n/g, '\n');
        const auth = new google.auth.JWT({
          email,
          key: formattedKey,
          scopes: ['https://www.googleapis.com/auth/drive.file'],
        });

        this.driveClient = google.drive({ version: 'v3', auth });
        this.isConfigured = true;
        logger.info('Google Drive service initialized successfully with service account');
      } catch (err) {
        logger.error('Failed to initialize Google Drive service account auth', {
          error: (err as Error).message,
        });
        this.isConfigured = false;
      }
    } else {
      logger.info(
        'Google Drive service account credentials not fully configured; operating in local simulated storage mode for dev/test.'
      );
      this.isConfigured = false;
    }
  }

  public get isLiveStorage(): boolean {
    return this.isConfigured && this.driveClient !== null;
  }

  /**
   * Upload a document to Google Drive (or simulated fallback)
   */
  async uploadFile(params: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  }): Promise<DriveUploadResult> {
    const { buffer, filename, mimeType } = params;

    if (this.isLiveStorage && this.driveClient) {
      try {
        const fileMetadata: drive_v3.Schema$File = {
          name: filename,
          parents: [env.GOOGLE_DRIVE_FOLDER_ID!],
        };

        const media = {
          mimeType,
          body: Readable.from(buffer),
        };

        const res = await this.driveClient.files.create({
          requestBody: fileMetadata,
          media,
          fields: 'id, name, mimeType, size, webViewLink',
        });

        const fileId = res.data.id;
        if (!fileId) {
          throw new Error('Google Drive API created file but returned no file ID');
        }

        return {
          fileId,
          originalFilename: filename,
          mimeType,
          sizeBytes: buffer.length,
          webViewLink: res.data.webViewLink || undefined,
        };
      } catch (err) {
        logger.error('Google Drive file upload failed', {
          filename,
          error: (err as Error).message,
        });
        throw AppError.internal('Failed to store document in cloud storage. Please try again later.', err);
      }
    }

    // Fallback in-memory storage for development and test suites
    const mockFileId = `mock_drive_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.mockStorage.set(mockFileId, {
      buffer,
      mimeType,
      filename,
    });

    return {
      fileId: mockFileId,
      originalFilename: filename,
      mimeType,
      sizeBytes: buffer.length,
    };
  }

  /**
   * Download a document by its Google Drive file ID
   */
  async downloadFile(fileId: string): Promise<DriveDownloadResult> {
    if (this.isLiveStorage && this.driveClient) {
      try {
        const res = await this.driveClient.files.get(
          { fileId, alt: 'media' },
          { responseType: 'arraybuffer' }
        );

        const meta = await this.driveClient.files.get({
          fileId,
          fields: 'name, mimeType',
        });

        return {
          buffer: Buffer.from(res.data as ArrayBuffer),
          mimeType: meta.data.mimeType || 'application/octet-stream',
          filename: meta.data.name || undefined,
        };
      } catch (err) {
        logger.error('Google Drive download failed', {
          fileId,
          error: (err as Error).message,
        });
        throw AppError.notFound('Stored document could not be retrieved from cloud storage');
      }
    }

    const mock = this.mockStorage.get(fileId);
    if (!mock) {
      throw AppError.notFound('Document file not found in storage');
    }

    return {
      buffer: mock.buffer,
      mimeType: mock.mimeType,
      filename: mock.filename,
    };
  }

  /**
   * Delete a document from Google Drive
   */
  async deleteFile(fileId: string): Promise<boolean> {
    if (this.isLiveStorage && this.driveClient) {
      try {
        await this.driveClient.files.delete({ fileId });
        return true;
      } catch (err) {
        logger.warn('Google Drive file delete warning', {
          fileId,
          error: (err as Error).message,
        });
        return false;
      }
    }

    this.mockStorage.delete(fileId);
    return true;
  }
}

export const googleDriveService = new GoogleDriveService();

