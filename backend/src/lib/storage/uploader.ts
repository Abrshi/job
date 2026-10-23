import { google, drive_v3 } from 'googleapis';
import { Readable } from 'node:stream';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../logger';

export interface UploadFileOptions {
  buffer: Buffer;
  filename: string;
  mimeType?: string;
  folderId?: string; // Optional custom Google Drive folder ID (falls back to env.GOOGLE_DRIVE_FOLDER_ID)
}

export interface UploadFileResult {
  fileId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  webViewLink?: string;
  storageProvider: 'GOOGLE_DRIVE' | 'LOCAL_STORAGE';
}

export interface DownloadFileResult {
  buffer: Buffer;
  mimeType: string;
  filename?: string;
}

// Local storage path for fallback when Google Drive quota is exceeded or in offline/local dev mode
const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), 'uploads', 'documents');

// Ensure local storage directory exists
if (!fsSync.existsSync(LOCAL_STORAGE_DIR)) {
  try {
    fsSync.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
  } catch (err) {
    logger.warn('Could not create local storage directory at startup', {
      path: LOCAL_STORAGE_DIR,
      error: (err as Error).message,
    });
  }
}

// Singleton Google Drive client holder
let cachedDriveClient: drive_v3.Drive | null = null;
let driveAuthInitialized = false;

function getDriveClient(): drive_v3.Drive | null {
  if (driveAuthInitialized) {
    return cachedDriveClient;
  }

  driveAuthInitialized = true;
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL || env.CLIENT_EMAIL;
  const key = env.GOOGLE_PRIVATE_KEY || env.PRIVATE_KEY;

  if (email && key) {
    try {
      const formattedKey = key.replace(/\\n/g, '\n');
      const auth = new google.auth.JWT({
        email,
        key: formattedKey,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });

      cachedDriveClient = google.drive({ version: 'v3', auth });
      logger.info('Google Drive API client initialized successfully', {
        serviceAccount: email,
      });
    } catch (err) {
      logger.error('Failed to initialize Google Drive service account auth', {
        error: (err as Error).message,
      });
      cachedDriveClient = null;
    }
  } else {
    logger.info(
      'Google Drive credentials not configured; uploader operating in local storage mode'
    );
  }

  return cachedDriveClient;
}

/**
 * Checks whether Google Drive credentials are configured
 */
export function isGoogleDriveConfigured(): boolean {
  return getDriveClient() !== null;
}

/**
 * Stores a file in persistent local storage (fallback or offline mode)
 */
async function storeLocally(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<UploadFileResult> {
  await fs.mkdir(LOCAL_STORAGE_DIR, { recursive: true });
  const uniqueId = `local_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const diskFilename = `${uniqueId}__${safeFilename}`;
  const filePath = path.join(LOCAL_STORAGE_DIR, diskFilename);

  await fs.writeFile(filePath, buffer);

  // Also write small metadata file for quick attribute lookup
  const metaPath = path.join(LOCAL_STORAGE_DIR, `${uniqueId}.json`);
  await fs.writeFile(
    metaPath,
    JSON.stringify(
      {
        fileId: uniqueId,
        originalFilename: filename,
        mimeType,
        sizeBytes: buffer.length,
        diskFilename,
        storedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  return {
    fileId: uniqueId,
    originalFilename: filename,
    mimeType,
    sizeBytes: buffer.length,
    storageProvider: 'LOCAL_STORAGE',
  };
}

/**
 * Single, unified file upload function for the application.
 *
 * Automatically handles:
 * 1. Google Drive cloud upload when service account and folder are available.
 * 2. Seamless local persistent storage fallback if Google Drive returns a quota error,
 *    missing folder, or is not configured.
 *
 * @param options Upload options including file buffer, filename, and mimeType
 * @returns UploadFileResult with fileId and storage metadata
 *
 * @example
 * ```ts
 * import { uploadFile } from '@/lib/storage/uploader';
 *
 * const result = await uploadFile({
 *   buffer: file.buffer,
 *   filename: file.originalname,
 *   mimeType: file.mimetype,
 * });
 * console.log('Uploaded file ID:', result.fileId);
 * ```
 */
export async function uploadFile(options: UploadFileOptions): Promise<UploadFileResult> {
  const { buffer, filename, mimeType = 'application/octet-stream', folderId } = options;

  const drive = getDriveClient();
  const targetFolderId = folderId || env.GOOGLE_DRIVE_FOLDER_ID;

  // If Google Drive client is available, attempt cloud upload
  if (drive) {
    try {
      const fileMetadata: drive_v3.Schema$File = {
        name: filename,
        ...(targetFolderId ? { parents: [targetFolderId] } : {}),
      };

      const media = {
        mimeType,
        body: Readable.from(buffer),
      };

      const res = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id, name, mimeType, size, webViewLink, webContentLink',
        supportsAllDrives: true,
      });

      const fileId = res.data.id;
      if (!fileId) {
        throw new Error('Google Drive API returned empty file ID');
      }

      logger.info('File successfully uploaded to Google Drive', {
        fileId,
        filename,
        targetFolder: targetFolderId || 'root',
      });

      return {
        fileId,
        originalFilename: filename,
        mimeType,
        sizeBytes: buffer.length,
        webViewLink: res.data.webViewLink || undefined,
        storageProvider: 'GOOGLE_DRIVE',
      };
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      const isQuotaError =
        errorMsg.includes('storage quota') ||
        errorMsg.includes('storageQuotaExceeded') ||
        err?.code === 403;

      if (isQuotaError) {
        const clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL || env.CLIENT_EMAIL;
        logger.warn(
          `Google Drive upload rejected: Service account lacks storage quota. Falling back to persistent local storage so CV upload succeeds. To use Drive cloud storage, create a folder in your Google Drive, share it with "${clientEmail}" as Editor, and set GOOGLE_DRIVE_FOLDER_ID in backend/.env.`
        );
      } else {
        logger.warn('Google Drive file upload failed; falling back to persistent local storage', {
          filename,
          error: errorMsg,
        });
      }

      // Fallback cleanly to local storage so user onboarding / CV upload never breaks
      return storeLocally(buffer, filename, mimeType);
    }
  }

  // If Drive is not configured, store locally
  return storeLocally(buffer, filename, mimeType);
}

/**
 * Convenient alias for uploadFile
 */
export const uploadFileToDrive = uploadFile;

/**
 * Downloads a file by its fileId, looking in local storage first, then Google Drive
 */
export async function downloadFile(fileId: string): Promise<DownloadFileResult> {
  // 1. Check local storage
  if (fileId.startsWith('local_')) {
    try {
      const metaPath = path.join(LOCAL_STORAGE_DIR, `${fileId}.json`);
      if (fsSync.existsSync(metaPath)) {
        const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
        const filePath = path.join(LOCAL_STORAGE_DIR, meta.diskFilename);
        const buffer = await fs.readFile(filePath);
        return {
          buffer,
          mimeType: meta.mimeType || 'application/octet-stream',
          filename: meta.originalFilename,
        };
      }

      // Search by prefix
      const files = await fs.readdir(LOCAL_STORAGE_DIR);
      const match = files.find((f) => f.startsWith(`${fileId}__`));
      if (match) {
        const buffer = await fs.readFile(path.join(LOCAL_STORAGE_DIR, match));
        return {
          buffer,
          mimeType: 'application/octet-stream',
          filename: match.split('__')[1] || 'document',
        };
      }
    } catch (err) {
      logger.error('Failed reading file from local storage', { fileId, error: (err as Error).message });
    }
  }

  // 2. Download from Google Drive
  const drive = getDriveClient();
  if (drive) {
    try {
      const res = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
      );

      const meta = await drive.files.get({
        fileId,
        fields: 'name, mimeType',
        supportsAllDrives: true,
      });

      return {
        buffer: Buffer.from(res.data as ArrayBuffer),
        mimeType: meta.data.mimeType || 'application/octet-stream',
        filename: meta.data.name || undefined,
      };
    } catch (err) {
      logger.error('Failed downloading file from Google Drive', {
        fileId,
        error: (err as Error).message,
      });
      throw err;
    }
  }

  throw new Error(`Document file "${fileId}" not found in storage.`);
}

/**
 * Deletes a file by its fileId from whichever storage it was stored in
 */
export async function deleteFile(fileId: string): Promise<boolean> {
  let deleted = false;

  // 1. Check and delete from local storage
  if (fileId.startsWith('local_')) {
    try {
      const metaPath = path.join(LOCAL_STORAGE_DIR, `${fileId}.json`);
      if (fsSync.existsSync(metaPath)) {
        const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
        const filePath = path.join(LOCAL_STORAGE_DIR, meta.diskFilename);
        if (fsSync.existsSync(filePath)) {
          await fs.unlink(filePath);
        }
        await fs.unlink(metaPath);
        deleted = true;
      }
    } catch (err) {
      logger.warn('Failed deleting local file', { fileId, error: (err as Error).message });
    }
  }

  // 2. Delete from Google Drive if applicable
  const drive = getDriveClient();
  if (drive && !fileId.startsWith('local_')) {
    try {
      await drive.files.delete({ fileId, supportsAllDrives: true });
      deleted = true;
    } catch (err) {
      logger.warn('Failed deleting file from Google Drive', {
        fileId,
        error: (err as Error).message,
      });
    }
  }

  return deleted;
}
