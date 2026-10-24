import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Profile Completion Calculation Logic', () => {
  function calculateCompletion(profile) {
    let score = 0;

    // Personal & contact: 20 pts
    if (profile.displayName) score += 5;
    if (profile.headline) score += 5;
    if (profile.phoneNumber || profile.professionalEmail) score += 5;
    if (profile.city || profile.country) score += 5;

    // Experience: 25 pts (work exp or projects for students)
    const expCount = profile.experiences?.length || 0;
    const projCount = profile.projects?.length || 0;
    const certCount = profile.certifications?.length || 0;

    if (expCount >= 1 || projCount >= 2 || (projCount >= 1 && certCount >= 1)) {
      score += 25;
    }

    // Education: 15 pts
    if (profile.educations?.length >= 1) score += 15;

    // Skills: 15 pts
    const skillCount = profile.skills?.length || 0;
    if (skillCount >= 3) score += 15;
    else score += skillCount * 5;

    // Projects & Certs: 10 pts
    if (projCount >= 1 || certCount >= 1) score += 10;

    // Languages: 5 pts
    if (profile.languages?.length >= 1) score += 5;

    // Career Preferences: 10 pts
    if (profile.preferredWorkArrangement || profile.preferredEmploymentType) score += 5;
    if (profile.minSalary || profile.preferredJobTitles) score += 5;

    return {
      percentage: Math.min(100, Math.max(0, score)),
      isComplete: score >= 85,
    };
  }

  it('calculates 100% for a fully populated profile', () => {
    const fullProfile = {
      displayName: 'Sara Tekle',
      headline: 'Senior React Developer',
      phoneNumber: '+251911000000',
      city: 'Addis Ababa',
      experiences: [{ companyName: 'Tech PLC', jobTitle: 'Developer' }],
      educations: [{ institution: 'AAU', degree: 'B.Sc.' }],
      skills: [{ name: 'React' }, { name: 'Node.js' }, { name: 'TypeScript' }],
      projects: [{ name: 'JobPortal' }],
      certifications: [{ name: 'AWS' }],
      languages: [{ name: 'English' }],
      preferredWorkArrangement: 'REMOTE',
      minSalary: 60000,
    };

    const res = calculateCompletion(fullProfile);
    assert.strictEqual(res.percentage, 100);
    assert.strictEqual(res.isComplete, true);
  });

  it('allows student/entry-level candidate without work experience to achieve high completion via projects', () => {
    const studentProfile = {
      displayName: 'Yonas Kebede',
      headline: 'Junior Software Engineer',
      phoneNumber: '+251922000000',
      city: 'Hawassa',
      experiences: [], // Zero formal work experience
      projects: [{ name: 'Final Year Capstone' }, { name: 'Open Source Lib' }], // 2 projects
      educations: [{ institution: 'Hawassa University', degree: 'B.Sc.' }],
      skills: [{ name: 'Python' }, { name: 'SQL' }, { name: 'FastAPI' }],
      languages: [{ name: 'English' }],
      preferredWorkArrangement: 'HYBRID',
      preferredJobTitles: ['Junior Developer'],
    };

    const res = calculateCompletion(studentProfile);
    assert.ok(res.percentage >= 85);
    assert.strictEqual(res.isComplete, true);
  });

  it('correctly scores empty profile as zero', () => {
    const res = calculateCompletion({});
    assert.strictEqual(res.percentage, 0);
    assert.strictEqual(res.isComplete, false);
  });
});

