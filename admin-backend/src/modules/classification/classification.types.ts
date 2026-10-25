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

export const CATEGORY_NAME_TO_SLUG_MAP: Record<string, string> = {
  'software & it': 'software-it',
  'software and it': 'software-it',
  'software-it': 'software-it',
  'engineering & architecture': 'engineering-architecture',
  'engineering and architecture': 'engineering-architecture',
  'engineering-architecture': 'engineering-architecture',
  'healthcare & medicine': 'healthcare-medicine',
  'healthcare and medicine': 'healthcare-medicine',
  'healthcare-medicine': 'healthcare-medicine',
  'education & training': 'education-training',
  'education and training': 'education-training',
  'education-training': 'education-training',
  'finance & accounting': 'finance-accounting',
  'finance and accounting': 'finance-accounting',
  'finance-accounting': 'finance-accounting',
  'business & management': 'business-management',
  'business and management': 'business-management',
  'business-management': 'business-management',
  'sales & business development': 'sales-business-development',
  'sales and business development': 'sales-business-development',
  'sales-business-development': 'sales-business-development',
  'marketing & communications': 'marketing-communications',
  'marketing and communications': 'marketing-communications',
  'marketing-communications': 'marketing-communications',
  'customer service & support': 'customer-service-support',
  'customer service and support': 'customer-service-support',
  'customer-service-support': 'customer-service-support',
  'hr & recruitment': 'human-resources-recruitment',
  'human resources & recruitment': 'human-resources-recruitment',
  'human resources and recruitment': 'human-resources-recruitment',
  'human-resources-recruitment': 'human-resources-recruitment',
  'administration & office support': 'administration-office-support',
  'administration and office support': 'administration-office-support',
  'administration-office-support': 'administration-office-support',
  'legal & compliance': 'legal-compliance',
  'legal and compliance': 'legal-compliance',
  'legal-compliance': 'legal-compliance',
  'construction & real estate': 'construction-real-estate',
  'construction and real estate': 'construction-real-estate',
  'construction-real-estate': 'construction-real-estate',
  'manufacturing & industrial': 'manufacturing-industrial',
  'manufacturing and industrial': 'manufacturing-industrial',
  'manufacturing-industrial': 'manufacturing-industrial',
  'logistics & supply chain': 'logistics-supply-chain',
  'logistics and supply chain': 'logistics-supply-chain',
  'logistics-supply-chain': 'logistics-supply-chain',
  'agriculture & environment': 'agriculture-environment',
  'agriculture and environment': 'agriculture-environment',
  'agriculture-environment': 'agriculture-environment',
  'hospitality & tourism': 'hospitality-tourism',
  'hospitality and tourism': 'hospitality-tourism',
  'hospitality-tourism': 'hospitality-tourism',
  'media': 'media',
  'design & creative': 'design-creative',
  'design and creative': 'design-creative',
  'design-creative': 'design-creative',
  'media, design & creative': 'media-design-creative',
  'media, design and creative': 'media-design-creative',
  'media-design-creative': 'media-design-creative',
  'research & science': 'research-science',
  'research and science': 'research-science',
  'research-science': 'research-science',
  'ngo / development & social services': 'ngo-development-social-services',
  'ngo, development & social services': 'ngo-development-social-services',
  'ngo, development and social services': 'ngo-development-social-services',
  'ngo-development-social-services': 'ngo-development-social-services',
};

export function normalizeCategorySlug(input: string): string {
  if (!input) return 'business-management';
  const clean = input.trim().toLowerCase();
  return CATEGORY_NAME_TO_SLUG_MAP[clean] || clean;
}

export const ClassificationOutputSchema = z.object({
  categorySlug: z.string().min(1, 'Category slug is required'),
  primaryCategory: z.string().optional(),
  secondaryCategories: z.array(z.string()).default([]),
  experienceLevel: z.enum(VALID_EXPERIENCE_LEVELS),
  confidence: z.number().min(0).max(1),
  explanation: z.string().min(5, 'Evidence explanation must be at least 5 characters'),
  skills: z.array(z.string()).default([]),
  industry: z.string().optional(),
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
