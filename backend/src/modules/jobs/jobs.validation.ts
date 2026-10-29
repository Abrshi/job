import { z } from 'zod';
import { WorkArrangement, EmploymentType, ExperienceLevel } from '@prisma/client';

export const JobQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(36),
    search: z.string().trim().max(100).optional(),
    category: z.string().trim().max(100).optional(),
    source: z.string().trim().max(100).optional(),
    status: z.enum(['ACTIVE', 'EXPIRED', 'CLOSED', 'ARCHIVED', 'ALL']).optional(),
    city: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    workArrangement: z.nativeEnum(WorkArrangement).optional(),
    employmentType: z.nativeEnum(EmploymentType).optional(),
    experienceLevel: z.nativeEnum(ExperienceLevel).optional(),
    minSalary: z.coerce.number().min(0).optional(),
    maxSalary: z.coerce.number().min(0).optional(),
    sortBy: z.enum(['publishedAt', 'firstSeenAt', 'closingDate', 'salaryMax']).default('publishedAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const JobIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Job ID is required'),
  }),
});

export const ApplyJobSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Job ID is required'),
  }),
  body: z.object({
    coverNote: z
      .string()
      .trim()
      .max(3000, 'Application message must not exceed 3000 characters')
      .optional()
      .or(z.literal('')),
  }),
});

export const PaginationQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(36),
  }),
});

export type JobQueryInput = z.infer<typeof JobQuerySchema>['query'];
export type ApplyJobInput = z.infer<typeof ApplyJobSchema>['body'];

