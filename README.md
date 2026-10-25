# Job Platform — Four-Application Architecture

A decoupled, enterprise-grade job aggregation and application management platform for East Africa. Built with **Node.js**, **Express 5**, **TypeScript**, **Next.js 16**, **React 19**, **Tailwind CSS v4**, and **Prisma ORM (v7)**.

The system is separated into four independent, decoupled applications communicating over clean REST boundaries and sharing a single canonical database:

```text
job/
├── frontend/             # User-facing Next.js web application (Port 3000)
├── backend/              # User-facing Express REST API (Port 5000)
├── admin-frontend/       # Dedicated administration Next.js console (Port 3001)
├── admin-backend/        # Dedicated administration & ingestion Express API (Port 5001)
├── docs/                 # Architectural specifications, separation plan & guides
│   ├── separation-plan.md # Architectural plan for 4-app decomposition
│   └── ...
└── README.md             # Master repository orchestration guide
```

---

## Core Principle: Separate User and Admin Login Experiences

1. **Unified Account Identity**: Administrators use the exact same account credentials and database record as regular job seekers. No shadow or duplicate admin accounts exist.
2. **User Application (`frontend/` on Port 3000)**:
   - When an administrator logs into `frontend/`, they receive the **exact same normal user experience** as ordinary job seekers.
   - Redirects to `/jobs` (or their user returnUrl).
   - No admin badges, admin navigation links ("Admin Console"), or role labels (`ADMIN`) are rendered.
   - The user frontend never redirects users based on their `ADMIN` role.
3. **Admin Application (`admin-frontend/` on Port 3001)**:
   - When an administrator visits `admin-frontend/` and logs in, the `admin-backend/` independently verifies server-side administrative authorization.
   - Authorized administrators are redirected to the Admin Dashboard (`/`).
   - If an ordinary user attempts to log into `admin-frontend/`, the admin backend rejects administrative access with **403 Forbidden** and presents a generic access-denied message. The user's account and normal job-seeker experience remain completely unaffected.
   - All admin endpoints require server-side cryptographic JWT verification (`authenticate`) and role checking (`authorize('ADMIN')`). Client-side state or forged request parameters are never trusted.
4. **Session Isolation**:
   - `frontend/` utilizes `refreshToken` cookies and user-scoped in-memory access tokens.
   - `admin-frontend/` utilizes dedicated `adminRefreshToken` cookies and admin-scoped tokens.
   - Logging into or out of one portal does not disrupt active sessions in the other portal.

---

## Application Summary & Ports

| Application | Technology | Default Port | API Target | Primary Role |
|---|---|:---:|:---:|---|
| **`frontend/`** | Next.js 16 (App Router), React 19, Tailwind v4 | `3000` | `http://localhost:5000/api/v1` | Public job search, seeker profile, CV parsing, application tracking, AI document studio. |
| **`backend/`** | Node.js, Express 5, TypeScript, Prisma | `5000` | — | User REST API: auth, jobs catalog, seeker profile, document storage, AI generation. |
| **`admin-frontend/`** | Next.js 16 (App Router), React 19, Tailwind v4 | `3001` | `http://localhost:5001/api/v1` | Dedicated administration console: telemetry, job moderation, user governance, scraper controls. |
| **`admin-backend/`** | Node.js, Express 5, TypeScript, Prisma | `5001` | — | Admin REST API, admin auth, audit logs, background ingestion scheduler authority (`SourceScheduler`). |

---

## Step-by-Step Setup & Execution

### 1. Database Configuration (Shared)

Both backends access the same database. Ensure your database connection URL is defined in both `backend/.env` and `admin-backend/.env`.

```env
DB_PROVIDER=postgresql
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
```
*(Or `DB_PROVIDER=mysql` with `mysql://root:password@localhost:3306/dbname`)*

To seed initial categories, admin user, and platform settings:
```bash
cd backend
npm run prisma:generate
npm run prisma:push
npm run seed
```
> **Default Admin Account**: `admin@job.com` / `admin` *(in development)*

---

### 2. Running User Backend (`backend/`)

```bash
cd backend

# Run development server (Port 5000)
npm run dev

# Run type check
npm run typecheck

# Run unit tests
npm test

# Build for production
npm run build
npm run start
```

---

### 3. Running User Frontend (`frontend/`)

```bash
cd frontend

# Run development server (Port 3000)
npm run dev

# Run automated tests
npm test

# Build for production
npm run build
npm run start
```

---

### 4. Running Admin Backend (`admin-backend/`)

```bash
cd admin-backend

# Run development server (Port 5001)
npm run dev

# Run type check
npm run typecheck

# Run automated authorization tests
npm test

# Build for production
npm run build
npm run start
```

---

## 5. Running Admin Frontend (`admin-frontend/`)

```bash
cd admin-frontend

# Run development server (Port 3001)
npm run dev

# Run automated login tests
npm test

# Build for production
npm run build
npm run start
```

---

## Acceptance Test Matrix

| Scenario | Tested In | Behavior Verified |
|---|---|---|
| **Scenario A: Administrator in User App** | `frontend/tests/login-redirect.test.js` | Admin logs into `frontend/` -> lands on `/jobs` -> normal job-seeker navigation -> zero admin console links or role badges. |
| **Scenario B: Administrator in Admin App** | `admin-backend/tests/unit/admin-auth.test.ts`<br>`admin-frontend/tests/admin-login.test.js` | Admin logs into `admin-frontend/` -> server authorizes `ADMIN` role -> lands on `/` admin dashboard -> full governance access. |
| **Scenario C: Normal User in Admin App** | `admin-backend/tests/unit/admin-auth.test.ts`<br>`admin-frontend/tests/admin-login.test.js` | Standard user logs into `admin-frontend/` -> server rejects with **403 Forbidden** (`ADMIN_ACCESS_DENIED`) -> generic access denied message -> user account untouched. |
| **Scenario D: Direct API Access** | `admin-backend/tests/unit/admin-auth.test.ts` | Unauthenticated -> **401 Unauthorized**.<br>Ordinary token -> **403 Forbidden**.<br>Forged signature -> **401 Invalid Token**.<br>Expired token -> **401 Token Expired**. |

---

## Admin Operational Capabilities & Features

### 1. Ingestion Triggers & Timing Inspector (`/sources` -> Fetch Triggers Tab)
- Real-time logging of every ingestion trigger across all configured platforms (Ethiojobs, Afriwork, direct sources).
- Displays platform name, trigger timestamp, execution duration in milliseconds (`durationMs`), status badge (`SUCCESS`, `RUNNING`, `FAILED`), and metrics (records fetched, created, updated, skipped).
- Error Summary inspector for troubleshooting failed ingestion cycles.

### 2. Job Site / Platform Management (`/sources` -> Sources Tab)
- Add new job scraping sources dynamically via modal (`POST /api/v1/admin/sources`) with name, slug, source type (`API`, `SCRAPER`, `RSS`), endpoint URL, polling interval, and optional secret headers.
- Edit scraping configurations, toggle active/paused status, trigger on-demand test runs, or delete sources with cascade protections.

### 3. Comprehensive Job Moderation & Control (`/jobs`)
- Search by job title, company name, or external ID, with status and category filters.
- **Bulk Operations**: Multi-select vacancies to bulk activate, bulk archive, bulk expire, or permanently delete selected postings.
- **Job Details Modal**: Inspect full job records, compensation breakdown, original scraped URLs, taxonomy category, and sanitized descriptions.
- **Job Edit Modal**: Modify title, company, category, location, arrangement (Remote/Onsite/Hybrid), employment type, experience level, salary brackets, and descriptions.
- **Automated AI Taxonomy Reclassification**: Trigger live Gemini taxonomy reclassification per job.

### 4. User Governance & Activity Dossiers (`/users`)
- **User Management**: Create new user or admin accounts (`POST /api/v1/admin/users`), edit user profile fields and passwords (`PATCH /api/v1/admin/users/:id`), suspend/reactivate accounts, and safely delete accounts (with safeguards preventing self-deletion and removal of the last administrator).
- **User Activity Dossier Modal**: Comprehensive deep-dive on any user account:
  - Total submitted applications (with job title, company, date, status).
  - Saved jobs list.
  - Uploaded resumes/CVs (with file size, parsing status, extraction status).
  - Saved search alerts (keywords, location, frequency).
- **Live Platform Activity Stream**: Real-time chronological timeline tracking all signups, job applications, and document uploads across the platform.

---

## Documentation Index

- [Separation Plan & Architecture Design](file:///home/abrsh/Desktop/starcher/job/docs/separation-plan.md)
- [Backend Documentation & Setup Guide](file:///home/abrsh/Desktop/starcher/job/backend/README.md)
- [Admin Dashboard Specifications](file:///home/abrsh/Desktop/starcher/job/docs/ADMIN_DASHBOARD.md)
- [Job Collection & Ingestion Pipeline](file:///home/abrsh/Desktop/starcher/job/docs/JOB_COLLECTION_PIPELINE.md)
- [Application Tracking Pipeline](file:///home/abrsh/Desktop/starcher/job/docs/APPLICATION_TRACKING.md)
- [CV Onboarding & Profile Extraction](file:///home/abrsh/Desktop/starcher/job/docs/CV_ONBOARDING_AND_PROFILES.md)
- [Error Handling Standards](file:///home/abrsh/Desktop/starcher/job/docs/ERROR_HANDLING.md)
