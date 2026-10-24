import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { profileCompletionService } from './profile-completion.service';
import { uploadFile, downloadFile, deleteFile } from '../../lib/storage/uploader';
import { logger } from '../../lib/logger';
import { Prisma } from '@prisma/client';

export class ProfileService {
  /**
   * Helper to ensure user profile exists and return its internal ID
   */
  async ensureProfileId(userId: string): Promise<string> {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (profile) return profile.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const newProfile = await prisma.userProfile.create({
      data: {
        userId,
        displayName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null,
      },
      select: { id: true },
    });
    return newProfile.id;
  }

  /**
   * Retrieve comprehensive profile with all normalized relational sections and completion report
   */
  async getProfile(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        profile: {
          include: {
            experiences: {
              orderBy: [{ order: 'asc' }, { startYear: 'desc' }, { createdAt: 'desc' }],
            },
            educations: {
              orderBy: [{ order: 'asc' }, { startYear: 'desc' }, { createdAt: 'desc' }],
            },
            certifications: {
              orderBy: [{ order: 'asc' }, { issueYear: 'desc' }, { createdAt: 'desc' }],
            },
            projects: {
              orderBy: [{ order: 'asc' }, { startYear: 'desc' }, { createdAt: 'desc' }],
            },
            skills: {
              orderBy: { name: 'asc' },
            },
            languages: {
              orderBy: { name: 'asc' },
            },
            achievements: {
              orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
            },
          },
        },
      },
    });

    if (!user) {
      throw AppError.notFound('User account not found', 'USER_NOT_FOUND');
    }

    let profile = user.profile;
    if (!profile) {
      await this.ensureProfileId(userId);
      return this.getProfile(userId);
    }

    // Calculate completion dynamically
    const completion = profileCompletionService.calculateCompletion({
      ...profile,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });

    // Sync completion percentage to database if changed
    if (profile.completionPercentage !== completion.percentage) {
      await prisma.userProfile.update({
        where: { id: profile.id },
        data: { completionPercentage: completion.percentage },
      });
      profile.completionPercentage = completion.percentage;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      profileId: profile.id,
      displayName: profile.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
      preferredName: profile.preferredName,
      headline: profile.headline,
      avatarUrl: profile.avatarUrl || null,
      avatarFileId: profile.avatarFileId || null,
      phoneNumber: profile.phoneNumber,
      professionalEmail: profile.professionalEmail,
      country: profile.country,
      city: profile.city,
      summary: profile.summary,
      linkedInUrl: profile.linkedInUrl,
      githubUrl: profile.githubUrl,
      portfolioUrl: profile.portfolioUrl,
      otherLinks: (profile.otherLinks as string[]) || [],
      preferredWorkArrangement: profile.preferredWorkArrangement,
      preferredEmploymentType: profile.preferredEmploymentType,
      preferredExperienceLevel: profile.preferredExperienceLevel,
      minSalary: profile.minSalary ? Number(profile.minSalary) : null,
      maxSalary: profile.maxSalary ? Number(profile.maxSalary) : null,
      salaryCurrency: profile.salaryCurrency || 'ETB',
      preferredJobTitles: (profile.preferredJobTitles as string[]) || [],
      preferredCategories: (profile.preferredCategories as string[]) || [],
      preferredLocations: (profile.preferredLocations as string[]) || [],
      availability: profile.availability,
      onboardingCompleted: profile.onboardingCompleted,
      completionPercentage: profile.completionPercentage,
      completion,
      experiences: profile.experiences,
      educations: profile.educations,
      certifications: profile.certifications,
      projects: profile.projects,
      skills: profile.skills,
      languages: profile.languages,
      achievements: profile.achievements,
      updatedAt: profile.updatedAt,
    };
  }

  /**
   * Update personal details and preferences
   */
  async updateProfile(userId: string, data: any) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw AppError.notFound('User account not found', 'USER_NOT_FOUND');
    }

    // 1. Update basic user details if provided
    const userUpdate: Prisma.UserUpdateInput = {};
    if (data.firstName !== undefined) userUpdate.firstName = data.firstName;
    if (data.lastName !== undefined) userUpdate.lastName = data.lastName;

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: userUpdate,
      });
    }

    // 2. Prepare profile payload
    const profileData: Prisma.UserProfileUpdateInput = {};
    if (data.displayName !== undefined) profileData.displayName = data.displayName;
    if (data.preferredName !== undefined) profileData.preferredName = data.preferredName;
    if (data.headline !== undefined) profileData.headline = data.headline;
    if (data.phoneNumber !== undefined) profileData.phoneNumber = data.phoneNumber;
    if (data.professionalEmail !== undefined) profileData.professionalEmail = data.professionalEmail;
    if (data.country !== undefined) profileData.country = data.country;
    if (data.city !== undefined) profileData.city = data.city;
    if (data.summary !== undefined) profileData.summary = data.summary;
    if (data.linkedInUrl !== undefined) profileData.linkedInUrl = data.linkedInUrl;
    if (data.githubUrl !== undefined) profileData.githubUrl = data.githubUrl;
    if (data.portfolioUrl !== undefined) profileData.portfolioUrl = data.portfolioUrl;
    if (data.availability !== undefined) profileData.availability = data.availability;
    if (data.onboardingCompleted !== undefined) profileData.onboardingCompleted = data.onboardingCompleted;

    if (data.otherLinks !== undefined) {
      profileData.otherLinks = data.otherLinks ? (data.otherLinks as Prisma.InputJsonValue) : Prisma.DbNull;
    }
    if (data.preferredWorkArrangement !== undefined) {
      profileData.preferredWorkArrangement = data.preferredWorkArrangement;
    }
    if (data.preferredEmploymentType !== undefined) {
      profileData.preferredEmploymentType = data.preferredEmploymentType;
    }
    if (data.preferredExperienceLevel !== undefined) {
      profileData.preferredExperienceLevel = data.preferredExperienceLevel;
    }
    if (data.minSalary !== undefined) {
      profileData.minSalary = data.minSalary !== null ? new Prisma.Decimal(data.minSalary) : null;
    }
    if (data.maxSalary !== undefined) {
      profileData.maxSalary = data.maxSalary !== null ? new Prisma.Decimal(data.maxSalary) : null;
    }
    if (data.salaryCurrency !== undefined) {
      profileData.salaryCurrency = data.salaryCurrency;
    }
    if (data.preferredJobTitles !== undefined) {
      profileData.preferredJobTitles = data.preferredJobTitles
        ? (data.preferredJobTitles as Prisma.InputJsonValue)
        : Prisma.DbNull;
    }
    if (data.preferredCategories !== undefined) {
      profileData.preferredCategories = data.preferredCategories
        ? (data.preferredCategories as Prisma.InputJsonValue)
        : Prisma.DbNull;
    }
    if (data.preferredLocations !== undefined) {
      profileData.preferredLocations = data.preferredLocations
        ? (data.preferredLocations as Prisma.InputJsonValue)
        : Prisma.DbNull;
    }

    await prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: data.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
        headline: data.headline,
        phoneNumber: data.phoneNumber,
        professionalEmail: data.professionalEmail,
        country: data.country,
        city: data.city,
        summary: data.summary,
        linkedInUrl: data.linkedInUrl,
        githubUrl: data.githubUrl,
        portfolioUrl: data.portfolioUrl,
        otherLinks: data.otherLinks ? (data.otherLinks as Prisma.InputJsonValue) : Prisma.DbNull,
        preferredWorkArrangement: data.preferredWorkArrangement,
        preferredEmploymentType: data.preferredEmploymentType,
        preferredExperienceLevel: data.preferredExperienceLevel,
        minSalary: data.minSalary !== null && data.minSalary !== undefined ? new Prisma.Decimal(data.minSalary) : null,
        maxSalary: data.maxSalary !== null && data.maxSalary !== undefined ? new Prisma.Decimal(data.maxSalary) : null,
        salaryCurrency: data.salaryCurrency || 'ETB',
        preferredJobTitles: data.preferredJobTitles ? (data.preferredJobTitles as Prisma.InputJsonValue) : Prisma.DbNull,
        preferredCategories: data.preferredCategories ? (data.preferredCategories as Prisma.InputJsonValue) : Prisma.DbNull,
        preferredLocations: data.preferredLocations ? (data.preferredLocations as Prisma.InputJsonValue) : Prisma.DbNull,
        availability: data.availability,
        onboardingCompleted: data.onboardingCompleted || false,
      },
      update: profileData,
    });

    return this.getProfile(userId);
  }

  /**
   * Confirm and import reviewed CV extraction data into relational tables
   */
  async confirmExtractedProfile(userId: string, confirmedData: any) {
    const profileId = await this.ensureProfileId(userId);

    // 1. Transactional import
    await prisma.$transaction(async (tx) => {
      // A. Update personal fields if present in confirmation
      if (confirmedData.personal) {
        const p = confirmedData.personal;
        const personalUpdate: Prisma.UserProfileUpdateInput = {
          onboardingCompleted: true,
        };
        if (p.fullName) personalUpdate.displayName = p.fullName;
        if (p.preferredName) personalUpdate.preferredName = p.preferredName;
        if (p.headline) personalUpdate.headline = p.headline;
        if (p.phoneNumber) personalUpdate.phoneNumber = p.phoneNumber;
        if (p.professionalEmail) personalUpdate.professionalEmail = p.professionalEmail;
        if (p.city) personalUpdate.city = p.city;
        if (p.country) personalUpdate.country = p.country;
        if (p.summary) personalUpdate.summary = p.summary;
        if (p.linkedInUrl) personalUpdate.linkedInUrl = p.linkedInUrl;
        if (p.githubUrl) personalUpdate.githubUrl = p.githubUrl;
        if (p.portfolioUrl) personalUpdate.portfolioUrl = p.portfolioUrl;

        await tx.userProfile.update({
          where: { id: profileId },
          data: personalUpdate,
        });
      }

      // B. Work Experiences
      if (Array.isArray(confirmedData.experiences) && confirmedData.experiences.length > 0) {
        for (let i = 0; i < confirmedData.experiences.length; i++) {
          const exp = confirmedData.experiences[i];
          if (exp.companyName && exp.jobTitle) {
            await tx.profileExperience.create({
              data: {
                profileId,
                companyName: exp.companyName,
                jobTitle: exp.jobTitle,
                employmentType: exp.employmentType || null,
                location: exp.location || null,
                startYear: exp.startYear ? Number(exp.startYear) : null,
                startMonth: exp.startMonth ? Number(exp.startMonth) : null,
                endYear: exp.endYear ? Number(exp.endYear) : null,
                endMonth: exp.endMonth ? Number(exp.endMonth) : null,
                isCurrent: Boolean(exp.isCurrent),
                description: exp.description || null,
                responsibilities: exp.responsibilities || null,
                achievements: exp.achievements || null,
                skillsUsed: exp.skillsUsed || null,
                provenance: 'CV_EXTRACTED',
                order: i,
              },
            });
          }
        }
      }

      // C. Educations
      if (Array.isArray(confirmedData.educations) && confirmedData.educations.length > 0) {
        for (let i = 0; i < confirmedData.educations.length; i++) {
          const edu = confirmedData.educations[i];
          if (edu.institution) {
            await tx.profileEducation.create({
              data: {
                profileId,
                institution: edu.institution,
                degree: edu.degree || null,
                fieldOfStudy: edu.fieldOfStudy || null,
                startYear: edu.startYear ? Number(edu.startYear) : null,
                startMonth: edu.startMonth ? Number(edu.startMonth) : null,
                endYear: edu.endYear ? Number(edu.endYear) : null,
                endMonth: edu.endMonth ? Number(edu.endMonth) : null,
                isCurrent: Boolean(edu.isCurrent),
                grade: edu.grade || null,
                description: edu.description || null,
                location: edu.location || null,
                provenance: 'CV_EXTRACTED',
                order: i,
              },
            });
          }
        }
      }

      // D. Certifications
      if (Array.isArray(confirmedData.certifications) && confirmedData.certifications.length > 0) {
        for (let i = 0; i < confirmedData.certifications.length; i++) {
          const cert = confirmedData.certifications[i];
          if (cert.name) {
            await tx.profileCertification.create({
              data: {
                profileId,
                name: cert.name,
                issuingOrganization: cert.issuingOrganization || null,
                type: cert.type || 'CERTIFICATION',
                issueYear: cert.issueYear ? Number(cert.issueYear) : null,
                issueMonth: cert.issueMonth ? Number(cert.issueMonth) : null,
                credentialUrl: cert.credentialUrl || null,
                description: cert.description || null,
                provenance: 'CV_EXTRACTED',
                order: i,
              },
            });
          }
        }
      }

      // E. Projects
      if (Array.isArray(confirmedData.projects) && confirmedData.projects.length > 0) {
        for (let i = 0; i < confirmedData.projects.length; i++) {
          const proj = confirmedData.projects[i];
          if (proj.name) {
            await tx.profileProject.create({
              data: {
                profileId,
                name: proj.name,
                role: proj.role || null,
                description: proj.description || null,
                startYear: proj.startYear ? Number(proj.startYear) : null,
                endYear: proj.endYear ? Number(proj.endYear) : null,
                isCurrent: Boolean(proj.isCurrent),
                technologies: proj.technologies || null,
                liveUrl: proj.liveUrl || null,
                repoUrl: proj.repoUrl || null,
                provenance: 'CV_EXTRACTED',
                order: i,
              },
            });
          }
        }
      }

      // F. Skills (avoiding duplicate names)
      if (Array.isArray(confirmedData.skills) && confirmedData.skills.length > 0) {
        for (const skill of confirmedData.skills) {
          const name = (skill.name || skill).toString().trim();
          if (name) {
            await tx.profileSkill.upsert({
              where: {
                profileId_name: {
                  profileId,
                  name,
                },
              },
              create: {
                profileId,
                name,
                category: skill.category || 'General',
                proficiency: skill.proficiency || null,
                provenance: 'CV_EXTRACTED',
              },
              update: {},
            });
          }
        }
      }

      // G. Languages
      if (Array.isArray(confirmedData.languages) && confirmedData.languages.length > 0) {
        for (const lang of confirmedData.languages) {
          const name = (lang.name || lang).toString().trim();
          if (name) {
            await tx.profileLanguage.upsert({
              where: {
                profileId_name: {
                  profileId,
                  name,
                },
              },
              create: {
                profileId,
                name,
                proficiency: lang.proficiency || 'PROFICIENT',
                provenance: 'CV_EXTRACTED',
              },
              update: {},
            });
          }
        }
      }

      // H. Achievements
      if (Array.isArray(confirmedData.achievements) && confirmedData.achievements.length > 0) {
        for (let i = 0; i < confirmedData.achievements.length; i++) {
          const ach = confirmedData.achievements[i];
          if (ach.title) {
            await tx.profileAchievement.create({
              data: {
                profileId,
                title: ach.title,
                organization: ach.organization || null,
                year: ach.year ? Number(ach.year) : null,
                description: ach.description || null,
                provenance: 'CV_EXTRACTED',
                order: i,
              },
            });
          }
        }
      }

      // I. Preferences
      if (confirmedData.jobPreferences) {
        const pref = confirmedData.jobPreferences;
        const prefUpdate: Prisma.UserProfileUpdateInput = {};
        if (pref.preferredWorkArrangement) prefUpdate.preferredWorkArrangement = pref.preferredWorkArrangement;
        if (pref.preferredEmploymentType) prefUpdate.preferredEmploymentType = pref.preferredEmploymentType;
        if (pref.preferredJobTitles) prefUpdate.preferredJobTitles = pref.preferredJobTitles;
        if (pref.minSalary) prefUpdate.minSalary = new Prisma.Decimal(pref.minSalary);

        await tx.userProfile.update({
          where: { id: profileId },
          data: prefUpdate,
        });
      }
    });

    return this.getProfile(userId);
  }

  // ==========================================
  // SECTION CRUD OPERATIONS (with ownership check)
  // ==========================================

  // --- Experience ---
  async addExperience(userId: string, data: any) {
    const profileId = await this.ensureProfileId(userId);
    const count = await prisma.profileExperience.count({ where: { profileId } });

    const exp = await prisma.profileExperience.create({
      data: {
        profileId,
        companyName: data.companyName,
        jobTitle: data.jobTitle,
        employmentType: data.employmentType || null,
        location: data.location || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        startYear: data.startYear || null,
        startMonth: data.startMonth || null,
        endYear: data.endYear || null,
        endMonth: data.endMonth || null,
        isCurrent: Boolean(data.isCurrent),
        description: data.description || null,
        responsibilities: data.responsibilities || null,
        achievements: data.achievements || null,
        skillsUsed: data.skillsUsed || null,
        relevantUrl: data.relevantUrl || null,
        order: data.order !== undefined ? data.order : count,
        provenance: 'MANUAL',
      },
    });

    await this.getProfile(userId); // Updates completion
    return exp;
  }

  async updateExperience(userId: string, experienceId: string, data: any) {
    const profileId = await this.ensureProfileId(userId);
    const existing = await prisma.profileExperience.findUnique({ where: { id: experienceId } });
    if (!existing || existing.profileId !== profileId) {
      throw AppError.notFound('Experience record not found');
    }

    const updated = await prisma.profileExperience.update({
      where: { id: experienceId },
      data: {
        companyName: data.companyName !== undefined ? data.companyName : existing.companyName,
        jobTitle: data.jobTitle !== undefined ? data.jobTitle : existing.jobTitle,
        employmentType: data.employmentType !== undefined ? data.employmentType : existing.employmentType,
        location: data.location !== undefined ? data.location : existing.location,
        startYear: data.startYear !== undefined ? data.startYear : existing.startYear,
        startMonth: data.startMonth !== undefined ? data.startMonth : existing.startMonth,
        endYear: data.endYear !== undefined ? data.endYear : existing.endYear,
        endMonth: data.endMonth !== undefined ? data.endMonth : existing.endMonth,
        isCurrent: data.isCurrent !== undefined ? data.isCurrent : existing.isCurrent,
        description: data.description !== undefined ? data.description : existing.description,
        responsibilities: data.responsibilities !== undefined ? data.responsibilities : existing.responsibilities,
        achievements: data.achievements !== undefined ? data.achievements : existing.achievements,
        skillsUsed: data.skillsUsed !== undefined ? data.skillsUsed : existing.skillsUsed,
        relevantUrl: data.relevantUrl !== undefined ? data.relevantUrl : existing.relevantUrl,
        order: data.order !== undefined ? data.order : existing.order,
      },
    });

    await this.getProfile(userId);
    return updated;
  }

  async deleteExperience(userId: string, experienceId: string) {
    const profileId = await this.ensureProfileId(userId);
    const existing = await prisma.profileExperience.findUnique({ where: { id: experienceId } });
    if (!existing || existing.profileId !== profileId) {
      throw AppError.notFound('Experience record not found');
    }

    await prisma.profileExperience.delete({ where: { id: experienceId } });
    await this.getProfile(userId);
    return { success: true };
  }

  // --- Education ---
  async addEducation(userId: string, data: any) {
    const profileId = await this.ensureProfileId(userId);
    const count = await prisma.profileEducation.count({ where: { profileId } });

    const edu = await prisma.profileEducation.create({
      data: {
        profileId,
        institution: data.institution,
        degree: data.degree || null,
        fieldOfStudy: data.fieldOfStudy || null,
        startYear: data.startYear || null,
        startMonth: data.startMonth || null,
        endYear: data.endYear || null,
        endMonth: data.endMonth || null,
        isCurrent: Boolean(data.isCurrent),
        grade: data.grade || null,
        description: data.description || null,
        relevantCoursework: data.relevantCoursework || null,
        location: data.location || null,
        order: data.order !== undefined ? data.order : count,
        provenance: 'MANUAL',
      },
    });

    await this.getProfile(userId);
    return edu;
  }

  async updateEducation(userId: string, educationId: string, data: any) {
    const profileId = await this.ensureProfileId(userId);
    const existing = await prisma.profileEducation.findUnique({ where: { id: educationId } });
    if (!existing || existing.profileId !== profileId) {
      throw AppError.notFound('Education record not found');
    }

    const updated = await prisma.profileEducation.update({
      where: { id: educationId },
      data,
    });

    await this.getProfile(userId);
    return updated;
  }

  async deleteEducation(userId: string, educationId: string) {
    const profileId = await this.ensureProfileId(userId);
    const existing = await prisma.profileEducation.findUnique({ where: { id: educationId } });
    if (!existing || existing.profileId !== profileId) {
      throw AppError.notFound('Education record not found');
    }

    await prisma.profileEducation.delete({ where: { id: educationId } });
    await this.getProfile(userId);
    return { success: true };
  }

  // --- Certification ---
  async addCertification(userId: string, data: any) {
    const profileId = await this.ensureProfileId(userId);
    const count = await prisma.profileCertification.count({ where: { profileId } });

    const cert = await prisma.profileCertification.create({
      data: {
        profileId,
        name: data.name,
        issuingOrganization: data.issuingOrganization || null,
        type: data.type || 'CERTIFICATION',
        issueYear: data.issueYear || null,
        issueMonth: data.issueMonth || null,
        credentialId: data.credentialId || null,
        credentialUrl: data.credentialUrl || null,
        description: data.description || null,
        order: data.order !== undefined ? data.order : count,
        provenance: 'MANUAL',
      },
    });

    await this.getProfile(userId);
    return cert;
  }

  async deleteCertification(userId: string, certId: string) {
    const profileId = await this.ensureProfileId(userId);
    const existing = await prisma.profileCertification.findUnique({ where: { id: certId } });
    if (!existing || existing.profileId !== profileId) {
      throw AppError.notFound('Certification not found');
    }

    await prisma.profileCertification.delete({ where: { id: certId } });
    await this.getProfile(userId);
    return { success: true };
  }

  // --- Project ---
  async addProject(userId: string, data: any) {
    const profileId = await this.ensureProfileId(userId);
    const count = await prisma.profileProject.count({ where: { profileId } });

    const proj = await prisma.profileProject.create({
      data: {
        profileId,
        name: data.name,
        description: data.description || null,
        role: data.role || null,
        startYear: data.startYear || null,
        endYear: data.endYear || null,
        isCurrent: Boolean(data.isCurrent),
        technologies: data.technologies || null,
        responsibilities: data.responsibilities || null,
        achievements: data.achievements || null,
        liveUrl: data.liveUrl || null,
        repoUrl: data.repoUrl || null,
        order: data.order !== undefined ? data.order : count,
        provenance: 'MANUAL',
      },
    });

    await this.getProfile(userId);
    return proj;
  }

  async deleteProject(userId: string, projectId: string) {
    const profileId = await this.ensureProfileId(userId);
    const existing = await prisma.profileProject.findUnique({ where: { id: projectId } });
    if (!existing || existing.profileId !== profileId) {
      throw AppError.notFound('Project record not found');
    }

    await prisma.profileProject.delete({ where: { id: projectId } });
    await this.getProfile(userId);
    return { success: true };
  }

  // --- Skills ---
  async addSkill(userId: string, data: any) {
    const profileId = await this.ensureProfileId(userId);
    const skill = await prisma.profileSkill.upsert({
      where: {
        profileId_name: {
          profileId,
          name: data.name.trim(),
        },
      },
      create: {
        profileId,
        name: data.name.trim(),
        category: data.category || 'General',
        proficiency: data.proficiency || null,
        yearsExperience: data.yearsExperience || null,
        provenance: 'MANUAL',
      },
      update: {
        category: data.category || undefined,
        proficiency: data.proficiency || undefined,
        yearsExperience: data.yearsExperience || undefined,
      },
    });

    await this.getProfile(userId);
    return skill;
  }

  async deleteSkill(userId: string, skillId: string) {
    const profileId = await this.ensureProfileId(userId);
    const existing = await prisma.profileSkill.findUnique({ where: { id: skillId } });
    if (!existing || existing.profileId !== profileId) {
      throw AppError.notFound('Skill record not found');
    }

    await prisma.profileSkill.delete({ where: { id: skillId } });
    await this.getProfile(userId);
    return { success: true };
  }

  // --- Languages ---
  async addLanguage(userId: string, data: any) {
    const profileId = await this.ensureProfileId(userId);
    const lang = await prisma.profileLanguage.upsert({
      where: {
        profileId_name: {
          profileId,
          name: data.name.trim(),
        },
      },
      create: {
        profileId,
        name: data.name.trim(),
        proficiency: data.proficiency || 'PROFICIENT',
        provenance: 'MANUAL',
      },
      update: {
        proficiency: data.proficiency || undefined,
      },
    });

    await this.getProfile(userId);
    return lang;
  }

  async deleteLanguage(userId: string, langId: string) {
    const profileId = await this.ensureProfileId(userId);
    const existing = await prisma.profileLanguage.findUnique({ where: { id: langId } });
    if (!existing || existing.profileId !== profileId) {
      throw AppError.notFound('Language record not found');
    }

    await prisma.profileLanguage.delete({ where: { id: langId } });
    await this.getProfile(userId);
    return { success: true };
  }

  // --- Achievements ---
  async addAchievement(userId: string, data: any) {
    const profileId = await this.ensureProfileId(userId);
    const count = await prisma.profileAchievement.count({ where: { profileId } });

    const ach = await prisma.profileAchievement.create({
      data: {
        profileId,
        title: data.title,
        type: data.type || 'AWARD',
        organization: data.organization || null,
        year: data.year || null,
        month: data.month || null,
        description: data.description || null,
        relevantUrl: data.relevantUrl || null,
        order: data.order !== undefined ? data.order : count,
        provenance: 'MANUAL',
      },
    });

    await this.getProfile(userId);
    return ach;
  }

  async deleteAchievement(userId: string, achievementId: string) {
    const profileId = await this.ensureProfileId(userId);
    const existing = await prisma.profileAchievement.findUnique({ where: { id: achievementId } });
    if (!existing || existing.profileId !== profileId) {
      throw AppError.notFound('Achievement not found');
    }

    await prisma.profileAchievement.delete({ where: { id: achievementId } });
    await this.getProfile(userId);
    return { success: true };
  }

  // --- Profile Picture (Avatar) Management ---

  /**
   * Validate and upload user profile picture, updating UserProfile with proxy URL
   */
  async uploadAvatar(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number }
  ) {
    if (!file || !file.buffer) {
      throw AppError.badRequest('No image file provided', 'IMAGE_REQUIRED');
    }

    // Maximum file size: 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.buffer.length > MAX_SIZE) {
      throw AppError.badRequest('Profile picture size exceeds maximum limit of 5MB', 'IMAGE_TOO_LARGE');
    }

    // Validate MIME and magic signature bytes
    const ext = this.validateImageSignature(file.buffer, file.mimetype);

    // Fetch existing profile to check for previous avatar
    const existing = await prisma.userProfile.findUnique({
      where: { userId },
      select: { id: true, avatarFileId: true },
    });

    const filename = `avatar_${userId}_${Date.now()}.${ext}`;

    // Upload using unified uploader (Google Drive with local storage fallback)
    const uploadResult = await uploadFile({
      buffer: file.buffer,
      filename,
      mimeType: file.mimetype,
    });

    const avatarUrl = `/api/v1/profile/avatar/${userId}`;

    await prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        avatarFileId: uploadResult.fileId,
        avatarUrl,
      },
      update: {
        avatarFileId: uploadResult.fileId,
        avatarUrl,
      },
      select: {
        id: true,
        avatarUrl: true,
        avatarFileId: true,
      },
    });

    // Cleanup previous avatar file if exists
    if (existing?.avatarFileId && existing.avatarFileId !== uploadResult.fileId) {
      deleteFile(existing.avatarFileId).catch((err) => {
        logger.warn('Failed deleting previous avatar from storage', {
          oldFileId: existing.avatarFileId,
          error: (err as Error).message,
        });
      });
    }

    return {
      avatarUrl,
      fileId: uploadResult.fileId,
      storageProvider: uploadResult.storageProvider,
    };
  }

  /**
   * Retrieve avatar image stream for the backend proxy
   */
  async getAvatarStream(
    userId: string
  ): Promise<{ buffer: Buffer; mimeType: string; filename?: string } | null> {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { avatarFileId: true },
    });

    if (!profile || !profile.avatarFileId) {
      return null;
    }

    try {
      return await downloadFile(profile.avatarFileId);
    } catch (err) {
      logger.error('Failed to retrieve avatar file', {
        userId,
        avatarFileId: profile.avatarFileId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Delete user avatar and clear profile fields
   */
  async deleteAvatar(userId: string): Promise<boolean> {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { avatarFileId: true },
    });

    if (!profile || !profile.avatarFileId) {
      return true;
    }

    const oldFileId = profile.avatarFileId;
    await prisma.userProfile.update({
      where: { userId },
      data: {
        avatarFileId: null,
        avatarUrl: null,
      },
    });

    deleteFile(oldFileId).catch((err) => {
      logger.warn('Failed to delete avatar from storage', {
        oldFileId,
        error: (err as Error).message,
      });
    });

    return true;
  }

  /**
   * Validate image signature / magic bytes
   */
  private validateImageSignature(buffer: Buffer, mimetype: string): string {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const normalizedMime = (mimetype || '').toLowerCase().trim();

    if (!allowedMimes.includes(normalizedMime)) {
      throw AppError.badRequest(
        'Invalid image format. Allowed formats: JPEG, PNG, WEBP, GIF',
        'INVALID_IMAGE_TYPE'
      );
    }

    if (buffer.length < 4) {
      throw AppError.badRequest('File is too small to be a valid image', 'INVALID_IMAGE_FILE');
    }

    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng =
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
    const isWebp =
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';

    if (!isJpeg && !isPng && !isGif && !isWebp) {
      throw AppError.badRequest(
        'File content does not match a supported image type (JPEG, PNG, WEBP, GIF)',
        'INVALID_IMAGE_SIGNATURE'
      );
    }

    if (isJpeg) return 'jpg';
    if (isPng) return 'png';
    if (isGif) return 'gif';
    return 'webp';
  }
}

export const profileService = new ProfileService();
