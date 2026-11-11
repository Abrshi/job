# Ethiojobs Integration — Implementation Plan

## 1. Overview & Objective

The objective is to integrate **Ethiojobs** (`https://ethiojobs.net`) as a first-class job source in the existing Job Platform repository (`~/Desktop/starcher/job`). Jobs aggregated from Ethiojobs will appear in the existing job listings alongside HaHuJobs and Afriwork, using the canonical database schema, deduplication engine, AI-driven category classification, search filters, and application tracking.

---

## 2. Source Analysis & Observed Endpoint Findings

### A. Observed Endpoint
- **Target URL Pattern:** `GET https://ethiojobs.net/_next/data/<buildId>/en/jobs.json?page=<pageNumber>&isFeatured=false`
- **Observed Response Status:** HTTP 200 OK
- **Observed Response Structure:**
  - `pageProps.jobs.data`: Array of 12 job objects per page.
  - `pageProps.jobs.meta`: Pagination metadata (`pageNumber`, `itemsPerPage`, `lastPage`, `total`).
  - `pageProps.token`: Server-generated internal API token.

### B. Next.js Build ID Resolution
- Next.js dynamic data routes encode a changing deployment hash (`buildId`) into the route path (e.g. `QtcrrOcxu8l4IzwsA07Nh`).
- **Discovery Strategy:**
  1. The adapter checks for an optional manual override via `JobSource.headers` (`{ "buildId": "..." }`).
  2. If absent or expired, the adapter performs an initial HTTP GET to `https://ethiojobs.net/en/jobs` with a standard User-Agent header to extract `"buildId":"([^"]+)"` from the `<script id="__NEXT_DATA__">` tag.
  3. The resolved `buildId` is cached in memory with a 1-hour TTL.
  4. If an endpoint returns HTTP 404 (indicating an upstream redeployment and new build hash), the cache is invalidated immediately and refreshed.

### C. Authorization & Compliance Guardrails
- **Robots Guidance:** `https://ethiojobs.net/robots.txt` disallows `/auth/*`, `/api/*`, `/users/*`, and `/companies/functions*`, while permitting `/` and providing `sitemap-jobs.xml`.
- **Credential Safety:** The internal JWT token returned in `pageProps.token` is **never** hardcoded into source code, committed to Git, passed to the client frontend, printed in error logs, or reused as private authorization credentials.
- **Access Status:** The seeded source record is created in an **inactive** state (`isActive: false`) by default with a 120-minute polling period, ensuring automated polling is not enabled in production without administrative review and authorization.

---

## 3. Data Normalization & Canonical Schema Mapping

| Ethiojobs Source Field | Canonical `Job` Field | Transformation & Normalization Rules |
|---|---|---|
| `id` | `externalId` | Preserved as exact source string identifier (e.g. Laravel encrypted string `eyJpdiI6...`). |
| `id` / `slug` | `fingerprint` | Stable deterministic fingerprint `ext:<externalId>`. |
| `slug` | `originalUrl` | Formatted as canonical listing URL: `https://ethiojobs.net/jobs/${slug}`. |
| `title` | `originalTitle` & `normalizedTitle` | Preserved in original; HTML stripped and whitespace collapsed in normalized. |
| `description` | `originalDescription` & `normalizedDescription` | HTML preserved in original; sanitized and stripped in normalized. |
| `state` | `city` | State or region name (e.g. "Addis Ababa", "Oromia", "Hawassa"). |
| N/A | `country` | Defaults to `"Ethiopia"`. |
| `location_type` | `workArrangement` & `isRemote` | `Remote` -> `REMOTE` (`isRemote: true`), `Hybrid` -> `HYBRID`, `Office` / `On-site` -> `ON_SITE`. |
| `type` | `employmentType` | `8` -> `FULL_TIME`, `13` -> `CONTRACT` / `FREELANCE`; fallback textual heuristics for part-time, internship. |
| `level` | `experienceLevel` | `1` -> `ENTRY`, `2` -> `JUNIOR`, `3` -> `MID`, `4` -> `SENIOR`; strict textual keyword fallback; otherwise `UNSPECIFIED`. |
| `date_published` | `publishedAt` | ISO 8601 string parsed to `Date`. |
| `date_expiry` | `closingDate` | Vacancy deadline timestamp parsed to `Date`. |
| `company.name` | `companyName` | Normalized employer organization name. |
| `application_email` | `applicationUrl` | If email present and method is EMAIL: `mailto:${application_email}`. |
| `application_form` | `applicationUrl` | If valid HTTP URL: normalize and use. |
| `career_page_link` | `applicationUrl` | If valid HTTP URL: normalize and use. Fallback `null` (never invent fake URLs). |
| `catalogs` | Taxonomy hint in `rawPayload` | Category mapping hint matched to platform's 20 taxonomy categories. |
| Raw object | `rawPayload` | Full JSON object stored for auditability and source fidelity. |

---

## 4. Ingestion, Deduplication, & Concurrency Control

1. **Idempotent Upsert:**
   - Upsert key: `(sourceId, fingerprint)`.
   - Re-running synchronization never creates duplicate records. Existing jobs update `lastSeenAt`, `title`, and `description` without resetting user bookmarks or applications.
2. **Pagination & Bounded Crawling:**
   - Checkpoint tracks current page (`pageNumber`).
   - Limits: configurable page size (12 items per page from Next.js data route).
   - Stopping condition: `pageNumber >= lastPage` or empty `jobs.data`.
   - Rate limit delay: polite 1000ms delay between pages when crawling multiple pages.
3. **Resilience & Bounded Retries:**
   - 20-second timeout per request via `AbortController`.
   - Exponential backoff (up to 3 attempts) for transient 5xx HTTP errors or network interruptions.
   - Bounded error isolation: failures on a page do not mark unrelated jobs as expired.
4. **Lifecycle & Expiration Rules:**
   - Jobs with past `closingDate` transition to `EXPIRED`.
   - Active jobs without an explicit deadline receive a 30-day fallback expiration.

---

## 5. Frontend & Admin Integration

1. **Frontend Attribution:**
   - Job cards and details pages automatically attribute source name: `"Ethiojobs"`.
   - Filter dropdowns dynamically populate Ethiojobs from `GET /api/v1/jobs/sources`.
   - Added `{ slug: 'ethiojobs', name: 'Ethiojobs' }` to offline fallback list in `frontend/app/jobs/page.js`.
2. **Admin Source Management:**
   - Seeded in `backend/src/seeds/seed-sources.ts` with `slug: 'ethiojobs'`, `isActive: false`, `pollingInterval: 120`.
   - Admins can toggle `isActive`, update polling intervals, or trigger on-demand sync from `/admin/sources`.
   - CLI script `backend/scripts/sync-ethiojobs.ts` and npm script `npm run sync:ethiojobs`.

---

## 6. Testing Strategy

1. **Mock Fixture:**
   - `backend/tests/fixtures/ethiojobs-jobs.json` with sample real-world payload covering remote, hybrid, office, email applications, ATS forms, and varied levels.
2. **Unit Tests:**
   - `backend/tests/unit/ethiojobs-adapter.test.ts` verifying:
     - Normalization of raw job items into canonical schema.
     - Location, work arrangement, and employment type mappings.
     - Application URL routing (email vs. web ATS vs. career link).
     - Dynamic `buildId` extraction and fallback handling.
     - HTTP 401/403 access control handling.
     - Pagination checkpoint advancement and termination.
     - Ensuring tokens and sensitive headers are never logged or exposed.
3. **End-to-End Validation:**
   - `npm test --prefix backend`
   - `npm test --prefix frontend`
   - `npm run build --prefix backend`
   - `npm run build --prefix frontend`

