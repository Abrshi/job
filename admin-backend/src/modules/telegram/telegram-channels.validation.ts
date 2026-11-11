import { z } from 'zod';

export const RegisterTelegramChannelSchema = z.object({
  body: z.object({
    identifier: z.string().min(1, 'Username, link, or channel ID is required'),
    title: z.string().optional(),
    telegramChannelId: z.string().optional(),
    authorizationRecord: z
      .string()
      .min(10, 'Specific documented authorization evidence or reference is required (min 10 characters)'),
    explicitConsentConfirmation: z.literal(true, {
      message: 'You must explicitly confirm that the channel owner has authorized ingestion and processing.',
    }),
    isActive: z.boolean().optional().default(true),
  }),
});

export const UpdateTelegramChannelSchema = z.object({
  body: z.object({
    title: z.string().min(1).optional(),
    username: z.string().optional(),
    authorizationRecord: z.string().min(10).optional(),
    isActive: z.boolean().optional(),
    isAuthorized: z.boolean().optional(),
  }),
});

export const ListTelegramChannelsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    search: z.string().optional(),
    status: z.enum(['all', 'active', 'paused', 'unauthorized']).optional(),
  }),
});

export const ListTelegramMessagesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    channelId: z.string().optional(),
    status: z.enum(['PENDING', 'PROCESSED', 'DUPLICATE', 'FAILED', 'IGNORED']).optional(),
    search: z.string().optional(),
  }),
});

export const ToggleWorkerSchema = z.object({
  body: z.object({
    active: z.boolean(),
    confirmation: z.literal(true, {
      message: 'Explicit confirmation is required to change worker operational state.',
    }),
  }),
});
