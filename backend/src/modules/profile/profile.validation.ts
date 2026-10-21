import { z } from 'zod';
import { WorkArrangement, EmploymentType, ExperienceLevel } from '@prisma/client';

export const UpdateProfileSchema = z.object({
  body: z
    .object({
      firstName: z.string().trim().max(50).optional().nullable(),
      lastName: z.string().trim().max(50).optional().nullable(),
      displayName: z.string().trim().max(100).optional().nullable(),
      headline: z.string().trim().max(150).optional().nullable(),
      country: z.string().trim().max(100).optional().nullable(),
      city: z.string().trim().max(100).optional().nullable(),
      preferredWorkArrangement: z.nativeEnum(WorkArrangement).optional().nullable(),
      preferredEmploymentType: z.nativeEnum(EmploymentType).optional().nullable(),
      preferredExperienceLevel: z.nativeEnum(ExperienceLevel).optional().nullable(),
      minSalary: z.coerce.number().min(0).max(100000000).optional().nullable(),
      salaryCurrency: z.string().trim().max(10).optional().nullable(),
      preferredCategories: z.array(z.string().trim().max(100)).max(20).optional().nullable(),
      preferredLocations: z.array(z.string().trim().max(100)).max(20).optional().nullable(),
    })
    .strict(), // Reject any unexpected keys such as role, password, isEmailVerified
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>['body'];
