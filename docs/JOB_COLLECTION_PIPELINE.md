# Job Collection Pipeline & Admin Source Management Documentation

## 1. Overview & Architecture

The Job Collection Pipeline provides automated, resilient ingestion, normalization, deduplication, and AI-driven classification of job postings from diverse external job providers into a MySQL database via Prisma ORM.

### Architecture Components

```
                   +----------------------------------+
                   |     Dynamic Source Scheduler     |
                   |   (Per-source polling timers)    |
                   +----------------+-----------------+
                                    | Triggers run (with concurrency cap = 3)
                                    v
                   +----------------------------------+
                   |       SourcesService (Run)       |
                   +----------------+-----------------+
                                    | Resolves registered adapter
                                    v
                   +----------------------------------+
                   |     Source Adapter Registry      |
                   |   (e.g., AfriworkAdapter)        |
                   +----------------+-----------------+
                                    | Fetches external job records
                                    v
                   +----------------------------------+
                   | Normalization & Deduplication    |
                   | (Fingerprint: ext > url > hash)  |
                   +----------------+-----------------+
                                    | Upserts into MySQL
                                    v
                   +----------------------------------+
                   |    Asynchronous AI Classifier    |
                   | (Gemini 1.5 Flash + Heuristics)  |
                   +----------------+-----------------+
                                    | Categorizes & updates audit history
                                    v
                   +----------------------------------+
                   |  Job Classifications & Database  |
                   +----------------------------------+
```

---

## 2. Database Schema & Data Models

### A. JobSource (`job_sources`)
Represents an external provider feed or API endpoint.
- `id`: UUID (Primary Key)
- `name`: Human-readable source name (e.g., "Afriwork")
- `slug`: Unique identifier key (`@unique`, e.g., "afriwork")
- `sourceType`: Enum (`API`, `RSS`, `SCRAPER`)
- `endpointUrl`: Feed or GraphQL/REST URL (`VARCHAR(1000)`)
- `headers`: Optional JSON storing authentication tokens or custom headers (sanitized and stripped from administrative read responses)
- `isActive`: Boolean flag controlling automated scheduler polling
- `pollingInterval`: Polling period in minutes (validated between 5 and 10080 minutes)
- `lastRunAt`, `lastSuccessAt`, `nextRunAt`: Timestamp tracking for scheduler orchestration

### B. Job (`jobs`)
Normalized canonical job vacancy records.
- `id`: UUID (Primary Key)
- `sourceId`: Foreign Key referencing `job_sources.id`
- `externalId`: Source-specific identifier (e.g., Afriwork vacancy ID)
- `fingerprint`: Unique hash string for duplicate prevention (`ext:<id>`, `url:<sha256>`, or `content:<sha256>`)
- `categoryId`: Foreign Key referencing `job_categories.id` (primary assigned category)
- `classificationStatus`: Enum (`PENDING`, `CLASSIFIED`, `NEEDS_REVIEW`, `FAILED`)
- `status`: Enum (`DRAFT`, `PUBLISHED`, `EXPIRED`, `ARCHIVED`)
- `closingDate`: Expiration timestamp specified by source
- `expiresAt`: Enforced expiration timestamp (source closing date or 30-day fallback from `firstSeenAt`)
- Constraints: `@@unique([sourceId, fingerprint])` prevents duplicates per provider without merging across sources.

### C. JobCategory (`job_categories`)
The 20 predefined industry standard taxonomy categories.
- `id`: UUID (Primary Key)
- `name`: Category title (e.g., "Software & IT")
- `slug`: Unique URL-friendly slug (`@unique`)
- `description`: Textual summary utilized by the AI classification system prompt

### D. JobClassification (`job_classifications`)
Audit log and history of AI/heuristic classification passes for a job.
- `id`: UUID (Primary Key)
- `jobId`: Foreign Key referencing `jobs.id`
- `categoryId`: Reference to predicted `job_categories.id`
- `confidence`: Decimal score between `0.00` and `1.00`
- `status`: Classification review state (`AUTO_ACCEPTED`, `NEEDS_REVIEW`, `REJECTED`)
- `modelIdentifier`: AI model name (e.g., `gemini-1.5-flash` or `gemini-1.5-flash-heuristic-fallback`)
- `promptVersion`: System prompt version string (e.g., `v1.0.0`)
- `isCurrent`: Boolean flag designating the single active source of truth. When reclassifying, previous records transition to `isCurrent = false`.

### E. CollectionRun (`collection_runs`)
Execution history and observability metrics for data ingestion passes.
- `id`: UUID (Primary Key)
- `sourceId`: Foreign Key referencing `job_sources.id`
- `status`: Enum (`RUNNING`, `SUCCESS`, `FAILED`, `PARTIAL`)
- `startedAt`, `finishedAt`: Execution timestamps
- `recordsFetched`, `jobsCreated`, `jobsUpdated`, `jobsSkipped`: Numerical metrics
- `errorSummary`: Detailed error diagnostic when runs encounter issues

---

## 3. Afriwork Integration Findings & Adapter Implementation

### Endpoint Investigation Findings
- **Target Endpoint:** `https://api.afriworket.com/v1/graphql`
- **Authentication Model:**
  - Live inspection demonstrated that Afriwork utilizes a Hasura GraphQL engine backed by an authentication webhook (`Nuxt` web client with Bearer session authorization).
  - Anonymous HTTP POST requests to `https://api.afriworket.com/v1/graphql` return HTTP 200 with GraphQL error:
    ```json
    {
      "errors": [
        {
          "extensions": {
            "code": "access-denied",
            "path": "$"
          },
          "message": "Authentication hook unauthorized this request"
        }
      ]
    }
    ```
- **Architectural Decision:**
  - Per project requirements, the seeded `afriwork` source is created in an **inactive** state (`isActive: false`).
  - The `AfriworkAdapter` supports dynamic credentials passed through the `JobSource.headers` JSON column (`Authorization: Bearer <token>`).
  - When credentials are absent or rejected, the adapter catches the Hasura error and converts it into a structured domain error (`SOURCE_AUTH_REQUIRED`).
  - Offline testing is maintained via complete fixture data in `backend/tests/fixtures/afriwork-jobs.json`.

---

## 4. HaHuJobs Integration Architecture & Adapter Implementation

### Endpoint Investigation Findings
- **Target Endpoint:** `https://graph.aggregator.hahu.jobs/v1/graphql`
- **Protocol:** HTTP POST (Hasura GraphQL Engine)
- **Root Query Fields:**
  - `search_jobs(limit: Int!, offset: Int!, where: jobs_bool_exp!, order_by: [jobs_order_by!])`: Returns array of `jobs` records.
  - `search_jobs_aggregate(where: jobs_bool_exp!)`: Returns aggregate metrics (e.g. `{ aggregate: { count: 1441 } }`).
- **Standard Request Headers:**
  - `Content-Type: application/json`
  - `Accept: application/json`
  - `Origin: https://hahu.jobs`
  - `Referer: https://hahu.jobs/`
  - `User-Agent: Mozilla/5.0 ...`
  - Supports custom headers / tokens via `JobSource.headers` JSON column.
- **Architectural Guardrails & Compliance:**
  - The source is seeded in an **inactive** state (`isActive: false`) with slug `hahujobs` and 120-minute polling period.
  - The adapter treats the observed browser endpoint as an external integration candidate; automated bulk synchronization in production must respect upstream Terms of Service and rate limits.
  - Never logs authorization tokens, sensitive headers, or request secrets.
  - Uses bounded exponential backoff (up to 3 retries) and 20-second timeout with `AbortController`.
  - Filters out `requested_to_delete: true` and expired vacancies upstream while gracefully recording historical deadlines.

### Field Mapping Specification

| HaHuJobs GraphQL Field | Canonical `Job` Field | Transformation / Normalization |
|---|---|---|
| `id` | `externalId` | Preserved as exact source string identifier |
| `id` | `fingerprint` | Stable hash `ext:<id>` preventing duplicates |
| `title` | `originalTitle` & `normalizedTitle` | HTML-stripped, whitespace-collapsed string |
| `description` / `summary` | `originalDescription` & `normalizedDescription` | HTML tags stripped for clean reading |
| `entity.name` / `company.name` | `companyName` | Normalized employer organization name |
| `job_cities[0].city.name` / `location` | `city` | Cleaned city name (e.g. `", Addis abeba"` -> `"Addis Ababa"`) |
| N/A | `country` | Defaults to `"Ethiopia"` |
| `type` | `employmentType` | `full_time` -> `FULL_TIME`, `contract` -> `CONTRACT`, `part_time` -> `PART_TIME`, `internship` -> `INTERNSHIP`, `freelance` -> `FREELANCE` |
| `years_of_experience` | `experienceLevel` | `0` -> `ENTRY`, `1-2` -> `JUNIOR`, `3-5` -> `MID`, `>5` -> `SENIOR`, fallback `UNSPECIFIED` |
| `salary` | `salaryMin` & `salaryMax` | Numeric scalar amount (ETB) |
| `payment_period` | `salaryPeriod` | `monthly` -> `MONTHLY`, `hourly` -> `HOURLY`, `yearly` -> `YEARLY` |
| `posted_on` / `approved_on` | `publishedAt` | ISO 8601 timestamp parsed to `Date` |
| `deadline` | `closingDate` | Vacancy deadline timestamp |
| `url` | `originalUrl` | Upstream syndicated URL (e.g. Ethiojobs, Reporter) or `https://hahu.jobs/jobs/<id>` |
| `application_url` / `application_email` | `applicationUrl` | Direct URL or `mailto:<email>`. `null` if in-person or unavailable |
| `is_online` | `isRemote` & `workArrangement` | Evaluated with location keywords (`REMOTE`, `HYBRID`, `ON_SITE`) |
| Raw GraphQL record | `rawPayload` | Full JSON object stored for auditing and source fidelity |

---

## 5. Ethiojobs Integration Architecture & Adapter Implementation

### Endpoint Investigation Findings
- **Target Endpoint:** `GET https://ethiojobs.net/_next/data/<buildId>/en/jobs.json?page=<pageNumber>&isFeatured=false`
- **Protocol:** HTTP GET (Next.js Data Route)
- **Observed Response Structure:**
  - `pageProps.jobs.data`: Array of 12 job items per page
  - `pageProps.jobs.meta`: Pagination metadata (`pageNumber`, `itemsPerPage`, `lastPage`, `total`)
  - `pageProps.token`: Server-generated internal API token
- **Dynamic Next.js `buildId` Resolution:**
  - `buildId` dynamically extracted from `<script id="__NEXT_DATA__">` on `https://ethiojobs.net/en/jobs`.
  - Cached in memory for 1 hour; invalidated and refreshed automatically on HTTP 404 responses.
- **Architectural Guardrails & Compliance:**
  - Seeded in an **inactive** state (`isActive: false`) with slug `ethiojobs` and 120-minute polling period.
  - Never logs or exposes tokens or sensitive response headers.
  - Uses bounded exponential backoff (up to 3 retries) and 20-second timeout with `AbortController`.
  - Bounded pagination stopping when `pageNumber >= lastPage` or data array is empty.

### Field Mapping Specification

| Ethiojobs Field | Canonical `Job` Field | Transformation / Normalization |
|---|---|---|
| `id` | `externalId` | Preserved as exact source string identifier |
| `id` | `fingerprint` | Stable hash `ext:<id>` preventing duplicates |
| `title` | `originalTitle` & `normalizedTitle` | Preserved in original; HTML stripped and whitespace collapsed |
| `description` | `originalDescription` & `normalizedDescription` | HTML preserved in original; sanitized and stripped in normalized |
| `company.name` | `companyName` | Normalized employer organization name |
| `state` | `city` | State or region name (e.g. "Addis Ababa", "Oromia") |
| N/A | `country` | Defaults to `"Ethiopia"` |
| `location_type` | `isRemote` & `workArrangement` | `Remote` -> `REMOTE`, `Hybrid` -> `HYBRID`, `Office` -> `ON_SITE` |
| `type` | `employmentType` | `8` -> `FULL_TIME`, `13` -> `CONTRACT` / `FREELANCE`; fallback textual heuristics |
| `level` | `experienceLevel` | `1` -> `ENTRY`, `2` -> `JUNIOR`, `3` -> `MID`, `4` -> `SENIOR`; strict textual fallback |
| `date_published` | `publishedAt` | ISO 8601 timestamp parsed to `Date` |
| `date_expiry` | `closingDate` | Vacancy deadline timestamp |
| `slug` | `originalUrl` | `https://ethiojobs.net/jobs/<slug>` |
| `application_email` / `application_form` / `career_page_link` | `applicationUrl` | Direct URL or `mailto:<email>`. `null` if unavailable |
| `catalogs` | Taxonomy hint in `rawPayload` | Passed into classification hints and audit payload |
| Raw object | `rawPayload` | Full JSON object stored for auditing and source fidelity |

---

## 6. GeezJobs Integration Architecture & Adapter Implementation

### Endpoint Investigation Findings
- **Target Search Endpoint:** `GET https://geezjobs.com/search-jobs?page=<pageNumber>`
- **Target Detail Endpoint:** `GET https://geezjobs.com/job-detail/<slug>`
- **Sitemap Index:** `GET https://geezjobs.com/sitemap-detail`
- **Protocol:** HTTP GET over TLS (HTML with Tailwind & Schema.org JSON-LD)
- **Observed Response Structure:**
  - Search page embeds `ItemList` JSON-LD and HTML job cards.
  - Detail page embeds comprehensive `schema.org/JobPosting` JSON-LD.
- **Hostinger CDN Challenge & Networking:**
  - Requests require `Cookie: gj_ok=1` and modern `User-Agent`.
  - Node `https.Agent` configured with `family: 4` (`dns.lookup(hostname, { ...opts, family: 4 }, cb)`) and `keepAlive: true` to prevent IPv6 timeouts on Linux hosts.
- **Architectural Guardrails & Compliance:**
  - Seeded in an **inactive** state (`isActive: false`) with slug `geezjobs` and 120-minute polling period.
  - Bounded concurrency (3 parallel requests) and polite throttling between chunks.

### Field Mapping Specification

| GeezJobs Field | Canonical `Job` Field | Transformation / Normalization |
|---|---|---|
| `identifier.value` / `slug` | `externalId` | Preserved as exact source slug identifier |
| `identifier.value` / `slug` | `fingerprint` | Stable hash `ext:<externalId>` preventing duplicates |
| `title` | `originalTitle` & `normalizedTitle` | Trailing `" via GeezJobs"` stripped; HTML stripped and whitespace collapsed |
| `description` | `originalDescription` & `normalizedDescription` | HTML preserved in original; sanitized and stripped in normalized |
| `hiringOrganization.name` | `companyName` | Normalized employer organization name |
| `jobLocation.address.addressLocality` / `streetAddress` | `city` | State or region name (e.g. "Addis Ababa", "Hawassa") |
| `jobLocation.address.addressCountry` | `country` | Defaults to `"Ethiopia"` |
| `workHours` / text keywords | `isRemote` & `workArrangement` | `Remote` -> `REMOTE`, `Hybrid` -> `HYBRID`, else `ON_SITE` |
| `employmentType` | `employmentType` | `FULL_TIME`, `PART_TIME`, `CONTRACT`, `INTERNSHIP`, `FREELANCE` |
| Experience badges / text | `experienceLevel` | Parsed years: `ENTRY`, `JUNIOR`, `MID`, `SENIOR`, `LEAD`, `EXECUTIVE`, `UNSPECIFIED` |
| `baseSalary.value.minValue` | `salaryMin` | Decimal minimum salary |
| `baseSalary.value.maxValue` | `salaryMax` | Decimal maximum salary |
| `baseSalary.currency` | `salaryCurrency` | E.g. `"ETB"` |
| `baseSalary.unitText` | `salaryPeriod` | `"MONTH"` -> `MONTHLY`, `"YEAR"` -> `YEARLY`, `"HOUR"` -> `HOURLY` |
| `datePosted` | `publishedAt` | ISO 8601 timestamp parsed to `Date` |
| `validThrough` | `closingDate` | Vacancy deadline timestamp |
| `url` | `originalUrl` | `https://geezjobs.com/job-detail/<slug>` |
| Apply section email / URL | `applicationUrl` | Direct URL or `mailto:<email>`. `null` if unavailable |
| Raw object | `rawPayload` | Full JSON object stored for auditing and source fidelity |

---

## 7. Normalization & Deduplication Strategy

### Fingerprint Precedence
1. **External ID:** If the provider provides an explicit vacancy ID:
   `fingerprint = ext:<externalId>`
2. **Canonical URL:** If external ID is absent, normalize the URL (strip tracking parameters, lowercase domain, remove trailing slashes) and hash:
   `fingerprint = url:<sha256(normalizedUrl)>`
3. **Content Signature:** If neither ID nor URL is available, hash key textual attributes:
   `fingerprint = content:<sha256(title|company|description)>`

### Database Upsert Behavior
`JobsRepository.upsertJob` executes an atomic upsert on `(sourceId, fingerprint)`:
- **New vacancy:** Created with `isNew: true`, initial status `PUBLISHED`, and classification status `PENDING`.
- **Existing vacancy:** Updates title, description, and `lastSeenAt` without generating duplicate database rows (`isNew: false`).

### Expiration Policy
- If `closingDate` is provided and has elapsed, status transitions to `EXPIRED`.
- If `closingDate` is missing or in the future, a fallback expiration is applied at `firstSeenAt + 30 days`.

---

## 5. Asynchronous AI Classification Service

### Confidence Thresholds
- **High Confidence ($\ge 0.85$):**
  - Review Status: `AUTO_ACCEPTED`
  - Job Classification Status: `CLASSIFIED`
- **Medium Confidence ($0.60 \le \text{confidence} < 0.85$):**
  - Review Status: `NEEDS_REVIEW`
  - Job Classification Status: `NEEDS_REVIEW`
- **Low Confidence ($< 0.60$):**
  - Review Status: `REJECTED`
  - Job Classification Status: `NEEDS_REVIEW`

### Experience Level Strict Detection
The model and heuristic fallback strictly require explicit textual evidence for experience levels:
- `ENTRY`: Explicitly states entry level, fresh graduate, or internship.
- `JUNIOR`: Explicitly states junior or 1-2 years experience.
- `MID`: Explicitly states mid-level or 3-5 years experience.
- `SENIOR`: Explicitly states senior or 5+ years experience.
- `LEAD`: Explicitly states lead, principal, or manager.
- `EXECUTIVE`: Explicitly states director, VP, head of, or C-level.
- `UNSPECIFIED`: Default when experience is absent or ambiguous. Never assumes junior or entry.

### Heuristic Fallback
If `GEMINI_API_KEY` is omitted or in offline/isolated test environments, the system falls back to `classifyHeuristic()`, ensuring deterministic, testable classification across all 20 taxonomy categories without network dependencies.

---

## 6. Dynamic Source Scheduler

- **Polling Heartbeat:** Runs every 30 seconds by default.
- **Concurrency Cap:** Limits simultaneous runs across all sources to a maximum of 3 concurrent executions.
- **Per-Source Overlap Guard:** Prevents a source from triggering if another run is already in `RUNNING` status for that source (`SOURCE_RUN_IN_PROGRESS`).
- **Live Reconfiguration:** Whenever an admin creates or modifies a source (`POST /admin/sources` or `PATCH /admin/sources/:id`), `scheduler.refreshSchedule()` is invoked to recalculate due dates immediately without requiring server restarts.

---

## 7. Admin API Endpoints

All admin endpoints reside under `/api/v1/admin/sources` and require:
- `Authorization: Bearer <jwt_access_token>`
- User `role: ADMIN`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/admin/sources` | List all job sources with pagination (`page`, `limit`, `isActive`) |
| `GET` | `/api/v1/admin/sources/:id` | Get single source configuration (sensitive headers stripped) |
| `POST` | `/api/v1/admin/sources` | Create a new job source with SSRF validation |
| `PATCH` | `/api/v1/admin/sources/:id` | Update polling interval, URL, active state, or headers |
| `POST` | `/api/v1/admin/sources/:id/run` | Trigger an immediate manual collection run |
| `GET` | `/api/v1/admin/sources/:id/runs` | List execution history and metrics for a source |
| `GET` | `/api/v1/admin/sources/:id/stats` | Aggregate metrics (totalJobs, activeJobs, runs, success rate) |
| `GET` | `/api/v1/admin/sources/runs` | Global audit log of the most recent collection runs |

### SSRF Protection
The URL validation schema (`createSourceSchema` / `updateSourceSchema`) rejects:
- Loopback addresses (`127.0.0.1`, `localhost`)
- Private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
- Cloud instance metadata services (`169.254.169.254`, `metadata.google.internal`)
- Non-HTTP/HTTPS protocols (`file://`, `ftp://`, `gopher://`)

---

## 8. Operational & Seeding Commands

### Seeding
```bash
# Seed 20 job categories, initial Afriwork source, and default Admin account
npm run seed
```
- Admin credentials: `admin@job.com` / `admin` (Argon2id hash, verified email, blocked in production).

### Database Migrations
```bash
# Sync Prisma schema to MySQL
npx prisma db push
```

### Running Test Suite
```bash
# Execute entire test suite (67 unit and integration tests)
npm test

# Run individual integration test
npx tsx --test tests/integration/admin-sources-api.test.ts
npx tsx --test tests/integration/jobs-pipeline.test.ts
```
