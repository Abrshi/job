import crypto from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { AppError } from '../../middleware/error-handler';

export interface ExtractedPersonal {
  fullName?: string;
  preferredName?: string;
  headline?: string;
  phoneNumber?: string;
  professionalEmail?: string;
  city?: string;
  country?: string;
  summary?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
}

export interface ExtractedExperience {
  companyName: string;
  jobTitle: string;
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';
  location?: string;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  isCurrent?: boolean;
  description?: string;
  responsibilities?: string[];
  achievements?: string[];
  skillsUsed?: string[];
  relevantUrl?: string;
}

export interface ExtractedEducation {
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  isCurrent?: boolean;
  grade?: string;
  description?: string;
  location?: string;
}

export interface ExtractedCertification {
  name: string;
  issuingOrganization?: string;
  type?: string;
  issueYear?: number;
  issueMonth?: number;
  credentialUrl?: string;
  description?: string;
}

export interface ExtractedProject {
  name: string;
  role?: string;
  description?: string;
  startYear?: number;
  endYear?: number;
  isCurrent?: boolean;
  technologies?: string[];
  liveUrl?: string;
  repoUrl?: string;
}

export interface ExtractedSkill {
  name: string;
  category?: string;
  proficiency?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  yearsExperience?: number;
}

export interface ExtractedLanguage {
  name: string;
  proficiency?: 'NATIVE' | 'FLUENT' | 'PROFICIENT' | 'INTERMEDIATE' | 'BASIC';
}

export interface ExtractedAchievement {
  title: string;
  organization?: string;
  year?: number;
  description?: string;
}

export interface ExtractedJobPreferences {
  preferredJobTitles?: string[];
  preferredWorkArrangement?: 'ON_SITE' | 'HYBRID' | 'REMOTE';
  preferredEmploymentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';
  preferredExperienceLevel?: 'ENTRY' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'EXECUTIVE' | 'UNSPECIFIED';
  minSalary?: number;
  salaryCurrency?: string;
  preferredLocations?: string[];
}

export interface ExtractedProfileData {
  personal: ExtractedPersonal;
  experiences: ExtractedExperience[];
  educations: ExtractedEducation[];
  certifications: ExtractedCertification[];
  projects: ExtractedProject[];
  skills: ExtractedSkill[];
  languages: ExtractedLanguage[];
  achievements: ExtractedAchievement[];
  jobPreferences?: ExtractedJobPreferences;
  isScannedOrLowText?: boolean;
}

export class DocumentExtractorService {
  /**
   * Validate file buffer signature and size
   */
  validateFile(buffer: Buffer, originalFilename: string, mimeType: string) {
    const maxSizeBytes = (env.MAX_UPLOAD_SIZE_MB || 10) * 1024 * 1024;
    if (buffer.length > maxSizeBytes) {
      throw AppError.badRequest(
        `File size exceeds maximum permitted limit of ${env.MAX_UPLOAD_SIZE_MB}MB`,
        'FILE_TOO_LARGE',
        [{ field: 'file', message: `File size ${Math.round(buffer.length / 1024 / 1024)}MB exceeds limit` }]
      );
    }

    if (buffer.length === 0) {
      throw AppError.badRequest('Uploaded file is empty', 'FILE_EMPTY', [
        { field: 'file', message: 'File buffer has zero bytes' },
      ]);
    }

    const lowerExt = originalFilename.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'doc'].includes(lowerExt || '')) {
      throw AppError.badRequest(
        'Unsupported file format. Please upload a PDF or Word document (.pdf, .docx)',
        'UNSUPPORTED_FORMAT',
        [{ field: 'file', message: `Extension .${lowerExt} is not supported` }]
      );
    }

    // Check magic bytes / signatures where possible
    const isPdfMagic = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    const isDocxMagic = buffer[0] === 0x50 && buffer[1] === 0x4b; // ZIP / OOXML

    if (lowerExt === 'pdf' && !isPdfMagic) {
      throw AppError.badRequest('Corrupted or invalid PDF file signature', 'INVALID_SIGNATURE', [
        { field: 'file', message: 'File header does not match standard PDF magic bytes' },
      ]);
    }

    if (lowerExt === 'docx' && !isDocxMagic) {
      throw AppError.badRequest('Corrupted or invalid DOCX file signature', 'INVALID_SIGNATURE', [
        { field: 'file', message: 'File header does not match standard DOCX package bytes' },
      ]);
    }
  }

  /**
   * Calculate SHA-256 checksum for document integrity & deduplication
   */
  calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Stage A: Extract raw text from document buffer
   */
  async extractText(buffer: Buffer, filename: string): Promise<string> {
    const ext = filename.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'pdf') {
        if (typeof PDFParse === 'function') {
          const parser = new (PDFParse as any)({ data: buffer });
          const res = await parser.getText();
          await parser.destroy();
          return res.text ? res.text.trim() : '';
        }
        return '';
      }

      if (ext === 'docx') {
        const result = await mammoth.extractRawText({ buffer });
        return result.value ? result.value.trim() : '';
      }

      if (ext === 'doc') {
        // Fallback ASCII / text extraction for legacy .doc
        const ascii = buffer.toString('utf8').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');
        return ascii.trim();
      }

      throw AppError.badRequest(`Unsupported document format .${ext}`, 'UNSUPPORTED_FORMAT');
    } catch (err) {
      logger.error('Failed to extract text from document', {
        filename,
        error: (err as Error).message,
      });
      throw AppError.badRequest(
        'Unable to parse document contents. Please check the file formatting.',
        'PARSE_ERROR',
        [{ field: 'file', message: (err as Error).message }]
      );
    }
  }

  /**
   * Stage B: Extract structured profile data from text
   */
  async extractStructuredProfile(text: string): Promise<ExtractedProfileData> {
    if (!text || text.length < 50) {
      return {
        personal: {},
        experiences: [],
        educations: [],
        certifications: [],
        projects: [],
        skills: [],
        languages: [],
        achievements: [],
        isScannedOrLowText: true,
      };
    }

    // Try Gemini AI extraction if API key configured
    if (env.GEMINI_API_KEY) {
      try {
        const aiResult = await this.extractWithGemini(text);
        if (aiResult) {
          return aiResult;
        }
      } catch (err) {
        logger.warn('Gemini CV extraction failed, falling back to heuristic parser', {
          error: (err as Error).message,
        });
      }
    }

    // Deterministic heuristic fallback
    return this.extractHeuristic(text);
  }

  /**
   * Gemini AI structured CV extraction
   */
  private async extractWithGemini(rawText: string): Promise<ExtractedProfileData | null> {
    const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const apiKey = env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const prompt = `You are an expert AI resume and CV parsing assistant.
Analyze the following resume text and extract the candidate's structured profile information.

Rules:
1. Extract accurately without fabricating or assuming unstated facts.
2. If dates only mention years (e.g. 2021 - 2024), put startYear=2021, endYear=2024. If months are present, extract startMonth (1-12) and endMonth.
3. For current/ongoing roles, set isCurrent=true and leave endYear/endMonth null.
4. Extract skills into an array of { "name": string, "category": string }.
5. Return strictly a JSON object matching this schema:
{
  "personal": {
    "fullName": "...",
    "headline": "...",
    "phoneNumber": "...",
    "professionalEmail": "...",
    "city": "...",
    "country": "...",
    "summary": "...",
    "linkedInUrl": "...",
    "githubUrl": "...",
    "portfolioUrl": "..."
  },
  "experiences": [
    {
      "companyName": "...",
      "jobTitle": "...",
      "employmentType": "FULL_TIME",
      "location": "...",
      "startYear": 2021,
      "startMonth": 5,
      "endYear": 2023,
      "endMonth": 8,
      "isCurrent": false,
      "description": "...",
      "responsibilities": ["..."],
      "skillsUsed": ["..."]
    }
  ],
  "educations": [
    {
      "institution": "...",
      "degree": "...",
      "fieldOfStudy": "...",
      "startYear": 2017,
      "endYear": 2021,
      "isCurrent": false,
      "grade": "..."
    }
  ],
  "certifications": [
    {
      "name": "...",
      "issuingOrganization": "...",
      "type": "CERTIFICATION",
      "issueYear": 2022
    }
  ],
  "projects": [
    {
      "name": "...",
      "role": "...",
      "description": "...",
      "technologies": ["..."],
      "liveUrl": "..."
    }
  ],
  "skills": [
    { "name": "...", "category": "..." }
  ],
  "languages": [
    { "name": "...", "proficiency": "FLUENT" }
  ],
  "achievements": [
    { "title": "...", "organization": "...", "year": 2023 }
  ],
  "jobPreferences": {
    "preferredJobTitles": ["..."],
    "preferredWorkArrangement": "REMOTE"
  }
}

CV Text to extract:
${rawText.slice(0, 10000)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const json = (await res.json()) as any;
    const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      personal: parsed.personal || {},
      experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
      educations: Array.isArray(parsed.educations) ? parsed.educations : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      languages: Array.isArray(parsed.languages) ? parsed.languages : [],
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      jobPreferences: parsed.jobPreferences || {},
      isScannedOrLowText: false,
    };
  }

  /**
   * Deterministic regex and NLP heuristic extractor
   */
  extractHeuristic(text: string): ExtractedProfileData {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Personal & Contact
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = text.match(/(\+?[0-9]{1,4}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/);
    const linkedInMatch = text.match(/https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
    const githubMatch = text.match(/https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]+/i);

    // Guess full name from first line if reasonable length
    const fullName = lines.length > 0 && lines[0].length < 50 && !lines[0].includes('@') ? lines[0] : undefined;

    // 2. Skills
    const knownSkills = [
      'JavaScript', 'TypeScript', 'Python', 'React', 'Node.js', 'Next.js', 'Express',
      'Java', 'C++', 'C#', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Docker',
      'Kubernetes', 'AWS', 'Azure', 'Git', 'HTML', 'CSS', 'Tailwind', 'GraphQL', 'REST',
      'Linux', 'CI/CD', 'Figma', 'UI/UX', 'Project Management', 'Agile', 'Scrum'
    ];

    const foundSkills: ExtractedSkill[] = [];
    const lowerText = text.toLowerCase();
    for (const skill of knownSkills) {
      const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(text)) {
        foundSkills.push({ name: skill, category: 'Technical' });
      }
    }

    // 3. Languages
    const knownLanguages = ['English', 'Amharic', 'French', 'Spanish', 'German', 'Arabic', 'Chinese'];
    const foundLanguages: ExtractedLanguage[] = [];
    for (const lang of knownLanguages) {
      if (new RegExp(`\\b${lang}\\b`, 'i').test(text)) {
        foundLanguages.push({ name: lang, proficiency: 'PROFICIENT' });
      }
    }

    // 4. Basic experience heuristic
    const experiences: ExtractedExperience[] = [];
    if (/developer|engineer|manager|analyst|specialist|consultant|designer/i.test(text)) {
      // Find title line
      for (const line of lines) {
        if (/engineer|developer|designer|manager|consultant|analyst/i.test(line) && line.length < 60) {
          experiences.push({
            jobTitle: line,
            companyName: 'Company (Extracted)',
            isCurrent: true,
            description: 'Experience extracted from CV header',
          });
          break;
        }
      }
    }

    // 5. Basic education heuristic
    const educations: ExtractedEducation[] = [];
    for (const line of lines) {
      if (/bachelor|master|b\.sc|b\.a|m\.sc|phd|university|college|institute of technology/i.test(line) && line.length < 80) {
        educations.push({
          institution: line,
          degree: /bachelor|b\.sc/i.test(line) ? 'Bachelor of Science' : /master|m\.sc/i.test(line) ? 'Master of Science' : 'Higher Education Degree',
        });
        break;
      }
    }

    return {
      personal: {
        fullName,
        professionalEmail: emailMatch ? emailMatch[0] : undefined,
        phoneNumber: phoneMatch ? phoneMatch[0] : undefined,
        linkedInUrl: linkedInMatch ? linkedInMatch[0] : undefined,
        githubUrl: githubMatch ? githubMatch[0] : undefined,
      },
      experiences,
      educations,
      certifications: [],
      projects: [],
      skills: foundSkills,
      languages: foundLanguages,
      achievements: [],
      isScannedOrLowText: false,
    };
  }
}

export const documentExtractorService = new DocumentExtractorService();
