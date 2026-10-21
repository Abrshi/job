# Admin Dashboard & Governance System

## 1. Executive Summary & Architectural Overview

The **Admin Dashboard** provides a centralized, secure, role-protected interface for administrators of the Job Aggregation Platform to monitor, govern, and configure the entire aggregation and classification pipeline.

### Core Architectural Principles
- **Single Source of Truth**: All operational statistics, source statuses, user accounts, and classification queues are computed and fetched from the real MySQL (`job`) database via Prisma ORM. No mock or hardcoded statistics are permitted.
- **Strict Role-Based Access Control (RBAC)**: All administrative routes on the backend require valid authentication (`authenticate` middleware) and administrative privileges (`authorize('ADMIN')` middleware). The frontend verifies admin status and redirects unauthorized visitors to the landing page with informative toast notifications.
- **Fail-Safe Administration**: Strict safety controls protect the platform:
  - Administrators cannot deactivate their own accounts.
  - Administrators cannot demote themselves from the `ADMIN` role.
  - The system rejects any deactivation or demotion attempt that would leave the system with zero active administrators.
- **Full Administrative Audit Trail**: Sensitive management actions (user role alterations, deactivations, source modifications, manual scraping triggers, job status transitions, category reclassifications, and site branding updates) are systematically persisted to the `admin_audit_logs` MySQL table with timestamps, administrator IDs, and IP addresses.
- **Stormy Morning Design System**: The interface strictly complies with the established palette (`slate-950` deep backgrounds, `slate-900` card surfaces, `slate-800` borders, `sky-400` primary accents, `emerald-400` success indicators, and `rose-400` critical warnings).

---

## 2. Technology Stack & Database Schemas

### Technology Stack
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons.
- **Backend**: Express.js, TypeScript, Prisma ORM 5.22.
- **Database**: MySQL (`job` database accessed locally via port 3306 and phpMyAdmin).
- **Authentication**: JWT access token in authorization header + HTTP-only refresh token session cookies.

### Prisma Schema Models for Administration

```prisma
model User {
  id               String            @id @default(uuid())
  email            String            @unique
  passwordHash     String            @map("password_hash")
  role             Role              @default(USER)
  isEmailVerified  Boolean           @default(false) @map("is_email_verified")
  isActive         Boolean           @default(true) @map("is_active")
  lastLoginAt      DateTime?         @map("last_login_at")
  createdAt        DateTime          @default(now()) @map("created_at")
  updatedAt        DateTime          @updatedAt @map("updated_at")
  refreshSessions  RefreshSession[]
  auditLogs        AdminAuditLog[]   @relation("AdminAuditActor")

  @@map("users")
}

model SiteSetting {
  id           String   @id @default(uuid())
  key          String   @unique
  value        String   @db.Text
  description  String?
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@map("site_settings")
}

model AdminAuditLog {
  id          String   @id @default(uuid())
  adminId     String   @map("admin_id")
  action      String   // e.g., "USER_DEACTIVATE", "JOB_STATUS_UPDATE", "SOURCE_TRIGGER"
  targetType  String   @map("target_type") // "USER", "JOB", "SOURCE", "SETTINGS", etc.
  targetId    String?  @map("target_id")
  detailsJson String?  @map("details_json") @db.Text
  ipAddress   String?  @map("ip_address")
  createdAt   DateTime @default(now()) @map("created_at")
  admin       User     @relation("AdminAuditActor", fields: [adminId], references: [id], onDelete: Cascade)

  @@index([adminId], map: "admin_audit_logs_admin_id_idx")
  @@index([targetType, targetId], map: "admin_audit_logs_target_idx")
  @@map("admin_audit_logs")
}
```

---

## 3. Frontend Admin Console (`/admin/*`)

The admin dashboard is structured into dedicated, modular pages inside `frontend/app/admin/`:

### A. Dashboard Overview (`/admin`)
- **10 Core Metric Cards**:
  1. *Total Jobs Collected*: Aggregate count of all non-deleted jobs in MySQL.
  2. *Active Jobs*: Published, unexpired vacancies visible to job seekers.
  3. *Pending Classification*: Vacancies requiring AI classification or manual human review.
  4. *Expired / Closed*: Jobs past their closing deadline or manually closed.
  5. *Total Users*: Total registered accounts.
  6. *Active Users*: Users who logged in within the documented 30-day activity window.
  7. *Configured Sources*: Total integrated collection providers.
  8. *Enabled Sources*: Providers active in the automated cron scheduler.
  9. *Jobs Today*: Volume of vacancies ingested in the current calendar day.
  10. *Failed Collection Runs*: Total number of aborted or error-terminating scraping runs.
- **Collection Volume Trend (7-Day Area Chart)**: Visual breakdown of daily job acquisition.
- **System Health & Attention Banners**: Highlights sources overdue for collection or encountering consecutive scraper failures.
- **Recent Pipeline Feeds**: Live feeds of the latest collection runs and freshly ingested jobs.

### B. Jobs Management (`/admin/jobs`)
- **Full-Text Search & Filtering**: Multi-parameter search across job titles, companies, and external IDs, filtered by status (`PUBLISHED`, `PENDING_REVIEW`, `DRAFT`, `ARCHIVED`, `EXPIRED`) and source.
- **Deep Ingestion Comparison Drawer**: Side-by-side modal displaying the original unparsed source payload against the normalized, classified AI output (confidence score, taxonomy assignment, required skills, and salary).
- **Status Workflow Actions**: Publish, Archive, or Expire transitions with mandatory confirmation dialogs.
- **AI Reclassification Trigger**: Immediate re-dispatch of a vacancy to the Gemini AI classification engine.

### C. Sources & Scheduler (`/admin/sources`)
- **Provider Cards**: Health status, schedule frequency, total jobs contributed, and last run outcome.
- **Immediate Ingestion Trigger**: "Run Collection Now" action that triggers scraping in the background and reports immediate status.
- **Source Configuration Modal**: Configure fetch URLs, API endpoints, custom headers, and polling intervals with SSRF protection alerts.
- **Collection History Table**: Diagnostic logs showing items found, items saved, duration in milliseconds, and failure error messages.
- **Afriwork Diagnostic Integration**: Status banner for Afriwork scraper credentials and operational readiness.

### D. User Management & Governance (`/admin/users`)
- **User Directory**: Searchable list of platform accounts with role badges (`ADMIN` / `USER`), email verification status, and last activity timestamps.
- **Role Elevation & Demotion**: Assign or revoke `ADMIN` privileges with validation against self-demotion and last-admin extinction.
- **Account Suspension & Reactivation**: Toggle active state with immediate invalidation of refresh sessions for deactivated accounts.

### E. AI Classification & Taxonomy (`/admin/classifications`)
- **Low-Confidence Review Queue**: Dedicated queue for vacancies flagged with confidence scores below the 0.70 threshold.
- **One-Click Acceptance**: Quick verification of AI suggestions with immediate promotion to `PUBLISHED`.
- **Manual Category Override**: Dropdown interface with all 20 canonical taxonomy categories to correct classification errors.
- **Canonical Taxonomy Browser**: Reference display of the 20 pre-seeded job categories with icon representations and job counts.

### F. Site Settings & Branding (`/admin/settings`)
- **Branding & Identity Form**: Edit `siteName`, `tagline`, `description`, `logoUrl`, `faviconUrl`, `supportEmail`, and `footerText`.
- **Live Preview Card**: Real-time mock card demonstrating how public visitors see the updated branding.
- **Public Settings Synchronisation**: Settings are stored in the database and served publicly via `GET /api/v1/settings` with a 60-second caching header.

### G. Administrative Audit Trail (`/admin/audit-logs`)
- **Chronological Audit Table**: Traceable history of who changed what, target entity ID, IP address, and payload parameters.
- **Pagination & Time Formats**: Formatted relative and exact timestamps with JSON parameter inspection.

---

## 4. Backend REST API Reference

All routes under `/api/v1/admin` require an `Authorization: Bearer <token>` header containing a JWT with `role === 'ADMIN'`.

### Overview & Metrics
- `GET /api/v1/admin/dashboard`
  - **Summary**: Computes the 10 platform metrics, 7-day ingestion volume, overdue/failed sources, and recent run logs.
  - **Response (200 OK)**:
    ```json
    {
      "status": "success",
      "data": {
        "metrics": {
          "totalJobs": 12,
          "activeJobs": 10,
          "pendingJobs": 2,
          "expiredJobs": 0,
          "totalUsers": 5,
          "activeUsers": 3,
          "totalSources": 1,
          "enabledSources": 0,
          "jobsToday": 4,
          "failedRuns": 0
        },
        "trends": [{ "date": "2026-10-21", "count": 4 }],
        "failingSources": [],
        "recentRuns": [...],
        "recentJobs": [...]
      }
    }
    ```

### Jobs Management
- `GET /api/v1/admin/jobs?page=1&limit=20&search=engineer&status=PUBLISHED&sourceId=<uuid>`
  - **Summary**: Paginated query of jobs with filter parameters.
- `GET /api/v1/admin/jobs/:id`
  - **Summary**: Retrieves a job with its classification history and raw source data.
- `PATCH /api/v1/admin/jobs/:id/status`
  - **Body**: `{ "status": "PUBLISHED" | "ARCHIVED" | "EXPIRED" | "DRAFT" }`
  - **Audited**: Yes (`JOB_STATUS_UPDATE`).
- `POST /api/v1/admin/jobs/:id/reclassify`
  - **Summary**: Re-runs AI classification on the specified vacancy.
  - **Audited**: Yes (`JOB_RECLASSIFY`).

### Source Management
- `GET /api/v1/admin/sources`
  - **Summary**: Lists all configured sources with aggregated job counts and last collection run details.
- `POST /api/v1/admin/sources`
  - **Body**: `{ "name": "...", "code": "...", "baseUrl": "...", "cronExpression": "0 */2 * * *", "enabled": false }`
  - **Audited**: Yes (`SOURCE_CREATE`).
- `PUT /api/v1/admin/sources/:id`
  - **Body**: Updated source configuration fields.
  - **Audited**: Yes (`SOURCE_UPDATE`).
- `DELETE /api/v1/admin/sources/:id`
  - **Summary**: Deletes a source configuration (jobs are retained or unlinked according to foreign keys).
  - **Audited**: Yes (`SOURCE_DELETE`).
- `POST /api/v1/admin/sources/:id/run`
  - **Summary**: Dispatches an immediate asynchronous collection run for the source.
  - **Audited**: Yes (`SOURCE_TRIGGER_RUN`).
- `GET /api/v1/admin/sources/:id/runs`
  - **Summary**: Paginated execution log for the source.

### User Management
- `GET /api/v1/admin/users?page=1&limit=20&search=alex`
  - **Summary**: Paginated directory of registered accounts.
- `PATCH /api/v1/admin/users/:id/role`
  - **Body**: `{ "role": "USER" | "ADMIN" }`
  - **Validation**: Cannot demote yourself; cannot demote the last remaining active administrator.
  - **Audited**: Yes (`USER_ROLE_CHANGE`).
- `PATCH /api/v1/admin/users/:id/status`
  - **Body**: `{ "isActive": true | false }`
  - **Validation**: Cannot deactivate yourself; cannot deactivate the last remaining active administrator.
  - **Audited**: Yes (`USER_STATUS_CHANGE`).

### Classification Review & Taxonomy
- `GET /api/v1/admin/categories`
  - **Summary**: Lists all 20 canonical job categories with job counts.
- `GET /api/v1/admin/review-queue?page=1&limit=20`
  - **Summary**: Lists jobs requiring human review (confidence < 0.70 or unassigned).
- `POST /api/v1/admin/jobs/:id/review`
  - **Body**: `{ "action": "ACCEPT" }` or `{ "action": "OVERRIDE", "categoryId": "<uuid>" }`
  - **Audited**: Yes (`CLASSIFICATION_REVIEW`).

### Site Settings & Branding
- `GET /api/v1/admin/settings`
  - **Summary**: Returns key-value dictionary of branding options.
- `PUT /api/v1/admin/settings`
  - **Body**: `{ "settings": { "siteName": "...", "tagline": "...", "logoUrl": "..." } }`
  - **Audited**: Yes (`SETTINGS_UPDATE`).
- `GET /api/v1/settings` (Public Endpoint)
  - **Summary**: Public endpoint for frontend navbar and footer rendering with 60s cache control.

### Audit Log Inspection
- `GET /api/v1/admin/audit-logs?page=1&limit=50&targetType=USER`
  - **Summary**: Paginated administrative audit entries with administrator profiles.

---

## 5. Development Credentials & Seeding

For local development and testing, an administrative seed is provided:

- **Admin Email**: `admin@job.com`
- **Password**: `admin`
- **Role**: `ADMIN`
- **Email Verified**: `true`
- **Active**: `true`

To run the idempotent seeder against MySQL:
```bash
cd backend
npm run seed
```

---

## 6. Role-Based Post-Login Dashboard Redirection

When users authenticate via the landing page (`/`) sliding card or dedicated `/login` page:
1. **Administrator Accounts (`role === 'ADMIN'`)**:
   - Immediately redirect to the Admin Console overview: `/admin`.
   - The navigation bar renders the **Admin Console** badge linking directly to `/admin`.
   - The user profile pill in the navbar navigates directly to `/admin`.
2. **Standard User Accounts (`role === 'USER'`)**:
   - Immediately redirect to their user profile and personalized dashboard: `/profile`.
3. **Deep Link / Intercepted URL Handling (`returnUrl`)**:
   - If an unauthenticated user attempts to visit a protected route (e.g. `/admin/sources` or `/profile`), the application captures the destination in `?returnUrl=...`.
   - Upon successful sign-in, the user is forwarded to their originally requested URL.
   - Non-administrators attempting to provide an administrative `returnUrl` (e.g. `/admin/users`) are safeguarded and diverted to `/profile`.
   - Malicious open redirect parameters (e.g. `//external.com`) are rejected, safely falling back to the user's role-appropriate dashboard.
4. **Universal Dashboard Route (`/dashboard`)**:
   - Provides a single universal entry point for all roles.
   - Automatically directs administrators to `/admin` and regular users to `/profile`.

---

## 7. Verification and Testing

### Backend Test Suite
Run all unit and integration tests (79 tests across 20 suites):
```bash
cd backend
npm test
```

### TypeScript Typechecking
Validate strict type correctness across backend services and controllers:
```bash
cd backend
npm run typecheck
```

### Frontend Production Build
Compile and verify all static and dynamic admin routes:
```bash
cd frontend
npm run build
```
The build produces all 7 admin pages:
- `○ /admin`
- `○ /admin/jobs`
- `○ /admin/sources`
- `○ /admin/users`
- `○ /admin/classifications`
- `○ /admin/settings`
- `○ /admin/audit-logs`
