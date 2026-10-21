# Job Seeker Experience — Implementation Guide

## 1. Overview

The Job Seeker Experience provides candidates and public visitors with an intuitive, performant, and secure job discovery and application platform. The system supports:
- **Public Job Discovery:** Instant keyword search, facet filtering (work arrangement, employment type, experience level, salary range, city, country, taxonomy category), and multi-criteria sorting without mandatory login.
- **Role-Aware Post-Login Redirection:** Default routing of normal job seekers to `/jobs` (and administrators to `/admin`), honoring safe relative `returnUrl` parameters while preventing open redirect exploits and unauthorized privilege elevations.
- **Persistent Saved Jobs:** Bookmarking mechanism allowing authenticated users to save, browse, and unsave jobs with strict user-level ownership isolation.
- **External vs. Internal Applications:**
  - **External:** Transparent source attribution and verified outbound links with security attributes (`target="_blank" rel="noopener noreferrer"`).
  - **Internal:** Multi-step modal submission requiring email verification, duplicate application detection, and candidate application history tracking (`/jobs/applications`).
- **Profile & Career Preferences:** Dedicated seeker profile (`/profile`) allowing candidates to manage headline, contact details, preferred arrangements, target salaries, and taxonomy categories while strictly blocking mass-assignment of privileged attributes (`role`, `isEmailVerified`).

---

## 2. Architecture & Data Model

### Database Schema Additions (`schema.mysql.prisma` & `schema.postgresql.prisma`)

```prisma
enum ApplicationMethod {
  EXTERNAL
  INTERNAL
  BOTH
}

enum ApplicationStatus {
  SUBMITTED
  REVIEWING
  SHORTLISTED
  REJECTED
  ACCEPTED
}

model UserProfile {
  id                    String            @id @default(uuid())
  userId                String            @unique @map("user_id")
  user                  User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  headline              String?           @db.VarChar(255)
  bio                   String?           @db.Text
  phoneNumber           String?           @map("phone_number") @db.VarChar(50)
  locationCity          String?           @map("location_city") @db.VarChar(100)
  locationCountry       String?           @map("location_country") @db.VarChar(100)
  preferredArrangement  WorkArrangement?  @map("preferred_arrangement")
  preferredJobTypes     Json?             @map("preferred_job_types")
  preferredCategories   Json?             @map("preferred_categories")
  expectedSalaryMin     Decimal?          @map("expected_salary_min") @db.Decimal(12, 2)
  expectedSalaryMax     Decimal?          @map("expected_salary_max") @db.Decimal(12, 2)
  salaryCurrency        String?           @default("ETB") @map("salary_currency") @db.VarChar(10)
  resumeUrl             String?           @map("resume_url") @db.VarChar(500)
  portfolioUrl          String?           @map("portfolio_url") @db.VarChar(500)
  createdAt             DateTime          @default(now()) @map("created_at")
  updatedAt             DateTime          @updatedAt @map("updated_at")

  @@map("user_profiles")
}

model SavedJob {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobId     String   @map("job_id")
  job       Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([userId, jobId])
  @@index([userId])
  @@index([jobId])
  @@map("saved_jobs")
}

model JobApplication {
  id          String            @id @default(uuid())
  userId      String            @map("user_id")
  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobId       String            @map("job_id")
  job         Job               @relation(fields: [jobId], references: [id], onDelete: Cascade)
  status      ApplicationStatus @default(SUBMITTED)
  coverNote   String?           @map("cover_note") @db.Text
  appliedAt   DateTime          @default(now()) @map("applied_at")
  updatedAt   DateTime          @updatedAt @map("updated_at")

  @@unique([userId, jobId])
  @@index([userId])
  @@index([jobId])
  @@map("job_applications")
}
```

---

## 3. Backend API Endpoints

All endpoints are mounted under `/api/v1/jobs` and `/api/v1/profile`:

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/jobs` | Optional | Public job discovery with search, pagination, facet filters, and user `isSaved` annotation |
| `GET` | `/api/v1/jobs/categories` | No | Taxonomy categories with count of active jobs |
| `GET` | `/api/v1/jobs/:id` | Optional | Public job detail view (sanitizes internal crawl data, annotations `isSaved` / `hasApplied`) |
| `POST` | `/api/v1/jobs/:id/save` | Yes (JWT) | Save job to candidate bookmarks (idempotent) |
| `DELETE` | `/api/v1/jobs/:id/save` | Yes (JWT) | Remove job from candidate bookmarks |
| `GET` | `/api/v1/jobs/saved` | Yes (JWT) | List authenticated user's bookmarked jobs |
| `POST` | `/api/v1/jobs/:id/apply` | Yes (Verified) | Submit internal application (checks email verification & duplicate applications) |
| `GET` | `/api/v1/jobs/applications` | Yes (JWT) | List authenticated user's application submission history |
| `GET` | `/api/v1/profile` | Yes (JWT) | Retrieve user profile & career preferences (auto-initializes if missing) |
| `PATCH` | `/api/v1/profile` | Yes (JWT) | Update candidate headline, preferences, and salary expectations (strictly prevents role tampering) |

### Moderation & Privacy Safeguards
- **Unmoderated Jobs Hidden:** Jobs with `classificationStatus: REVIEW_REQUIRED` or `FAILED` return 404 to public visitors.
- **Sensitive Scraping Metadata Omitted:** Raw JSON payloads and crawler authentication headers are stripped before JSON serialization.
- **Email Verification Guard:** Unverified accounts attempting `/api/v1/jobs/:id/apply` receive HTTP `403 EMAIL_NOT_VERIFIED`.
- **Duplicate Prevention:** Re-applying for the same job triggers HTTP `409 APPLICATION_ALREADY_EXISTS`.
- **Mass Assignment Defense:** The `UpdateProfileSchema` uses Zod `.strict()` rejecting unexpected keys such as `role`, `isEmailVerified`, or `passwordHash` with HTTP `400 VALIDATION_ERROR`.

---

## 4. Frontend Implementation

### Routing & Navigation
- **Navbar (`frontend/components/navbar.js`):** Dynamically reflects role and authentication status:
  - Public visitors see `Browse Jobs`, `Sign In`, and `Register`.
  - Authenticated candidates see `Browse Jobs`, `Saved Jobs`, `My Applications`, and their `Profile` dropdown.
  - Administrators see the `Admin Dashboard` navigation link.
- **Auth Card Redirection (`frontend/components/auth-card.js`):**
  - Standard users default to `/jobs`.
  - Admins default to `/admin`.
  - Valid relative `returnUrl` (e.g. `/jobs/321`) is honored while blocking open redirects (`//evil.com`) and unauthorized admin paths.

### Seeker Pages
1. **Job Directory (`/jobs`):**
   - Live search input with debounce.
   - Expandable sidebar with multi-facet filters: Category, Work Arrangement (Remote, Hybrid, On-Site), Employment Type, Experience Level, and Minimum Salary.
   - Dynamic sorting: Newest published, closing soonest, or first indexed.
   - Responsive job cards (`frontend/components/job-card.js`) with immediate bookmark toggling.
2. **Job Details (`/jobs/[id]`):**
   - Complete job description, company details, tags, compensation, and original source platform attribution.
   - For external jobs: Clear disclaimer and verified direct link (`target="_blank" rel="noopener noreferrer"`).
   - For internal jobs: Application button opening a modal with cover note input, verification validation, and confirmation state.
3. **Saved Jobs (`/jobs/saved`):**
   - Clean tabular/card list of saved opportunities with 1-click removal.
4. **Applications History (`/jobs/applications`):**
   - Chronological table showing applied jobs, submission timestamp, and real-time status badges (`SUBMITTED`, `REVIEWING`, `SHORTLISTED`, `ACCEPTED`, `REJECTED`).
5. **Career Profile & Preferences (`/profile`):**
   - Manage professional headline, phone, city, country, work arrangements, salary range, and target category tags.

---

## 5. Automated Verification

- **Backend Integration & Unit Tests (`backend/tests/`):**
  - **104 passing tests across 26 suites.**
  - `job-seeker-experience.test.ts`: 19 tests validating public discovery, filters, single-job privacy, saved jobs lifecycle, internal/external application flows, email verification guard, and profile mass-assignment defenses.
- **Frontend Tests (`frontend/tests/`):**
  - **11 passing tests across 3 suites.**
  - Tests covering `ApiError`, `ApiClient` error normalization, and role-aware post-login redirection safeguards.
- **Build Verification:**
  - `npm run typecheck` passes with 0 TypeScript errors.
  - Next.js production build (`npm run build`) successfully compiles all 22 static and dynamic routes using Turbopack.
