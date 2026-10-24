import { z } from 'zod';
import { WorkArrangement, EmploymentType, ExperienceLevel } from '@prisma/client';

export const CreateSavedSearchSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
    search: z.string().trim().max(100).optional().nullable(),
    categorySlug: z.string().trim().max(100).optional().nullable(),
    city: z.string().trim().max(100).optional().nullable(),
    country: z.string().trim().max(100).optional().nullable(),
    workArrangement: z.nativeEnum(WorkArrangement).optional().nullable(),
    remoteEligibility: z.string().trim().max(100).optional().nullable(),
    employmentType: z.nativeEnum(EmploymentType).optional().nullable(),
    experienceLevel: z.nativeEnum(ExperienceLevel).optional().nullable(),
    minSalary: z.coerce.number().min(0).optional().nullable(),
    maxSalary: z.coerce.number().min(0).optional().nullable(),
    currency: z.string().trim().max(10).default('ETB'),
    isAlertEnabled: z.boolean().default(true),
  }),
});

export const UpdateSavedSearchSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Saved search ID is required'),
  }),
  body: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    search: z.string().trim().max(100).optional().nullable(),
    categorySlug: z.string().trim().max(100).optional().nullable(),
    city: z.string().trim().max(100).optional().nullable(),
    country: z.string().trim().max(100).optional().nullable(),
    workArrangement: z.nativeEnum(WorkArrangement).optional().nullable(),
    remoteEligibility: z.string().trim().max(100).optional().nullable(),
    employmentType: z.nativeEnum(EmploymentType).optional().nullable(),
    experienceLevel: z.nativeEnum(ExperienceLevel).optional().nullable(),
    minSalary: z.coerce.number().min(0).optional().nullable(),
    maxSalary: z.coerce.number().min(0).optional().nullable(),
    currency: z.string().trim().max(10).optional(),
    isAlertEnabled: z.boolean().optional(),
  }),
});

export const SavedSearchIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Saved search ID is required'),
  }),
});

export const RunSavedSearchQuerySchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Saved search ID is required'),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export const NotificationQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    unreadOnly: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  }),
});

export const NotificationIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Notification ID is required'),
  }),
});

export type CreateSavedSearchInput = z.infer<typeof CreateSavedSearchSchema>['body'];
export type UpdateSavedSearchInput = z.infer<typeof UpdateSavedSearchSchema>['body'];
export type RunSavedSearchQuery = z.infer<typeof RunSavedSearchQuerySchema>['query'];
export type NotificationQueryInput = z.infer<typeof NotificationQuerySchema>['query'];

