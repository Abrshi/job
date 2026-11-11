import { TelegramMessageStatus } from '@prisma/client';

export interface TelegramMediaMetadata {
  type?: string;
  mimeType?: string;
  sizeBytes?: number;
  fileName?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
}

export interface IngestTelegramMessageDto {
  channelId: string;
  channelUsername?: string;
  channelTitle?: string;
  messageId: number;
  originalText: string;
  publishedAt: string; // ISO date string from Telegram message.date
  detectedAt?: string;  // ISO date string of worker receipt
  sourceUrl?: string;
  mediaMetadata?: TelegramMediaMetadata;
  rawPayload?: Record<string, unknown>;
}

export interface TelegramChannelDto {
  id?: string;
  telegramChannelId: string;
  username?: string;
  title: string;
  isActive?: boolean;
  isAuthorized?: boolean;
  authorizationRecord?: string;
  lastMessageId?: number;
  lastEventAt?: string;
}

export interface IngestionResult {
  success: boolean;
  duplicate: boolean;
  telegramMessageRecordId: string;
  processingStatus: TelegramMessageStatus;
  jobId?: string;
  error?: string;
}
