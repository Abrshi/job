# Job Platform Backend API

A high-performance RESTful API backend powering the Job Aggregation & Application Platform. Built with **Node.js**, **Express 5**, **TypeScript**, and **Prisma ORM (v7)** supporting dual database drivers (**PostgreSQL** and **MySQL / MariaDB**), integrated with **Google Gemini AI**, **Google Drive Storage**, **Nodemailer SMTP**, and **SMS-Connect**.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Folder Structure](#folder-structure)
- [Prerequisites](#prerequisites)
- [Step-by-Step Setup Guide](#step-by-step-setup-guide)
  - [1. Clone & Install Dependencies](#1-clone--install-dependencies)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Database Provisioning & Schema Synchronization](#3-database-provisioning--schema-synchronization)
  - [4. Seed Initial Platform Data](#4-seed-initial-platform-data)
  - [5. Run Development Server](#5-run-development-server)
  - [6. Production Build & Execution](#6-production-build--execution)
- [Environment Variables Reference](#environment-variables-reference)
- [Default Seed Accounts & Data](#default-seed-accounts--data)
- [API Endpoints Directory](#api-endpoints-directory)
  - [System & Settings](#system--settings)
  - [Authentication (`/api/v1/auth`)](#authentication-apiv1auth)
  - [Jobs & Taxonomy (`/api/v1/jobs`)](#jobs--taxonomy-apiv1jobs)
  - [Application Tracker (`/api/v1/applications`)](#application-tracker-apiv1applications)
  - [Seeker Profile & CV Import (`/api/v1/profile`)](#seeker-profile--cv-import-apiv1profile)
  - [Document Storage (`/api/v1/documents`)](#document-storage-apiv1documents)
  - [AI Document Studio (`/api/v1/ai-documents`)](#ai-document-studio-apiv1ai-documents)
  - [Saved Searches & Alerts (`/api/v1/saved-searches`)](#saved-searches--alerts-apiv1saved-searches)
  - [In-App Notifications (`/api/v1/notifications`)](#in-app-notifications-apiv1notifications)
  - [Admin Governance (`/api/v1/admin`)](#admin-governance-apiv1admin)
  - [Admin Source Aggregators (`/api/v1/admin/sources`)](#admin-source-aggregators-apiv1adminsources)
- [Background Scheduler & Job Aggregation Pipeline](#background-scheduler--job-aggregation-pipeline)
- [CLI Scripts Reference](#cli-scripts-reference)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Troubleshooting & FAQ](#troubleshooting--faq)

---

## System Architecture

```mermaid
flowchart TD
    Client["Frontend (Next.js / Web Client)"] -->|"HTTP / REST + JSON"| Express["Express 5 App (Port 5000)"]
    
    subgraph Middleware ["Middleware Pipeline"]
        Express --> ReqId["Request ID Tracker"]
        ReqId --> Cors["CORS & Cookie Parser"]
        Cors --> RateLimiter["Rate Limiting (Global & Route-specific)"]
        RateLimiter --> AuthMid["JWT Authentication & RBAC Authorizer"]
        AuthMid --> ZodVal["Zod Request Validator"]
    end

    subgraph Modules ["Domain Modules"]
        ZodVal --> ModAuth["Auth Module (Argon2id + JWT)"]
        ZodVal --> ModJobs["Jobs & Taxonomy Module"]
        ZodVal --> ModApps["Application Pipeline Tracker"]
        ZodVal --> ModProfile["Profile & Verification Module"]
        ZodVal --> ModDocs["Document Upload & Parser Module"]
        ZodVal --> ModAIDocs["AI Document Studio (Tailored CV, Cover Letter)"]
        ZodVal --> ModAlerts["Saved Searches & Notification Engine"]
        ZodVal --> ModAdmin["Admin Moderation & Source Management"]
    end

    subgraph Background ["Background Engine"]
        Scheduler["Dynamic Source Scheduler (30s Tick)"]
        ScraperHaHu["HaHuJobs GraphQL Adapter"]
        ScraperEthio["Ethiojobs HTML/REST Adapter"]
        ScraperAfri["Afriwork GraphQL Adapter"]
        AlertWorker["Saved Search Alert Evaluator"]
        Scheduler --> ScraperHaHu & ScraperEthio & ScraperAfri
        Scheduler --> AlertWorker
    end

    subgraph Data ["Data Layer & Prisma Client"]
        PrismaSync["Schema Synchronizer (sync-database-schema.ts)"]
        Prisma["Prisma ORM (Dual Adapters)"]
        Prisma -->|"DB_PROVIDER=postgresql"| Postgres["PostgreSQL / Neon Database"]
        Prisma -->|"DB_PROVIDER=mysql"| MySQL["MySQL / MariaDB Server"]
    end

    subgraph External ["External Services"]
        Gemini["Google Gemini AI (Extraction & Document Generation)"]
        GDrive["Google Drive Service Account (Document Storage)"]
        SMTP["Nodemailer SMTP (Email Verification & Alerts)"]
        SMS["SMS-Connect API (Mobile OTP Verification)"]
    end

    ModAuth --> SMTP
    ModProfile --> SMS
    ModDocs --> GDrive & Gemini
    ModAIDocs --> Gemini
    ModJobs & ModApps & ModProfile & ModDocs & ModAIDocs & ModAlerts & ModAdmin --> Prisma
    Background --> Prisma
```

---

## Folder Structure

```text
backend/
├── prisma/
│   ├── schema.prisma             # Active schema (generated dynamically)
│   ├── schema.postgresql.prisma  # PostgreSQL schema definition
│   ├── schema.mysql.prisma       # MySQL/MariaDB schema definition
│   ├── migrations/               # Historical database migrations
│   └── prisma.config.ts          # Prisma CLI configuration
│
├── src/
│   ├── server.ts                 # HTTP bootstrap, DB warmup, graceful shutdown
│   ├── app.ts                    # Express application & middleware assembly
│   │
│   ├── config/                   # Configuration loaders
│   │   ├── env.ts                # Zod-validated environment configuration
│   │   └── cors.ts               # Allowed origins and HTTP headers
│   │
│   ├── middleware/               # Centralized Express middlewares
│   │   ├── authenticate.ts       # JWT Bearer token authentication
│   │   ├── authorize.ts          # Role-based access control (RBAC: SEEKER, ADMIN)
│   │   ├── error-handler.ts      # Global AppError handler & logging
│   │   ├── rate-limit.ts         # IP-based rate limiting rules
│   │   ├── request-id.ts         # Unique request correlation ID tracking
│   │   └── validate.ts           # Zod schema validation middleware
│   │
│   ├── modules/                  # Feature domain modules
│   │   ├── admin/                # Platform governance, audit logs & system stats
│   │   ├── ai-documents/         # AI CV & Cover Letter generation, versioning & export
│   │   │   └── exporters/        # PDFKit & DOCX exporters
│   │   ├── alerts/               # Saved searches & user notifications engine
│   │   ├── applications/         # Job seeker application tracking pipeline
│   │   ├── auth/                 # User registration, Argon2id, JWT sessions
│   │   ├── classification/       # AI categorization and seniority classification
│   │   ├── documents/            # Resume uploads, Google Drive integration, parser
│   │   ├── email/                # Nodemailer email dispatch service
│   │   ├── jobs/                 # Public job search, filters, details, bookmarks
│   │   ├── profile/              # User profile, experiences, educations, avatar
│   │   ├── scheduler/            # Dynamic background cron & scraper coordinator
│   │   ├── sms/                  # SMS OTP client via SMS-Connect
│   │   ├── sources/              # Ingestion sources & adapter implementations
│   │   │   └── adapters/         # HaHuJobs, Ethiojobs, Afriwork adapters
│   │   └── verification/         # Token generator for email & phone verification
│   │
│   ├── routes/                   # API versioning router
│   │   └── index.ts              # /api/v1 root router assembly
│   │
│   ├── lib/                      # Infrastructure singletons
│   │   ├── prisma.ts             # PrismaClient with dynamic PostgreSQL / MariaDB adapter
│   │   └── logger.ts             # Structured Winston/Pino logger
│   │
│   ├── seeds/                    # Database initial seed scripts
│   │   ├── index.ts              # Master seed runner
│   │   ├── seed-admin.ts         # Initial administrator account
│   │   ├── seed-categories.ts    # Standard job categories taxonomy
│   │   ├── seed-settings.ts      # Platform branding & settings
│   │   └── seed-sources.ts       # Pre-configured job portal sources
│   │
│   ├── utils/                    # General helper functions
│   │   └── async-handler.ts      # Async controller error wrapper
│   │
│   └── types/                    # Ambient TypeScript extensions
│       └── express.d.ts          # Extends Express.Request with user & reqId
│
├── scripts/                      # Operational CLI scripts
│   ├── sync-database-schema.ts   # Dual-driver schema auto-sync utility
│   ├── sync-hahujobs.ts          # HaHuJobs scraper trigger
│   ├── sync-ethiojobs.ts         # Ethiojobs scraper trigger
│   └── reclassify-jobs.ts        # AI batch reclassification runner
│
├── tests/                        # Automated test suites
│   ├── integration/              # API route integration tests
│   └── unit/                     # Business logic unit tests
│
├── .env                          # Local active environment variables (gitignored)
├── .env.example                  # Environment template with documentation
├── package.json                  # Scripts and package dependencies
└── tsconfig.json                 # TypeScript compiler configuration
```

---

## Prerequisites

- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **Package Manager**: `npm` (v10+)
- **Database Engine**:
  - **Option 1 (Cloud / PostgreSQL)**: Neon, Supabase, Railway, AWS RDS, or local PostgreSQL 14+.
  - **Option 2 (Local / MySQL)**: MySQL 8.0+ or MariaDB 10.5+.

---

## Step-by-Step Setup Guide

### 1. Clone & Install Dependencies

Navigate into the `backend/` directory and install project dependencies:

```bash
cd backend
npm install
```

### 2. Environment Configuration

Copy `.env.example` to create your active `.env` file:

```bash
cp .env.example .env
```

Open `.env` in your text editor and configure your environment variables:

#### Setting Up the Database

- **For PostgreSQL / Neon:**
  ```env
  DB_PROVIDER=postgresql
  DATABASE_URL="postgresql://username:password@ep-plain-mouse.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"
  ```

- **For MySQL / MariaDB:**
  ```env
  DB_PROVIDER=mysql
  DATABASE_URL="mysql://root:password@localhost:3306/job_platform"
  ```

#### Setting Up JWT Secrets

Ensure you generate two long, random cryptographic strings:

```env
ACCESS_TOKEN_SECRET="at-least-32-character-random-secret-key-1"
REFRESH_TOKEN_SECRET="at-least-32-character-random-secret-key-2"
```

#### Setting Up Gemini AI & External Storage (Optional for Basic Local Testing)

- **Gemini AI**: Set `GEMINI_API_KEY="your-google-ai-api-key"` to enable automatic CV parsing and AI cover letter generation.
- **Google Drive Storage**: Supply the Service Account JSON keys (`CLIENT_EMAIL`, `PRIVATE_KEY`, `PROJECT_ID`, `GOOGLE_DRIVE_FOLDER_ID`). If omitted, file uploads persist to the local filesystem (`uploads/`) gracefully without failing.

### 3. Database Provisioning & Schema Synchronization

The backend includes an automatic dual-driver schema synchronization tool (`scripts/sync-database-schema.ts`). Whenever you run database commands, the tool detects whether you are using PostgreSQL or MySQL, syncs the corresponding schema to `prisma/schema.prisma`, and generates the Prisma client.

```bash
# 1. Sync active schema based on DB_PROVIDER and compile Prisma Client
npm run prisma:generate

# 2. Push the schema directly to your database (creates tables, indexes, constraints)
npm run prisma:push
```

> **Note**: For production environments requiring tracked SQL migrations, use `npm run prisma:migrate` instead of `prisma:push`.

### 4. Seed Initial Platform Data

Populate the database with foundational data, including default taxonomy categories, job sources, system settings, and the initial Administrator account:

```bash
npm run seed
```

This creates:
- 15+ Core Job Categories (Software Development, Engineering, Finance, Health, etc.)
- Ingestion Sources (HaHuJobs, Ethiojobs, Afriwork)
- Platform Site Settings (Branding, Support Email)
- Default Admin User (`admin@job.com` / password `admin`)

### 5. Run Development Server

Start the development server with hot-reload enabled via `tsx watch`:

```bash
npm run dev
```

The server starts on `http://localhost:5000`. You can verify that it is healthy:

```bash
curl http://localhost:5000/api/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-10-25T11:45:00.000Z",
  "uptime": 1.25
}
```

### 6. Production Build & Execution

To compile TypeScript to standard JavaScript and run in production:

```bash
# Build Prisma Client and compile TypeScript into dist/
npm run build

# Start production server
npm run start
```

---

## Environment Variables Reference

| Variable | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `NODE_ENV` | `enum` | No | `development` | Runtime mode: `development`, `production`, or `test`. |
| `PORT` | `number` | No | `5000` | Port on which the Express server listens. |
| `DB_PROVIDER` | `string` | No | Auto-detected | Database type: `postgresql` or `mysql`. |
| `DATABASE_URL` | `string` | **Yes** | — | Connection string for PostgreSQL or MySQL. |
| `FRONTEND_ORIGIN` | `string` | No | `http://localhost:3000` | Allowed CORS origin for web applications. |
| `ACCESS_TOKEN_SECRET` | `string` | **Yes** | — | Secret string for signing access JWT tokens (min 16 chars). |
| `REFRESH_TOKEN_SECRET` | `string` | **Yes** | — | Secret string for signing refresh JWT tokens (min 16 chars). |
| `ACCESS_TOKEN_EXPIRES_IN` | `string` | No | `15m` | Lifetime of access tokens (e.g. `15m`, `1h`). |
| `REFRESH_TOKEN_EXPIRES_IN`| `string` | No | `7d` | Lifetime of refresh cookies and database sessions. |
| `GEMINI_API_KEY` | `string` | Optional | `""` | Google Gemini API Key for AI resume parsing and document generator. |
| `GEMINI_MODEL` | `string` | No | `gemini-3.5-flash-lite`| Gemini model version to invoke. |
| `CLIENT_EMAIL` | `string` | Optional | — | Google Cloud Service Account email address. |
| `PRIVATE_KEY` | `string` | Optional | — | Google Cloud Service Account RSA private key (with escaped `\n`). |
| `PROJECT_ID` | `string` | Optional | — | Google Cloud project identifier. |
| `GOOGLE_DRIVE_FOLDER_ID` | `string` | Optional | — | Google Drive folder ID shared with Service Account. |
| `MAX_UPLOAD_SIZE_MB` | `number` | No | `10` | Maximum allowed file upload size in MB. |
| `EMAIL_USER` | `string` | Optional | — | Gmail or SMTP email address for outgoing system emails. |
| `GOOGLE_APP_PASSWORD` | `string` | Optional | — | Gmail 16-character App Password for SMTP authentication. |
| `SMS_DEVICE_TOKEN` | `string` | Optional | — | API token for SMS-Connect mobile verification gateway. |
| `SMS_API_URL` | `string` | No | `https://sms-connect.vercel.app` | SMS-Connect gateway endpoint. |
| `ADMIN_INITIAL_PASSWORD` | `string` | Conditional| `admin` (dev) | Required when running `npm run seed` in `production` mode. |

---

## Default Seed Accounts & Data

Running `npm run seed` configures the following baseline data:

### Default Administrator
- **Email**: `admin@job.com`
- **Password**: `admin` *(in development; set via `ADMIN_INITIAL_PASSWORD` in production)*
- **Role**: `ADMIN`
- **Status**: Email verified, active account

### Pre-Configured Sources
- **HaHuJobs** (`hahujobs`): Ethiopian job aggregator GraphQL endpoint.
- **Ethiojobs** (`ethiojobs`): Ethiopian job board portal adapter.
- **Afriwork** (`afriwork`): Regional African work portal API adapter.

*(Sources are created in `isActive: false` status initially so they do not hammer live endpoints until you verify network and rate limit policies.)*

---

## API Endpoints Directory

All routes are versioned under the `/api/v1` prefix.

### System & Settings

| Method | Endpoint | Access | Description |
|---|---|:---:|---|
| `GET` | `/api/v1/health` | Public | System status, uptime, and health diagnostics. |
| `GET` | `/api/v1/settings` | Public | Public platform branding, contact email, and configuration. |

### Authentication (`/api/v1/auth`)

| Method | Endpoint | Access | Description |
|---|---|:---:|---|
| `POST` | `/api/v1/auth/register` | Public (Rate-limited) | Register a new user account (Argon2id password hashing + email verification token). |
| `POST` | `/api/v1/auth/login` | Public (Rate-limited) | Authenticate user; returns access token and sets secure HTTP-only refresh cookie. |
| `POST` | `/api/v1/auth/refresh` | Public | Rotate refresh token and issue new access token. |
| `POST` | `/api/v1/auth/logout` | Public | Invalidate current refresh session and clear cookie. |
| `GET` | `/api/v1/auth/me` | Authenticated | Retrieve current user profile, roles, and verification state. |
| `GET` | `/api/v1/auth/verify-email` | Public | Verify user email address via URL query token (`?token=...`). |
| `POST` | `/api/v1/auth/verify-email` | Public | Verify user email address via JSON body (`{ "token": "..." }`). |
| `POST` | `/api/v1/auth/resend-verification` | Public | Resend verification email to user address. |

### Jobs & Taxonomy (`/api/v1/jobs`)

| Method | Endpoint | Access | Description |
|---|---|:---:|---|
| `GET` | `/api/v1/jobs/categories` | Public | List active job categories with aggregate job counts. |
| `GET` | `/api/v1/jobs/sources` | Public | List active ingestion sources. |
| `GET` | `/api/v1/jobs` | Public (Optional Auth)| Search & filter jobs (keywords, category, location, jobType, salary, remote). |
| `GET` | `/api/v1/jobs/:id` | Public (Optional Auth)| Get detailed job listing by ID (includes similar recommendations). |
| `GET` | `/api/v1/jobs/saved` | Authenticated | Get seeker's bookmarked jobs (paginated). |
| `POST` | `/api/v1/jobs/:id/save` | Authenticated | Save/bookmark a job posting. |
| `DELETE`| `/api/v1/jobs/:id/save` | Authenticated | Remove a saved job bookmark. |
| `GET` | `/api/v1/jobs/applications` | Authenticated | View current seeker's internal job applications history. |
| `POST` | `/api/v1/jobs/:id/apply` | Authenticated | Submit application for a job (CV selection + optional cover letter). |

### Application Tracker (`/api/v1/applications`)

| Method | Endpoint | Access | Description |
|---|---|:---:|---|
| `GET` | `/api/v1/applications/stats` | Authenticated | Aggregate statistics by pipeline status (APPLIED, INTERVIEWING, OFFERED, etc.). |
| `GET` | `/api/v1/applications` | Authenticated | List all tracked applications with search, status filtering, and sorting. |
| `POST` | `/api/v1/applications` | Authenticated | Create an application record (internal job link or external manual entry). |
| `GET` | `/api/v1/applications/:id` | Authenticated | Get full details for an application, including interview rounds and reminders. |
| `PATCH` | `/api/v1/applications/:id` | Authenticated | Update application details (notes, salary offered, company info). |
| `POST` | `/api/v1/applications/:id/status` | Authenticated | Transition status (`DRAFT`, `APPLIED`, `INTERVIEWING`, `OFFERED`, `REJECTED`, `WITHDRAWN`). |
| `POST` | `/api/v1/applications/:id/withdraw` | Authenticated | Withdraw application with optional reason. |
| `DELETE`| `/api/v1/applications/:id` | Authenticated | Permanently delete a draft application. |
| `POST` | `/api/v1/applications/:id/interviews` | Authenticated | Schedule an interview round (Round name, Date/Time, Video link, Notes). |
| `PATCH` | `/api/v1/applications/:id/interviews/:interviewId` | Authenticated | Update interview details or outcome. |
| `DELETE`| `/api/v1/applications/:id/interviews/:interviewId` | Authenticated | Delete scheduled interview round. |
| `POST` | `/api/v1/applications/:id/reminders` | Authenticated | Create a follow-up reminder with due date. |
| `PATCH` | `/api/v1/applications/:id/reminders/:reminderId` | Authenticated | Mark reminder completed or update reminder date. |
| `DELETE`| `/api/v1/applications/:id/reminders/:reminderId` | Authenticated | Delete reminder. |

### Seeker Profile & CV Import (`/api/v1/profile`)

| Method | Endpoint | Access | Description |
|---|---|:---:|---|
| `GET` | `/api/v1/profile` | Authenticated | Get comprehensive profile (experiences, educations, skills, certifications). |
| `PATCH` | `/api/v1/profile` | Authenticated | Update core seeker details (headline, summary bio, phone, location, links). |
| `POST` | `/api/v1/profile/confirm-cv` | Authenticated | Bulk import structured CV data parsed by Gemini AI into profile tables. |
| `GET` | `/api/v1/profile/avatar/:userId` | Public Proxy | Stream user avatar image safely for HTML `<img>` elements. |
| `GET` | `/api/v1/profile/avatar` | Authenticated | Proxy avatar image for current authenticated user. |
| `POST` | `/api/v1/profile/avatar` | Authenticated | Upload new profile avatar image (multipart form-data, max 5MB). |
| `DELETE`| `/api/v1/profile/avatar` | Authenticated | Delete avatar image. |
| `POST` | `/api/v1/profile/experiences` | Authenticated | Add a work experience record. |
| `PATCH` | `/api/v1/profile/experiences/:id` | Authenticated | Edit work experience record. |
| `DELETE`| `/api/v1/profile/experiences/:id` | Authenticated | Delete work experience record. |
| `POST` | `/api/v1/profile/educations` | Authenticated | Add an education entry. |
| `PATCH` | `/api/v1/profile/educations/:id` | Authenticated | Edit education entry. |
| `DELETE`| `/api/v1/profile/educations/:id` | Authenticated | Delete education entry. |
| `POST` | `/api/v1/profile/certifications` | Authenticated | Add certification record. |
| `DELETE`| `/api/v1/profile/certifications/:id` | Authenticated | Remove certification record. |
| `POST` | `/api/v1/profile/projects` | Authenticated | Add portfolio project. |
| `DELETE`| `/api/v1/profile/projects/:id` | Authenticated | Remove portfolio project. |
| `POST` | `/api/v1/profile/skills` | Authenticated | Add skill item with proficiency level. |
| `DELETE`| `/api/v1/profile/skills/:id` | Authenticated | Remove skill item. |
| `POST` | `/api/v1/profile/languages` | Authenticated | Add language proficiency. |
| `DELETE`| `/api/v1/profile/languages/:id` | Authenticated | Remove language proficiency. |
| `POST` | `/api/v1/profile/achievements` | Authenticated | Add honor or award. |
| `DELETE`| `/api/v1/profile/achievements/:id` | Authenticated | Remove honor or award. |
| `GET` | `/api/v1/profile/verification-status` | Authenticated | Check email and mobile phone verification statuses. |
| `POST` | `/api/v1/profile/phone/request-verification` | Authenticated | Request 6-digit SMS verification code to phone number. |
| `POST` | `/api/v1/profile/phone/confirm-verification` | Authenticated | Validate SMS verification OTP code. |

### Document Storage (`/api/v1/documents`)

| Method | Endpoint | Access | Description |
|---|---|:---:|---|
| `GET` | `/api/v1/documents` | Authenticated | List all uploaded resume documents and parsing status. |
| `POST` | `/api/v1/documents/upload` | Authenticated | Upload resume file (PDF/DOCX, max 10MB); auto-triggers Gemini parser. |
| `GET` | `/api/v1/documents/:id` | Authenticated | Get document metadata and extracted JSON fields. |
| `GET` | `/api/v1/documents/:id/download` | Authenticated | Download original resume file. |
| `DELETE`| `/api/v1/documents/:id` | Authenticated | Delete uploaded document from database and storage. |
| `POST` | `/api/v1/documents/:id/retry` | Authenticated | Re-trigger Gemini AI parsing extraction for document. |

### AI Document Studio (`/api/v1/ai-documents`)

| Method | Endpoint | Access | Description |
|---|---|:---:|---|
| `POST` | `/api/v1/ai-documents/generate` | Authenticated (Rate-limited) | Generate tailored CV, Cover Letter, or Application Email via Gemini AI. |
| `GET` | `/api/v1/ai-documents` | Authenticated | List all generated documents belonging to user. |
| `GET` | `/api/v1/ai-documents/:id` | Authenticated | Get document details and full version history. |
| `POST` | `/api/v1/ai-documents/:id/versions` | Authenticated | Save new edited revision as version N+1. |
| `GET` | `/api/v1/ai-documents/:id/versions/:v/export` | Authenticated | Export document to styled PDF, DOCX, or plain TXT (`?format=pdf\|docx\|txt`). |
| `POST` | `/api/v1/ai-documents/:id/attach-application` | Authenticated | Attach generated document to an application in tracker. |
| `DELETE`| `/api/v1/ai-documents/:id` | Authenticated | Delete generated AI document. |

### Saved Searches & Alerts (`/api/v1/saved-searches`)

| Method | Endpoint | Access | Description |
|---|---|:---:|---|
| `GET` | `/api/v1/saved-searches` | Authenticated | List all saved job search configurations. |
| `POST` | `/api/v1/saved-searches` | Authenticated | Save search criteria with notification preference (INSTANT, DAILY, WEEKLY). |
| `GET` | `/api/v1/saved-searches/:id` | Authenticated | Get details of a saved search. |
| `PUT` | `/api/v1/saved-searches/:id` | Authenticated | Update saved search query criteria. |
| `PATCH` | `/api/v1/saved-searches/:id/toggle-alert` | Authenticated | Enable/disable alert notifications for search. |
| `DELETE`| `/api/v1/saved-searches/:id` | Authenticated | Delete saved search configuration. |
| `GET` | `/api/v1/saved-searches/:id/run` | Authenticated | Immediately execute search and return current matching jobs. |
| `POST` | `/api/v1/saved-searches/trigger-alerts` | Authenticated | Manually evaluate and trigger alerts against newly posted jobs. |

### In-App Notifications (`/api/v1/notifications`)

| Method | Endpoint | Access | Description |
|---|---|:---:|---|
| `GET` | `/api/v1/notifications` | Authenticated | List user notifications (paginated, supports `?unreadOnly=true`). |
| `GET` | `/api/v1/notifications/unread-count` | Authenticated | Get badge count of unread notifications. |
| `PATCH` | `/api/v1/notifications/read-all` | Authenticated | Mark all notifications as read. |
| `DELETE`| `/api/v1/notifications` | Authenticated | Clear all read notifications. |
| `PATCH` | `/api/v1/notifications/:id/read` | Authenticated | Mark single notification as read. |
| `DELETE`| `/api/v1/notifications/:id` | Authenticated | Delete specific notification. |

### Admin Governance (`/api/v1/admin`)
*(All endpoints require `Authorization: Bearer <token>` and `role: ADMIN`)*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/admin/dashboard/stats` | Platform aggregates (total jobs, registered users, applications, active sources). |
| `GET` | `/api/v1/admin/dashboard/overview` | Timeline metrics for job postings, scrapes, and user signups. |
| `GET` | `/api/v1/admin/jobs` | Paginated listing of all platform jobs with filtering by status and source. |
| `GET` | `/api/v1/admin/jobs/:id` | Complete job posting details including raw scraper payload. |
| `PATCH` | `/api/v1/admin/jobs/:id/status` | Moderate job status (`ACTIVE`, `EXPIRED`, `DRAFT`, `ARCHIVED`). |
| `POST` | `/api/v1/admin/jobs/:id/classify` | Trigger on-demand Gemini AI re-classification for job. |
| `GET` | `/api/v1/admin/users` | List platform users with search, role, and status filters. |
| `GET` | `/api/v1/admin/users/:id` | View specific user profile, applications, and activity. |
| `PATCH` | `/api/v1/admin/users/:id/status` | Update user status (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`). |
| `PATCH` | `/api/v1/admin/users/:id/role` | Change user role (`SEEKER`, `EMPLOYER`, `ADMIN`). |
| `GET` | `/api/v1/admin/settings` | Retrieve system settings and site metadata. |
| `PATCH` | `/api/v1/admin/settings` | Update branding, maintenance mode, and support contacts. |
| `GET` | `/api/v1/admin/categories` | List all taxonomy categories with usage statistics. |
| `GET` | `/api/v1/admin/classifications/review` | List jobs flagged for low-confidence classification review. |
| `POST` | `/api/v1/admin/classifications/:id/accept` | Accept proposed AI category/seniority classification. |
| `POST` | `/api/v1/admin/classifications/:id/override` | Manually assign category and experience level. |
| `GET` | `/api/v1/admin/audit-logs` | Query administrative action audit trail. |

### Admin Source Aggregators (`/api/v1/admin/sources`)
*(Requires role: ADMIN)*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/admin/sources` | List all registered job sources and active polling frequencies. |
| `POST` | `/api/v1/admin/sources` | Register a new job source adapter. |
| `GET` | `/api/v1/admin/sources/runs` | Global history of all source scraping runs. |
| `GET` | `/api/v1/admin/sources/:id` | View source configuration and recent errors. |
| `PATCH` | `/api/v1/admin/sources/:id` | Update source properties (endpoint URL, polling interval, active flag). |
| `POST` | `/api/v1/admin/sources/:id/run` | Trigger an immediate manual ingestion execution. |
| `GET` | `/api/v1/admin/sources/:id/runs` | Execution history for a specific source. |
| `GET` | `/api/v1/admin/sources/:id/stats` | Ingestion statistics (success rate, jobs added, errors). |

---

## Background Scheduler & Job Aggregation Pipeline

The backend includes a continuous polling engine (`SourceScheduler`) located in `src/modules/scheduler/scheduler.service.ts`:

1. **Interval Polling**: Every 30 seconds, the scheduler queries for active job sources (`isActive: true`) whose `pollingInterval` has elapsed since `lastPolledAt`.
2. **Concurrency Control**: Executes a maximum of 3 concurrent scraper runs to prevent resource starvation.
3. **Data Ingestion & Deduplication**:
   - Fetches postings via the adapter (`hahujobs`, `ethiojobs`, or `afriwork`).
   - Generates a SHA-256 fingerprint from title, company, and location to detect and skip duplicate listings.
   - Preserves raw ingested payload in `Job.rawPayload`.
4. **Auto-Classification**: New jobs are analyzed by the classification engine (`classification.service.ts`) to assign categories and seniority levels.
5. **Alert Evaluation**: Automatically compares newly inserted jobs against active `SavedSearch` records and dispatches in-app notifications and email alerts.

---

## CLI Scripts Reference

The `backend/package.json` provides convenience CLI commands:

| Command | Action |
|---|---|
| `npm run dev` | Syncs schema and starts the development server with live watch. |
| `npm run build` | Syncs schema, generates Prisma Client, and compiles TypeScript into `dist/`. |
| `npm run start` | Runs the compiled production server from `dist/server.js`. |
| `npm run typecheck` | Runs `tsc --noEmit` to verify type safety across the entire backend. |
| `npm run db:sync` | Automatically syncs `schema.postgresql.prisma` or `schema.mysql.prisma` to `schema.prisma`. |
| `npm run prisma:generate` | Syncs schema and regenerates the Prisma Client. |
| `npm run prisma:push` | Pushes the active Prisma schema directly to your target database. |
| `npm run prisma:migrate` | Runs Prisma development migrations. |
| `npm run prisma:studio` | Launches Prisma Studio visual database browser. |
| `npm run seed` | Seeds categories, admin user, sources, and settings into the database. |
| `npm run sync:hahujobs` | Manually triggers the HaHuJobs scraper adapter via CLI. |
| `npm run sync:ethiojobs` | Manually triggers the Ethiojobs scraper adapter via CLI. |
| `npm run reclassify` | Batch runs Gemini AI reclassification over existing unclassified jobs. |
| `npm test` | Runs the test suite using Node's native test runner. |

---

## Testing & Quality Assurance

To run the automated test suite:

```bash
npm test
```

To run a static type check without producing output files:

```bash
npm run typecheck
```

---

## Troubleshooting & FAQ

### 1. How do I switch from PostgreSQL to MySQL (or vice versa)?
Simply change `DB_PROVIDER` and `DATABASE_URL` in your `.env` file:
```env
# Switch to MySQL
DB_PROVIDER=mysql
DATABASE_URL="mysql://root:password@localhost:3306/job_platform"
```
Then run:
```bash
npm run prisma:generate
npm run prisma:push
```
The synchronizer will automatically switch the active schema to `schema.mysql.prisma`.

### 2. "Can't reach database server" during startup
- Verify that your database host is accessible.
- If using Neon, ensure `?sslmode=require` is present at the end of your connection URL.
- If running behind corporate proxies or restricted sandboxes, ensure network egress to the database port (`5432` for Postgres, `3306` for MySQL) is allowed.

### 3. File uploads fail with Google Drive errors
If you do not have Google Service Account credentials configured, leave `CLIENT_EMAIL` and `PRIVATE_KEY` blank or commented out in `.env`. The backend will automatically detect the absence of cloud credentials and fall back to saving uploads locally in `backend/uploads/`.

### 4. Admin login fails after seeding
Ensure you are using:
- **Email**: `admin@job.com`
- **Password**: `admin`
If you ran `npm run seed` with `NODE_ENV=production`, ensure you used the value specified in `ADMIN_INITIAL_PASSWORD`.
