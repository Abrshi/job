import { VerificationReport } from './ai-documents.types';

export interface CandidateFacts {
  fullName: string;
  companies: string[];
  jobTitles: string[];
  institutions: string[];
  degrees: string[];
  skills: string[];
  certifications: string[];
  projects: string[];
}

export class FactualVerifier {
  /**
   * Compiles ground-truth facts from the user profile record
   */
  extractFactsFromProfile(profileData: any): CandidateFacts {
    const user = profileData?.user || profileData || {};
    const profile = profileData?.profile || profileData || {};

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      profile.displayName ||
      'Candidate';

    const companies: string[] = (profile.experiences || [])
      .map((e: any) => e.companyName?.trim())
      .filter(Boolean);

    const jobTitles: string[] = (profile.experiences || [])
      .map((e: any) => e.jobTitle?.trim())
      .filter(Boolean);

    const institutions: string[] = (profile.educations || [])
      .map((e: any) => (e.institution || e.institutionName)?.trim())
      .filter(Boolean);

    const degrees: string[] = (profile.educations || [])
      .map((e: any) => e.degree?.trim())
      .filter(Boolean);

    const skills: string[] = (profile.skills || [])
      .map((s: any) => s.name?.trim())
      .filter(Boolean);

    const certifications: string[] = (profile.certifications || [])
      .map((c: any) => c.name?.trim())
      .filter(Boolean);

    const projects: string[] = (profile.projects || [])
      .map((p: any) => p.title?.trim())
      .filter(Boolean);

    return {
      fullName,
      companies,
      jobTitles,
      institutions,
      degrees,
      skills,
      certifications,
      projects,
    };
  }

  /**
   * Verifies generated document text against candidate facts and target job context.
   */
  verify(
    generatedContent: string,
    structuredData: any,
    candidateFacts: CandidateFacts,
    targetJob: { title: string; companyName: string }
  ): VerificationReport {
    const content = generatedContent.toLowerCase();
    const matchedEntities: string[] = [];
    const unmatchedEntities: string[] = [];
    const warnings: string[] = [];

    // Check matched companies
    for (const company of candidateFacts.companies) {
      if (content.includes(company.toLowerCase())) {
        matchedEntities.push(`Employer: ${company}`);
      }
    }

    // Check matched skills
    for (const skill of candidateFacts.skills) {
      if (content.includes(skill.toLowerCase())) {
        matchedEntities.push(`Skill: ${skill}`);
      }
    }

    // Check matched education
    for (const inst of candidateFacts.institutions) {
      if (content.includes(inst.toLowerCase())) {
        matchedEntities.push(`Education: ${inst}`);
      }
    }

    // Check structured data for any employers not in candidate's facts and not target company
    if (structuredData?.experience && Array.isArray(structuredData.experience)) {
      const knownCompanies = new Set(
        [...candidateFacts.companies, targetJob.companyName].map((c) => c.toLowerCase().trim())
      );

      for (const item of structuredData.experience) {
        const itemCompany = item.company?.toLowerCase()?.trim();
        if (itemCompany && !knownCompanies.has(itemCompany)) {
          // Check if partial match
          const hasPartial = Array.from(knownCompanies).some(
            (kc) => kc.includes(itemCompany) || itemCompany.includes(kc)
          );
          if (!hasPartial) {
            unmatchedEntities.push(`Unverified Company: ${item.company}`);
            warnings.push(
              `The document contains experience at "${item.company}", which was not found in your verified profile history.`
            );
          }
        }
      }
    }

    // Check structured education for unmatched institutions
    if (structuredData?.education && Array.isArray(structuredData.education)) {
      const knownInsts = new Set(
        candidateFacts.institutions.map((i) => i.toLowerCase().trim())
      );

      for (const item of structuredData.education) {
        const itemInst = item.institution?.toLowerCase()?.trim();
        if (itemInst && !knownInsts.has(itemInst)) {
          const hasPartial = Array.from(knownInsts).some(
            (ki) => ki.includes(itemInst) || itemInst.includes(ki)
          );
          if (!hasPartial && knownInsts.size > 0) {
            unmatchedEntities.push(`Unverified Institution: ${item.institution}`);
            warnings.push(
              `The document mentions education at "${item.institution}", which is not listed in your verified profile.`
            );
          }
        }
      }
    }

    // Check if candidate profile is sparse
    if (candidateFacts.companies.length === 0 && candidateFacts.skills.length === 0) {
      warnings.push(
        'Your profile contains limited experience and skill details. Consider adding your previous roles to get richer tailored documents.'
      );
    }

    return {
      isFullyGrounded: unmatchedEntities.length === 0,
      matchedEntities: Array.from(new Set(matchedEntities)),
      unmatchedEntities,
      warnings,
    };
  }
}

export const factualVerifier = new FactualVerifier();
