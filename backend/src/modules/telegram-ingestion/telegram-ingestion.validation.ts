import { z } from 'zod';

export const IngestTelegramMessageSchema = z.object({
  body: z.object({
    channelId: z.string().min(1, 'channelId is required'),
    channelUsername: z.string().trim().optional(),
    channelTitle: z.string().trim().optional(),
    messageId: z.coerce.number().int().positive('messageId must be a positive integer'),
    originalText: z.string().min(1, 'originalText must not be empty'),
    publishedAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'publishedAt must be a valid ISO 8601 date string',
    }),
    detectedAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'detectedAt must be a valid ISO 8601 date string',
    }).optional(),
    sourceUrl: z.string().url().optional().or(z.literal('')),
    mediaMetadata: z.object({
      type: z.string().optional(),
      mimeType: z.string().optional(),
      sizeBytes: z.number().optional(),
      fileName: z.string().optional(),
      durationSeconds: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    }).optional(),
    rawPayload: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const RegisterTelegramChannelSchema = z.object({
  body: z.object({
    telegramChannelId: z.string().min(1, 'telegramChannelId is required'),
    username: z.string().trim().optional(),
    title: z.string().trim().min(1, 'title is required'),
    isActive: z.boolean().default(true),
    isAuthorized: z.boolean().default(true),
    authorizationRecord: z.string().trim().optional(),
  }),
});

export const UpdateTelegramChannelSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Channel ID is required'),
  }),
  body: z.object({
    isActive: z.boolean().optional(),
    isAuthorized: z.boolean().optional(),
    title: z.string().trim().min(1).optional(),
    username: z.string().trim().optional(),
    authorizationRecord: z.string().trim().optional(),
  }),
});
