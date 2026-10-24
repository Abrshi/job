import { z } from 'zod';
import { GeneratedDocumentType } from '@prisma/client';

export const generateDocumentSchema = z
  .object({
    documentType: z.nativeEnum(GeneratedDocumentType),
    jobId: z.string().uuid().optional(),
    externalJob: z
      .object({
        title: z.string().trim().min(1, 'Target job title is required').max(255),
        companyName: z.string().trim().min(1, 'Target company name is required').max(255),
        description: z.string().trim().optional(),
        url: z.string().url().max(1000).optional().or(z.literal('')),
        location: z.string().max(255).optional(),
      })
      .optional(),
    applicationId: z.string().uuid().optional(),
    customInstructions: z.string().max(2000, 'Custom instructions cannot exceed 2000 characters').optional(),
  })
  .refine(
    (data) => Boolean(data.jobId || (data.externalJob && data.externalJob.title && data.externalJob.companyName)),
    {
      message: 'Either a valid platform jobId or externalJob details (title and companyName) must be provided.',
      path: ['jobId'],
    }
  );

export const saveVersionSchema = z.object({
  content: z.string().min(1, 'Document content cannot be empty'),
  structuredData: z.record(z.string(), z.any()).optional().nullable(),
  subjectLine: z.string().max(500).optional().nullable(),
  changeSummary: z.string().max(255).optional().nullable(),
});

export const attachApplicationSchema = z.object({
  applicationId: z.string().uuid('Valid application ID is required'),
  attachAs: z.enum(['CV', 'COVER_LETTER']),
});

export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  documentType: z.nativeEnum(GeneratedDocumentType).optional(),
  jobId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
});

export const exportQuerySchema = z.object({
  format: z.enum(['pdf', 'docx', 'txt']).default('pdf'),
});
