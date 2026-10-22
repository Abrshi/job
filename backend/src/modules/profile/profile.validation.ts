import { z } from 'zod';
import { WorkArrangement, EmploymentType, ExperienceLevel } from '@prisma/client';

export const UpdateProfileSchema = z.object({
  body: z
    .object({
      firstName: z.string().trim().max(50).optional().nullable(),
      lastName: z.string().trim().max(50).optional().nullable(),
      displayName: z.string().trim().max(100).optional().nullable(),
      preferredName: z.string().trim().max(100).optional().nullable(),
      headline: z.string().trim().max(150).optional().nullable(),
      phoneNumber: z.string().trim().max(50).optional().nullable(),
      professionalEmail: z.string().trim().email().max(100).optional().nullable().or(z.literal('')),
      country: z.string().trim().max(100).optional().nullable(),
      city: z.string().trim().max(100).optional().nullable(),
      summary: z.string().trim().max(3000).optional().nullable(),
      linkedInUrl: z.string().trim().max(255).optional().nullable().or(z.literal('')),
      githubUrl: z.string().trim().max(255).optional().nullable().or(z.literal('')),
      portfolioUrl: z.string().trim().max(255).optional().nullable().or(z.literal('')),
      otherLinks: z.array(z.string().trim().max(255)).max(10).optional().nullable(),
      preferredWorkArrangement: z.nativeEnum(WorkArrangement).optional().nullable(),
      preferredEmploymentType: z.nativeEnum(EmploymentType).optional().nullable(),
      preferredExperienceLevel: z.nativeEnum(ExperienceLevel).optional().nullable(),
      minSalary: z.coerce.number().min(0).max(100000000).optional().nullable(),
      maxSalary: z.coerce.number().min(0).max(100000000).optional().nullable(),
      salaryCurrency: z.string().trim().max(10).optional().nullable(),
      preferredJobTitles: z.array(z.string().trim().max(100)).max(20).optional().nullable(),
      preferredCategories: z.array(z.string().trim().max(100)).max(20).optional().nullable(),
      preferredLocations: z.array(z.string().trim().max(100)).max(20).optional().nullable(),
      availability: z.string().trim().max(100).optional().nullable(),
      onboardingCompleted: z.boolean().optional(),
    })
    .strict(), // Reject any unexpected keys such as role, password, isEmailVerified
});

export const ExperienceSchema = z.object({
  body: z
    .object({
      companyName: z.string().trim().min(1, 'Company or organization is required').max(150),
      jobTitle: z.string().trim().min(1, 'Job title is required').max(150),
      employmentType: z.nativeEnum(EmploymentType).optional().nullable(),
      location: z.string().trim().max(100).optional().nullable(),
      startDate: z.string().datetime().optional().nullable(),
      endDate: z.string().datetime().optional().nullable(),
      startYear: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
      startMonth: z.coerce.number().int().min(1).max(12).optional().nullable(),
      endYear: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
      endMonth: z.coerce.number().int().min(1).max(12).optional().nullable(),
      isCurrent: z.boolean().default(false),
      description: z.string().trim().max(3000).optional().nullable(),
      responsibilities: z.array(z.string().trim().max(500)).max(20).optional().nullable(),
      achievements: z.array(z.string().trim().max(500)).max(20).optional().nullable(),
      skillsUsed: z.array(z.string().trim().max(100)).max(30).optional().nullable(),
      relevantUrl: z.string().trim().max(255).optional().nullable().or(z.literal('')),
      order: z.number().int().optional(),
    })
    .strict(),
});

export const EducationSchema = z.object({
  body: z
    .object({
      institution: z.string().trim().min(1, 'Institution is required').max(150),
      degree: z.string().trim().max(150).optional().nullable(),
      fieldOfStudy: z.string().trim().max(150).optional().nullable(),
      startDate: z.string().datetime().optional().nullable(),
      endDate: z.string().datetime().optional().nullable(),
      startYear: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
      startMonth: z.coerce.number().int().min(1).max(12).optional().nullable(),
      endYear: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
      endMonth: z.coerce.number().int().min(1).max(12).optional().nullable(),
      isCurrent: z.boolean().default(false),
      grade: z.string().trim().max(50).optional().nullable(),
      description: z.string().trim().max(2000).optional().nullable(),
      relevantCoursework: z.array(z.string().trim().max(100)).max(20).optional().nullable(),
      location: z.string().trim().max(100).optional().nullable(),
      order: z.number().int().optional(),
    })
    .strict(),
});

export const CertificationSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'Certification name is required').max(150),
      issuingOrganization: z.string().trim().max(150).optional().nullable(),
      type: z.string().trim().max(50).default('CERTIFICATION'),
      issueDate: z.string().datetime().optional().nullable(),
      expiryDate: z.string().datetime().optional().nullable(),
      issueYear: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
      issueMonth: z.coerce.number().int().min(1).max(12).optional().nullable(),
      credentialId: z.string().trim().max(100).optional().nullable(),
      credentialUrl: z.string().trim().max(255).optional().nullable().or(z.literal('')),
      description: z.string().trim().max(2000).optional().nullable(),
      order: z.number().int().optional(),
    })
    .strict(),
});

export const ProjectSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'Project name is required').max(150),
      description: z.string().trim().max(3000).optional().nullable(),
      role: z.string().trim().max(100).optional().nullable(),
      startDate: z.string().datetime().optional().nullable(),
      endDate: z.string().datetime().optional().nullable(),
      startYear: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
      startMonth: z.coerce.number().int().min(1).max(12).optional().nullable(),
      endYear: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
      endMonth: z.coerce.number().int().min(1).max(12).optional().nullable(),
      isCurrent: z.boolean().default(false),
      technologies: z.array(z.string().trim().max(100)).max(30).optional().nullable(),
      responsibilities: z.array(z.string().trim().max(500)).max(20).optional().nullable(),
      achievements: z.array(z.string().trim().max(500)).max(20).optional().nullable(),
      liveUrl: z.string().trim().max(255).optional().nullable().or(z.literal('')),
      repoUrl: z.string().trim().max(255).optional().nullable().or(z.literal('')),
      order: z.number().int().optional(),
    })
    .strict(),
});

export const SkillSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'Skill name is required').max(100),
      category: z.string().trim().max(100).optional().nullable(),
      proficiency: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional().nullable(),
      yearsExperience: z.coerce.number().int().min(0).max(50).optional().nullable(),
    })
    .strict(),
});

export const BulkSkillSchema = z.object({
  body: z
    .object({
      skills: z.array(
        z.object({
          name: z.string().trim().min(1).max(100),
          category: z.string().trim().max(100).optional().nullable(),
          proficiency: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional().nullable(),
          yearsExperience: z.coerce.number().int().min(0).max(50).optional().nullable(),
        })
      ),
    })
    .strict(),
});

export const LanguageSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'Language name is required').max(100),
      proficiency: z.enum(['NATIVE', 'FLUENT', 'PROFICIENT', 'INTERMEDIATE', 'BASIC']).default('PROFICIENT'),
    })
    .strict(),
});

export const AchievementSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(1, 'Achievement title is required').max(150),
      type: z.string().trim().max(50).default('AWARD'),
      organization: z.string().trim().max(150).optional().nullable(),
      year: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
      month: z.coerce.number().int().min(1).max(12).optional().nullable(),
      description: z.string().trim().max(2000).optional().nullable(),
      relevantUrl: z.string().trim().max(255).optional().nullable().or(z.literal('')),
      order: z.number().int().optional(),
    })
    .strict(),
});

export const ConfirmExtractedProfileSchema = z.object({
  body: z
    .object({
      personal: z.record(z.string(), z.any()).optional(),
      experiences: z.array(z.record(z.string(), z.any())).optional(),
      educations: z.array(z.record(z.string(), z.any())).optional(),
      certifications: z.array(z.record(z.string(), z.any())).optional(),
      projects: z.array(z.record(z.string(), z.any())).optional(),
      skills: z.array(z.record(z.string(), z.any())).optional(),
      languages: z.array(z.record(z.string(), z.any())).optional(),
      achievements: z.array(z.record(z.string(), z.any())).optional(),
      jobPreferences: z.record(z.string(), z.any()).optional(),
      onboardingCompleted: z.boolean().default(true),
    })
    .strict(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>['body'];
