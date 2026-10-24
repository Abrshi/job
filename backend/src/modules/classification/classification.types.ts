import { z } from 'zod';
import { ClassificationReviewStatus, ClassificationStatus, ExperienceLevel } from '@prisma/client';

export const VALID_EXPERIENCE_LEVELS: [ExperienceLevel, ...ExperienceLevel[]] = [
  'ENTRY',
  'JUNIOR',
  'MID',
  'SENIOR',
  'LEAD',
  'EXECUTIVE',
  'UNSPECIFIED',
];

export const ClassificationOutputSchema = z.object({
  categorySlug: z.string().min(1, 'Category slug is required'),
  experienceLevel: z.enum(VALID_EXPERIENCE_LEVELS),
  confidence: z.number().min(0).max(1),
  explanation: z.string().min(5, 'Evidence explanation must be at least 5 characters'),
  skills: z.array(z.string()).default([]),
});

export type ClassificationOutput = z.infer<typeof ClassificationOutputSchema>;

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,
  MEDIUM: 0.60,
};

export function evaluateClassificationStatus(confidence: number): {
  reviewStatus: ClassificationReviewStatus;
  jobStatus: ClassificationStatus;
} {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return {
      reviewStatus: 'AUTO_APPROVED',
      jobStatus: 'CLASSIFIED',
    };
  }

  return {
    reviewStatus: 'NEEDS_REVIEW',
    jobStatus: 'REVIEW_REQUIRED',
  };
}
