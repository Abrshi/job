import { GeneratedDocumentType, GenerationStatus } from '@prisma/client';

export { GeneratedDocumentType, GenerationStatus };

export interface CvHeader {
  fullName: string;
  headline?: string;
  email?: string;
  phone?: string;
  location?: string;
  links?: { label: string; url: string }[];
}

export interface CvExperienceItem {
  title: string;
  company: string;
  location?: string;
  period: string;
  bullets: string[];
}

export interface CvEducationItem {
  degree: string;
  institution: string;
  year?: string;
}

export interface CvProjectItem {
  name: string;
  description: string;
  technologies?: string[];
}

export interface CvCertificationItem {
  name: string;
  issuer?: string;
  year?: string;
}

export interface StructuredCvData {
  header: CvHeader;
  professionalSummary: string;
  skills: { category: string; items: string[] }[];
  experience: CvExperienceItem[];
  education: CvEducationItem[];
  projects?: CvProjectItem[];
  certifications?: CvCertificationItem[];
}

export interface StructuredCoverLetterData {
  recipient: {
    hiringManager?: string;
    companyName: string;
    roleTitle: string;
  };
  openingParagraph: string;
  bodyParagraphs: string[];
  closingParagraph: string;
  signOff: string;
}

export interface StructuredEmailData {
  subjectLine: string;
  salutation: string;
  opening: string;
  keyHighlights: string[];
  callToAction: string;
  signOff: string;
}

export type StructuredDocumentData = StructuredCvData | StructuredCoverLetterData | StructuredEmailData;

export interface VerificationReport {
  isFullyGrounded: boolean;
  matchedEntities: string[];
  unmatchedEntities: string[];
  warnings: string[];
}

export interface GenerateDocumentInput {
  documentType: GeneratedDocumentType;
  jobId?: string;
  externalJob?: {
    title: string;
    companyName: string;
    description?: string;
    url?: string;
    location?: string;
  };
  applicationId?: string;
  customInstructions?: string;
}

export interface SaveVersionInput {
  content: string;
  structuredData?: Record<string, unknown> | null;
  subjectLine?: string | null;
  changeSummary?: string | null;
}

export interface AttachApplicationInput {
  applicationId: string;
  attachAs: 'CV' | 'COVER_LETTER';
}

export interface ListDocumentsQuery {
  page?: number;
  limit?: number;
  documentType?: GeneratedDocumentType;
  jobId?: string;
  search?: string;
}
