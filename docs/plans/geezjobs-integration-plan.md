# GeezJobs Integration — Implementation Plan

## 1. Overview & Objective

The objective is to integrate **GeezJobs** (`https://geezjobs.com`) as an additional first-class job source in the existing Job Platform repository (`~/Desktop/starcher/job`). Vacancies collected from GeezJobs will appear in the existing job listings alongside HaHuJobs, Ethiojobs, and Afriwork, leveraging the canonical database schema, deduplication engine, AI-driven category classification, search filters, saved jobs, and application tracking features.

---

## 2. Source Analysis & Observed Endpoint Findings

### A. Observed Endpoints & Structure
- **Search Listing URL:** `GET https://geezjobs.com/search-jobs?page=<pageNumber>`
- **Detail Listing URL:** `GET https://geezjobs.com/job-detail/<slug>`
- **Sitemap Index:** `GET https://geezjobs.com/sitemap-detail` (listing ~4,200 active detail URLs)
- **Observed Response Status:** HTTP 200 OK
- **Observed Architecture:** Server-side rendered PHP/Blade with Tailwind CSS and standard **Schema.org** JSON-LD structured data.

### B. Anti-Bot & Hostinger CDN Challenge
- When accessing GeezJobs endpoints via non-browser clients, Hostinger CDN serves an initial JavaScript cookie challenge:
  ```html
  <script>
  document.cookie="gj_ok=1;path=/;max-age=86400";location.reload();
  </script>
  ```
- **Discovery & Resolution:**
  - All HTTP requests sent to `geezjobs.com` must include:
    - `Cookie: gj_ok=1`
    - `User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`
    - `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`
  - To prevent Node.js IPv6 DNS resolution timeouts (`ETIMEDOUT` / `ENETUNREACH`) on Linux environments where IPv6 is unrouted, an `https.Agent` configured with `family: 4` (`dns.lookup(hostname, { ...opts, family: 4 }, cb)`) and HTTP keep-alive socket pooling is used.

### C. Rich Structured Data (JSON-LD)
Each detail page (`/job-detail/<slug>`) embeds a complete `schema.org/JobPosting` block:
- `title`: Job title (with trailing `" via GeezJobs"` to be trimmed)
- `description`: Comprehensive HTML description covering Job Summary, Key Responsibilities, and Qualifications
- `identifier.value`: Unique, stable external slug ID (e.g. `import-and-export-operations-officer-geezjobs-recruitment-department`)
- `datePosted`: ISO 8601 publication timestamp
- `validThrough`: ISO 8601 deadline/expiration timestamp
- `employmentType`: Array of standardized employment types (e.g. `["FULL_TIME"]`)
- `hiringOrganization`: Employer name and logo URL
- `jobLocation.address`: Street address, locality, and country
- `baseSalary`: Currency (`ETB`), `minValue`, `maxValue`, and `unitText` (`MONTH`)

### D. Authorization & Compliance Guardrails
- **Robots Guidance:** `https://geezjobs.com/robots.txt` disallows `/search-jobs?`, `/mail/`, `/cvs/`, and admin paths, while providing `sitemap-detail`.
- **Default State:** Seeded source record is created in an **inactive** state (`isActive: false`) by default with a 120-minute polling period, ensuring automated polling is not enabled in production without administrative review and authorization.

---

## 3. Data Normalization & Canonical Schema Mapping

| GeezJobs Source Field | Canonical `Job` Field | Transformation & Normalization Rules |
|---|---|---|
| `identifier.value` / `slug` | `externalId` | Preserved as exact source slug identifier. |
| `identifier.value` / `slug` | `fingerprint` | Deterministic fingerprint `ext:<externalId>`. |
| `url` | `originalUrl` | Formatted as canonical listing URL: `https://geezjobs.com/job-detail/${slug}`. |
| `title` | `originalTitle` & `normalizedTitle` | Trailing `" via GeezJobs"` stripped; HTML stripped and whitespace collapsed in normalized. |
| `description` | `originalDescription` & `normalizedDescription` | Full HTML preserved in original; sanitized and stripped in normalized. |
| `jobLocation.address.addressLocality` / `streetAddress` | `city` | Parsed city (e.g. "Addis Ababa", "Hawassa", "Around Jackros"). |
| `jobLocation.address.addressCountry` | `country` | Normalized to `"Ethiopia"` (ET -> Ethiopia). |
| Text snippet / location | `workArrangement` & `isRemote` | Remote keywords -> `REMOTE` (`isRemote: true`), Hybrid -> `HYBRID`, else `ON_SITE`. |
| `employmentType` | `employmentType` | `FULL_TIME` -> `FULL_TIME`, `PART_TIME` -> `PART_TIME`, `CONTRACT` -> `CONTRACT`, `INTERNSHIP` -> `INTERNSHIP`, `FREELANCE` -> `FREELANCE`. |
| Experience badges / text | `experienceLevel` | Parsed years (e.g. "0-1" -> `ENTRY`, "1-2" -> `JUNIOR`, "2-5" -> `MID`, "5+" -> `SENIOR`), otherwise `UNSPECIFIED`. |
| `baseSalary.value.minValue` | `salaryMin` | Decimal minimum salary. |
| `baseSalary.value.maxValue` | `salaryMax` | Decimal maximum salary. |
| `baseSalary.currency` | `salaryCurrency` | E.g. `"ETB"`. |
| `baseSalary.unitText` | `salaryPeriod` | `"MONTH"` -> `MONTHLY`, `"YEAR"` -> `YEARLY`, `"HOUR"` -> `HOURLY`. |
| `datePosted` | `publishedAt` | ISO 8601 string parsed to `Date`. |
| `validThrough` | `closingDate` | Vacancy deadline timestamp parsed to `Date`. |
| `hiringOrganization.name` | `companyName` | Normalized employer organization name. |
| Apply section email / URL | `applicationUrl` | `mailto:...` if email application, or direct web ATS link. |
| Full raw payload | `rawPayload` | Full JSON object stored for auditability and source fidelity. |

---

## 4. Ingestion, Deduplication, & Concurrency Control

1. **Idempotent Upsert:**
   - Upsert key: `(sourceId, fingerprint)`.
   - Re-running synchronization never creates duplicate records. Existing jobs update `lastSeenAt`, `title`, and `description` without resetting user bookmarks or applications.
2. **Pagination & Bounded Crawling:**
   - Checkpoint tracks current page (`pageNumber`).
   - Stopping condition: `hasMore = false` when page results are empty or last page is reached.
   - Bounded polite concurrency: Fetches detail pages with socket reuse and polite delay.
3. **Resilience & Bounded Retries:**
   - 15-second timeout per request.
   - Fallback to search card metadata if an individual detail page is unavailable.
4. **Lifecycle & Expiration Rules:**
   - Jobs with past `validThrough` / `closingDate` transition to `EXPIRED`.
   - Active jobs without an explicit deadline receive a 30-day fallback expiration.

---

## 5. Frontend & Admin Integration

1. **Frontend Attribution:**
   - Job cards and details pages automatically attribute source name: `"GeezJobs"`.
   - Filter dropdowns dynamically populate GeezJobs from `GET /api/v1/jobs/sources`.
   - Added `{ slug: 'geezjobs', name: 'GeezJobs' }` to offline fallback list in `frontend/app/jobs/page.js`.
2. **Admin Source Management:**
   - Seeded in `backend/src/seeds/seed-sources.ts` with `slug: 'geezjobs'`, `isActive: false`, `pollingInterval: 120`.
   - CLI script `backend/scripts/sync-geezjobs.ts` and npm script `npm run sync:geezjobs`.

---

## 6. Testing Strategy

1. **Mock Fixture:**
   - `backend/tests/fixtures/geezjobs-page.html` (sample search page HTML).
   - `backend/tests/fixtures/geezjobs-detail.html` (sample detail page HTML with full JSON-LD).
2. **Unit Tests:**
   - `backend/tests/unit/geezjobs-adapter.test.ts` verifying:
     - Normalization of raw job items into canonical schema.
     - Title cleaning (stripping "via GeezJobs").
     - Salary, location, work arrangement, and employment type mappings.
     - Application URL routing (email vs. web application).
     - Deduplication fingerprint generation.

