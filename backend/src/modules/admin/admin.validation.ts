import { z } from 'zod';

export const updateJobStatusSchema = z.object({
  body: z.object({
    status: z.enum(['ACTIVE', 'EXPIRED', 'CLOSED', 'ARCHIVED']),
  }),
});

export const updateUserStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const updateUserRoleSchema = z.object({
  body: z.object({
    role: z.enum(['CANDIDATE', 'EMPLOYER', 'ADMIN']),
  }),
});

export const updateSiteSettingsSchema = z.object({
  body: z.object({
    siteName: z.string().min(1, 'Site name is required').max(100),
    tagline: z.string().max(255).optional(),
    description: z.string().max(2000).optional(),
    logoUrl: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
    faviconUrl: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
    supportEmail: z.string().email('Must be a valid email').or(z.literal('')).optional(),
    footerText: z.string().max(255).optional(),
  }),
});

export const overrideClassificationSchema = z.object({
  body: z.object({
    categoryId: z.string().uuid('Category ID must be a valid UUID').optional(),
    categorySlug: z.string().optional(),
    experienceLevel: z
      .enum(['ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE', 'UNSPECIFIED'])
      .optional(),
    explanation: z.string().max(500).optional(),
  }),
});

export const jobQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    search: z.string().optional(),
    sourceId: z.string().optional(),
    categoryId: z.string().optional(),
    country: z.string().optional(),
    isRemote: z
      .string()
      .transform((val) => val === 'true')
      .optional(),
    employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE']).optional(),
    experienceLevel: z.enum(['ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE', 'UNSPECIFIED']).optional(),
    status: z.enum(['ACTIVE', 'EXPIRED', 'CLOSED', 'ARCHIVED']).optional(),
    classificationStatus: z.enum(['PENDING', 'CLASSIFIED', 'FAILED', 'REVIEW_REQUIRED']).optional(),
    sortBy: z.enum(['publishedAt', 'firstSeenAt', 'closingDate', 'createdAt']).default('firstSeenAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const userQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    search: z.string().optional(),
    role: z.enum(['CANDIDATE', 'EMPLOYER', 'ADMIN']).optional(),
    isActive: z
      .string()
      .transform((val) => val === 'true')
      .optional(),
    isEmailVerified: z
      .string()
      .transform((val) => val === 'true')
      .optional(),
  }),
});
