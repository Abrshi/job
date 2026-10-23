import { z } from 'zod';
import { validateSafeUrl } from '../sources/sources.validation';

const safeUrlSchema = z
  .string()
  .max(1000)
  .optional()
  .refine(
    (url) => !url || validateSafeUrl(url),
    'URL must be a valid public HTTP or HTTPS web address without private network access.'
  );

export const ListApplicationsSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? Math.min(50, Math.max(1, parseInt(val, 10) || 15)) : 15)),
    status: z
      .enum(['ALL', 'ACTIVE', 'DRAFT', 'APPLIED', 'IN_REVIEW', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'])
      .optional()
      .default('ALL'),
    source: z.enum(['ALL', 'PLATFORM', 'EXTERNAL']).optional().default('ALL'),
    search: z.string().trim().max(100).optional(),
    sort: z.enum(['newest', 'oldest', 'next_interview', 'company_asc']).optional().default('newest'),
    archived: z
      .string()
      .optional()
      .transform((val) => val === 'true'),
  }),
});

export const ApplicationIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Application ID is required'),
  }),
});

export const CreateApplicationSchema = z.object({
  body: z
    .object({
      source: z.enum(['PLATFORM', 'EXTERNAL']).default('PLATFORM'),
      status: z.enum(['DRAFT', 'APPLIED']).default('APPLIED'),
      
      // Platform Job fields
      jobId: z.string().min(1).optional(),
      documentId: z.string().uuid().optional(),
      coverNoteText: z.string().max(10000).optional(),
      
      // External Job fields
      externalCompanyName: z.string().min(1).max(255).optional(),
      externalJobTitle: z.string().min(1).max(255).optional(),
      externalJobUrl: safeUrlSchema,
      externalLocation: z.string().max(255).optional(),
      externalSalary: z.string().max(100).optional(),
      appliedAt: z.string().datetime().optional(),
      
      // Common notes
      notes: z.string().max(5000).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.source === 'PLATFORM') {
        if (!data.jobId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'jobId is required for platform job applications.',
            path: ['jobId'],
          });
        }
      } else if (data.source === 'EXTERNAL') {
        if (!data.externalCompanyName || data.externalCompanyName.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Company name is required for external job tracking.',
            path: ['externalCompanyName'],
          });
        }
        if (!data.externalJobTitle || data.externalJobTitle.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Job title is required for external job tracking.',
            path: ['externalJobTitle'],
          });
        }
      }
    }),
});

export const UpdateApplicationSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    externalCompanyName: z.string().min(1).max(255).optional(),
    externalJobTitle: z.string().min(1).max(255).optional(),
    externalJobUrl: safeUrlSchema,
    externalLocation: z.string().max(255).optional(),
    externalSalary: z.string().max(100).optional(),
    appliedAt: z.string().datetime().optional(),
    documentId: z.string().uuid().optional(),
    coverNoteText: z.string().max(10000).optional(),
    notes: z.string().max(5000).optional(),
    isArchived: z.boolean().optional(),
  }),
});

export const UpdateStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    status: z.enum([
      'DRAFT',
      'APPLIED',
      'IN_REVIEW',
      'INTERVIEW',
      'OFFER',
      'REJECTED',
      'WITHDRAWN',
    ]),
    reason: z.string().max(500).optional(),
  }),
});

export const WithdrawApplicationSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z
    .object({
      reason: z.string().max(500).optional(),
    })
    .optional(),
});

export const InterviewParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1),
    interviewId: z.string().min(1),
  }),
});

export const CreateInterviewSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    roundNumber: z.number().int().min(1).max(50).optional(),
    title: z.string().min(1, 'Interview title is required').max(255),
    interviewType: z
      .enum(['PHONE', 'VIDEO', 'IN_PERSON', 'TAKE_HOME', 'OTHER'])
      .default('VIDEO'),
    scheduledAt: z.string().datetime({ message: 'Valid ISO-8601 scheduled date-time is required.' }),
    timezone: z.string().min(1).max(100).default('UTC'),
    durationMinutes: z.number().int().min(5).max(480).default(60).optional(),
    locationUrl: safeUrlSchema,
    interviewerInfo: z.string().max(500).optional(),
    preparationNotes: z.string().max(5000).optional(),
    feedbackNotes: z.string().max(5000).optional(),
    outcome: z.enum(['PENDING', 'PASSED', 'FAILED', 'CANCELLED']).default('PENDING').optional(),
  }),
});

export const UpdateInterviewSchema = z.object({
  params: z.object({
    id: z.string().min(1),
    interviewId: z.string().min(1),
  }),
  body: z.object({
    roundNumber: z.number().int().min(1).max(50).optional(),
    title: z.string().min(1).max(255).optional(),
    interviewType: z.enum(['PHONE', 'VIDEO', 'IN_PERSON', 'TAKE_HOME', 'OTHER']).optional(),
    scheduledAt: z.string().datetime().optional(),
    timezone: z.string().min(1).max(100).optional(),
    durationMinutes: z.number().int().min(5).max(480).optional(),
    locationUrl: safeUrlSchema,
    interviewerInfo: z.string().max(500).optional(),
    preparationNotes: z.string().max(5000).optional(),
    feedbackNotes: z.string().max(5000).optional(),
    outcome: z.enum(['PENDING', 'PASSED', 'FAILED', 'CANCELLED']).optional(),
  }),
});

export const ReminderParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1),
    reminderId: z.string().min(1),
  }),
});

export const CreateReminderSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    title: z.string().min(1, 'Reminder title is required').max(255),
    remindAt: z.string().datetime({ message: 'Valid ISO-8601 remind-at date is required.' }),
    notes: z.string().max(2000).optional(),
  }),
});

export const UpdateReminderSchema = z.object({
  params: z.object({
    id: z.string().min(1),
    reminderId: z.string().min(1),
  }),
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    remindAt: z.string().datetime().optional(),
    isCompleted: z.boolean().optional(),
    notes: z.string().max(2000).optional(),
  }),
});
