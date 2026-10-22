export interface SectionProgress {
  id: string;
  title: string;
  weight: number;
  earned: number;
  completed: boolean;
  missingFields: string[];
  recommendation: string;
}

export interface ProfileCompletionReport {
  percentage: number;
  isComplete: boolean;
  completedCount: number;
  totalSections: number;
  sections: SectionProgress[];
  nextAction: {
    sectionId: string;
    title: string;
    recommendation: string;
  } | null;
}

export class ProfileCompletionService {
  /**
   * Authoritative profile completion calculation based on saved relational records
   */
  calculateCompletion(profile: any): ProfileCompletionReport {
    const sections: SectionProgress[] = [];

    // 1. Personal & Contact Information (Weight: 20%)
    const personalMissing: string[] = [];
    let personalScore = 0;

    if (profile.displayName || profile.user?.firstName) personalScore += 5;
    else personalMissing.push('Full Name');

    if (profile.headline) personalScore += 5;
    else personalMissing.push('Professional Headline');

    if (profile.phoneNumber || profile.professionalEmail || profile.user?.email) personalScore += 5;
    else personalMissing.push('Contact Phone / Email');

    if (profile.city || profile.country) personalScore += 5;
    else personalMissing.push('Location (City / Country)');

    sections.push({
      id: 'personal',
      title: 'Personal & Contact Information',
      weight: 20,
      earned: personalScore,
      completed: personalScore === 20,
      missingFields: personalMissing,
      recommendation: personalMissing.length > 0 ? `Add your ${personalMissing.join(', ')}` : 'Completed',
    });

    // 2. Work Experience (Weight: 25%)
    // Notice: To ensure fresh graduates/students reach high completion, projects can substitute if 0 work experiences
    const experiencesCount = profile.experiences?.length || 0;
    const projectsCount = profile.projects?.length || 0;
    const certsCount = profile.certifications?.length || 0;

    let expScore = 0;
    const expMissing: string[] = [];

    if (experiencesCount >= 1) {
      expScore = 25;
    } else if (projectsCount >= 2 || (projectsCount >= 1 && certsCount >= 1)) {
      // Academic / Entry level path
      expScore = 25;
    } else {
      expMissing.push('Work experience or portfolio projects');
    }

    sections.push({
      id: 'experience',
      title: 'Work Experience / Practical Projects',
      weight: 25,
      earned: expScore,
      completed: expScore === 25,
      missingFields: expMissing,
      recommendation: expScore === 25 ? 'Completed' : 'Add at least one work experience or two portfolio projects',
    });

    // 3. Education (Weight: 15%)
    const educationsCount = profile.educations?.length || 0;
    const eduScore = educationsCount >= 1 ? 15 : 0;
    const eduMissing = educationsCount >= 1 ? [] : ['Degree or educational institution'];

    sections.push({
      id: 'education',
      title: 'Education',
      weight: 15,
      earned: eduScore,
      completed: eduScore === 15,
      missingFields: eduMissing,
      recommendation: eduScore === 15 ? 'Completed' : 'Add your highest education degree or qualification',
    });

    // 4. Skills (Weight: 15%)
    const skillsCount = profile.skills?.length || 0;
    let skillScore = 0;
    if (skillsCount >= 3) skillScore = 15;
    else skillScore = skillsCount * 5;

    const skillMissing = skillsCount >= 3 ? [] : [`${3 - skillsCount} more skills required`];

    sections.push({
      id: 'skills',
      title: 'Key Skills',
      weight: 15,
      earned: skillScore,
      completed: skillScore === 15,
      missingFields: skillMissing,
      recommendation: skillScore === 15 ? 'Completed' : 'Add at least 3 relevant professional or technical skills',
    });

    // 5. Projects & Certifications (Weight: 10%)
    const hasProjectOrCert = projectsCount >= 1 || certsCount >= 1;
    const projCertScore = hasProjectOrCert ? 10 : 0;
    const projCertMissing = hasProjectOrCert ? [] : ['At least 1 project or professional certification'];

    sections.push({
      id: 'projects',
      title: 'Projects & Certifications',
      weight: 10,
      earned: projCertScore,
      completed: projCertScore === 10,
      missingFields: projCertMissing,
      recommendation: projCertScore === 10 ? 'Completed' : 'Highlight a project, course, or certification',
    });

    // 6. Languages (Weight: 5%)
    const languagesCount = profile.languages?.length || 0;
    const langScore = languagesCount >= 1 ? 5 : 0;
    const langMissing = languagesCount >= 1 ? [] : ['At least one language proficiency'];

    sections.push({
      id: 'languages',
      title: 'Languages',
      weight: 5,
      earned: langScore,
      completed: langScore === 5,
      missingFields: langMissing,
      recommendation: langScore === 5 ? 'Completed' : 'Add language(s) you speak professionally',
    });

    // 7. Career Preferences (Weight: 10%)
    let prefScore = 0;
    const prefMissing: string[] = [];

    if (profile.preferredWorkArrangement || profile.preferredEmploymentType) {
      prefScore += 5;
    } else {
      prefMissing.push('Preferred work arrangement / employment type');
    }

    if (profile.minSalary || profile.preferredJobTitles || profile.preferredCategories) {
      prefScore += 5;
    } else {
      prefMissing.push('Target job titles or salary expectation');
    }

    sections.push({
      id: 'preferences',
      title: 'Job & Career Preferences',
      weight: 10,
      earned: prefScore,
      completed: prefScore === 10,
      missingFields: prefMissing,
      recommendation: prefScore === 10 ? 'Completed' : 'Set your preferred roles, locations, and salary expectation',
    });

    // Sum overall earned percentage
    const totalEarned = sections.reduce((acc, s) => acc + s.earned, 0);
    const completedCount = sections.filter((s) => s.completed).length;

    // Determine highest-priority incomplete section
    const nextIncomplete = sections.find((s) => !s.completed);
    const nextAction = nextIncomplete
      ? {
          sectionId: nextIncomplete.id,
          title: nextIncomplete.title,
          recommendation: nextIncomplete.recommendation,
        }
      : null;

    return {
      percentage: Math.min(100, Math.max(0, totalEarned)),
      isComplete: totalEarned >= 85, // 85% or above considered comprehensive
      completedCount,
      totalSections: sections.length,
      sections,
      nextAction,
    };
  }
}

export const profileCompletionService = new ProfileCompletionService();

