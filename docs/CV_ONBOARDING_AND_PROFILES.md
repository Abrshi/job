# CV-First Onboarding, Comprehensive Job Seeker Profiles, and Google Drive Storage

## 1. Overview

The CV-First Onboarding and Profile system enables job seekers to create and manage rich, structured professional profiles with minimal manual entry. By combining private cloud file storage (Google Drive), document text extraction (PDF & Word), AI-assisted parsing (Gemini), and relational database storage (MySQL/PostgreSQL), the platform creates a trusted, permanent foundation for job applications and future personalized CV generation.

---

## 2. Google Drive Storage Architecture

### Configuration & Service Account
Document storage integrates with the Google Drive API v3 using a Google Cloud Service Account.
The backend flexibly loads configuration from environment variables (supporting both `GOOGLE_*` prefixes and direct Service Account JSON keys):

| Environment Variable | Alias / JSON Key | Description | Example / Format |
|---|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `CLIENT_EMAIL` | Service Account client email | `app-storage@my-project.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | `PRIVATE_KEY` | RSA Private Key (PEM format with `\n`) | `"-----BEGIN PRIVATE KEY-----\nMIIE...==\n-----END PRIVATE KEY-----\n"` |
| `GOOGLE_PROJECT_ID` | `PROJECT_ID` | Google Cloud Project ID | `my-project-12345` |
| `GOOGLE_DRIVE_FOLDER_ID` | `FOLDER_ID` | Target Google Drive folder ID | `1aB2c3D4e5F6g7H8i9J0kL` |
| `MAX_UPLOAD_SIZE_MB` | - | Maximum allowed file upload size in MB | `10` (default) |

> [!IMPORTANT]
> **Google Service Account Quota Notice:** Google Service Accounts do not have personal storage quota in Google Drive. To upload files to Google Drive, create a folder in your personal or workspace Google Drive, share that folder with `CLIENT_EMAIL` as **Editor**, and paste the folder ID into `GOOGLE_DRIVE_FOLDER_ID`.
> If `GOOGLE_DRIVE_FOLDER_ID` is not configured or Google Drive returns quota exceeded, the system automatically falls back to secure persistent local storage (`uploads/documents`) so uploads and onboarding never fail!

### Single Function File Upload Helper
Any service or route in the application can import and execute file uploads with a single call:

```ts
import { uploadFile } from '@/lib/storage/uploader';
// or
import { uploadFile } from '@/modules/documents/google-drive.service';

const result = await uploadFile({
  buffer: file.buffer,
  filename: file.originalname,
  mimeType: file.mimetype,
  folderId: 'optional-folder-id', // Optional
});

console.log(result.fileId, result.storageProvider, result.webViewLink);
```

### Security & Privacy Safeguards
- **Private Folder Isolation:** Original CVs and resumes are uploaded into a designated private folder owned by the service account. Files are **never made public** or shared with unauthorized parties.
- **Backend-Proxied Streaming:** File downloads are routed through an authenticated backend endpoint (`GET /api/v1/documents/:id/download`). Raw Drive URLs and tokens are never exposed to the client.
- **Ownership Verification:** Every document operation strictly enforces user ownership. Attempting to view, download, or delete another user's document returns HTTP `403 FORBIDDEN` or `404 NOT_FOUND`.
- **Local Dev / Test Mode:** When Google Drive service account credentials are not present (e.g., local development or CI test runners), the service automatically switches to local simulated storage, ensuring that tests and local development run without breaking.

---

## 3. CV Upload & Extraction Pipeline

### Supported File Formats
- **PDF (`.pdf`):** Validated against magic bytes `%PDF-`. Parsed using `pdf-parse`.
- **Microsoft Word (`.docx`):** Validated against ZIP/OOXML package signature `PK\x03\x04`. Parsed using `mammoth`.
- **Microsoft Word (`.doc`):** Legacy binary Word format supported via safe ASCII/text extraction.

### Two-Stage Extraction Workflow
1. **Stage A — Document Text Extraction (`DocumentExtractorService`):**
   - Validates file format, MIME type, and size limits (default 10MB).
   - Computes SHA-256 file checksum for duplicate detection and document integrity.
   - Extracts raw document text in memory without writing unencrypted temporary files to disk.
   - Detects scanned or image-only documents (< 50 characters) and flags them with `isScannedOrLowText: true`.
2. **Stage B — Structured Information Extraction:**
   - Feeds extracted text into `gemini-3.5-flash-lite` with a strict JSON schema prompt:
     - **Personal & Contact:** Full name, headline, phone number, professional email, city, country, summary, links (LinkedIn, GitHub, Portfolio).
     - **Work Experience:** Companies, job titles, start/end month and year, current role flag, descriptions, responsibilities, and skills.
     - **Education:** Institutions, degrees, fields of study, start/end year, GPA/grades.
     - **Certifications & Training:** Certification name, issuing organization, issue year, credential URL.
     - **Projects:** Project name, user role, description, technologies used, live URL, repo URL.
     - **Skills:** Array of extracted technical, domain, and soft skills with categories.
     - **Languages:** Language proficiencies (e.g. English, Amharic).
     - **Achievements:** Awards, publications, and professional accomplishments.
     - **Job Preferences:** Desired arrangement (Remote, Hybrid, On-site), employment types, salary range.
   - If AI extraction is unavailable or offline, a deterministic heuristic fallback extractor extracts contact details, education, and keywords using regex patterns.

---

## 4. Comprehensive Profile Data Model

Normalized relational tables allow multiple experiences, educations, and skills with individual CRUD operations and provenance tracking (`CV_EXTRACTED` vs `MANUAL`).

```mermaid
erDiagram
    users ||--o| user_profiles : "has"
    users ||--o{ user_documents : "owns"
    user_profiles ||--o{ profile_experiences : "has many"
    user_profiles ||--o{ profile_educations : "has many"
    user_profiles ||--o{ profile_certifications : "has many"
    user_profiles ||--o{ profile_projects : "has many"
    user_profiles ||--o{ profile_skills : "has many"
    user_profiles ||--o{ profile_languages : "has many"
    user_profiles ||--o{ profile_achievements : "has many"
```

### Relational Models
1. **`user_documents` (`UserDocument`):**
   Tracks stored files: `driveFileId`, `documentType` (`CV`, `RESUME`, `COVER_LETTER`, `CERTIFICATE`), `originalFilename`, `mimeType`, `fileSize`, `fileChecksum`, `storageProvider`, `processingStatus`, `extractionStatus`, `extractedText`, `extractedData`.
2. **`profile_experiences` (`ProfileExperience`):**
   Supports ongoing roles (`isCurrent: true`), month and year precision (`startYear`, `startMonth`, `endYear`, `endMonth`), company, title, responsibilities, skills, and provenance.
3. **`profile_educations` (`ProfileEducation`):**
   Degree, institution, field of study, start/end years, GPA/grade.
4. **`profile_certifications` (`ProfileCertification`):**
   Certification name, issuing organization, credential ID, verification URL.
5. **`profile_projects` (`ProfileProject`):**
   Project name, role, tech stack tags, live demo URL, repository URL.
6. **`profile_skills` (`ProfileSkill`):**
   Skill name, category, proficiency (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `EXPERT`). Unique on `[profileId, name]`.
7. **`profile_languages` (`ProfileLanguage`):**
   Language name, proficiency level (`NATIVE`, `FLUENT`, `PROFICIENT`, `INTERMEDIATE`, `BASIC`). Unique on `[profileId, name]`.
8. **`profile_achievements` (`ProfileAchievement`):**
   Title, organization, year, description, relevant URL.

---

## 5. Review & Confirmation Workflow

1. User uploads a CV via drag & drop or file browser.
2. The file is uploaded to private Google Drive and analyzed.
3. The **Review Extracted Profile Modal** opens with all extracted data.
4. The user can review, edit, discard incorrect items, or add missing entries.
5. Clicking **"Confirm & Save Profile"** makes a transactional request (`POST /api/v1/profile/confirm-cv`), creating normalized records in MySQL and marking `onboardingCompleted: true`.

---

## 6. Profile Completion Calculation Model

The backend provides an authoritative profile completion calculation:

| Section | Max Points | Requirements |
|---|---|---|
| **Personal & Contact** | 20 pts | Full Name (5), Headline (5), Contact Phone/Email (5), Location (5) |
| **Work Experience / Projects** | 25 pts | ≥ 1 Work Experience (25 pts) **OR** ≥ 2 Projects (25 pts for students/fresh grads) |
| **Education** | 15 pts | ≥ 1 Education entry (15 pts) |
| **Skills** | 15 pts | ≥ 3 Skills (5 pts per skill up to 15 pts) |
| **Projects & Certifications** | 10 pts | ≥ 1 Project or Certification (10 pts) |
| **Languages** | 5 pts | ≥ 1 Language (5 pts) |
| **Job Preferences** | 10 pts | Work arrangement/type (5 pts), Salary or target titles (5 pts) |
| **Total** | **100 pts** | Score ≥ 85% considered "All-Star Profile" |

---

## 7. API Endpoints

All endpoints require JWT Bearer authentication:

### Document Management (`/api/v1/documents`)
- `POST /api/v1/documents/upload` — Upload CV (multipart/form-data `file`), store in Drive, run extraction.
- `GET /api/v1/documents` — List user's documents.
- `GET /api/v1/documents/:id` — Get document metadata and extracted data.
- `GET /api/v1/documents/:id/download` — Download original document file.
- `DELETE /api/v1/documents/:id` — Delete document from Drive and database.
- `POST /api/v1/documents/:id/retry` — Retry text and AI extraction.

### Comprehensive Profile (`/api/v1/profile`)
- `GET /api/v1/profile` — Get full profile with all relational sections and completion report.
- `PATCH /api/v1/profile` — Update personal and career preference fields (strictly blocks role tampering).
- `POST /api/v1/profile/confirm-cv` — Confirm reviewed CV extraction and import into relational models.
- **Experience:** `POST`, `PATCH /:id`, `DELETE /:id` at `/api/v1/profile/experiences`
- **Education:** `POST`, `PATCH /:id`, `DELETE /:id` at `/api/v1/profile/educations`
- **Certifications:** `POST`, `DELETE /:id` at `/api/v1/profile/certifications`
- **Projects:** `POST`, `DELETE /:id` at `/api/v1/profile/projects`
- **Skills:** `POST`, `DELETE /:id` at `/api/v1/profile/skills`
- **Languages:** `POST`, `DELETE /:id` at `/api/v1/profile/languages`
- **Achievements:** `POST`, `DELETE /:id` at `/api/v1/profile/achievements`

---

## 8. Verification & Test Suite

- **Backend Integration Tests:**
  - `cv-profile-documents.test.ts` (15 passing tests): Validates upload file format rejection (e.g. `.sh`, corrupted PDF), authorized storage in Google Drive, original file download, relational CV confirmation, section CRUD, ownership enforcement, and deletion.
  - Total backend suite: **119/119 passing tests across 32 suites**.
- **Frontend Tests:**
  - `profile-completion.test.js` (3 passing tests): Validates 100% full profile calculation, student/entry-level career path without work experience, and empty profile score.
  - Total frontend suite: **14/14 passing tests across 4 suites**.
- **Build Checks:**
  - `npm run typecheck` passed with 0 errors.
  - `npm run build` compiled all 22 Next.js routes successfully.

