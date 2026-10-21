# Centralized Error Handling Guide

This document describes the unified error-handling system implemented across the Job Aggregation Platform backend (Node.js/Express/TypeScript/Prisma) and frontend (Next.js/React/Tailwind CSS).

---

## 1. Architecture Overview

The error-handling system is designed around the following core principles:

1. **Standardized Contract**: All error responses from the API adhere to a single predictable JSON structure.
2. **Correlation & Traceability**: Every request is assigned a unique `requestId` (`X-Request-Id` header) that propagates across logs, error payloads, and frontend diagnostics.
3. **Information Security**: Internal database schema names, raw SQL queries, stack traces, passwords, tokens, and system credentials are never leaked in API responses or plaintext logs.
4. **Structured Sanitized Logging**: All server-side errors are logged with structured contextual metadata (`method`, `path`, `statusCode`, `code`, `requestId`, `cause`), with sensitive fields automatically redacted.
5. **Resilient Frontend Experience**: The frontend normalizes network failures, HTTP errors, and validation errors into a typed `ApiError`, handling automatic single-retry token refresh while showing accessible error boundaries and field-level form validation.

---

## 2. Standard API Error Response Format

All error responses from the backend return HTTP status codes in the `4xx` or `5xx` range with `Content-Type: application/json` and the following payload structure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed. Please check the submitted information.",
    "details": [
      {
        "field": "email",
        "message": "Email is already registered"
      }
    ],
    "requestId": "e77b54d3-756b-439e-bac8-74b1ec40cf9c"
  }
}
```

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `success` | `boolean` | Yes | Always `false` on error responses. |
| `error.code` | `string` | Yes | Stable, uppercase machine-readable error code. |
| `error.message` | `string` | Yes | Human-readable, safe user-facing error message. |
| `error.details` | `Array<{ field?: string, message: string }>` | No | Included for validation or field-specific errors. |
| `error.requestId` | `string` | Yes | Unique correlation UUID associated with the request. |

---

## 3. Error Code Catalog

| Error Code | HTTP Status | Description / Scenario |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body, query, or parameter schema validation failed. Contains `details` array. |
| `MALFORMED_JSON` | 400 | Request body JSON syntax could not be parsed by Express. |
| `BAD_REQUEST` | 400 | Generic invalid client request or bad input data. |
| `FOREIGN_KEY_VIOLATION` | 400 | Database relation constraint violated (e.g. invalid reference). |
| `AUTHENTICATION_REQUIRED` | 401 | Missing Bearer token or unauthenticated session. |
| `TOKEN_EXPIRED` | 401 | JWT access token has expired (triggers silent refresh on frontend). |
| `INVALID_TOKEN` | 401 | JWT signature verification failed or token is malformed. |
| `INVALID_CREDENTIALS` | 401 | Incorrect email or password during login. |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token is expired, revoked, or signature is invalid. |
| `FORBIDDEN` | 403 | Authenticated user lacks the required role or permission. |
| `NOT_FOUND` | 404 | Generic resource not found. |
| `ROUTE_NOT_FOUND` | 404 | Requested HTTP method and URL does not match any registered route. |
| `RECORD_NOT_FOUND` | 404 | Database entity not found (`P2025`). |
| `USER_NOT_FOUND` | 404 | User account does not exist. |
| `CONFLICT` | 409 | Resource conflict or unique constraint collision (`P2002`). |
| `EMAIL_ALREADY_EXISTS` | 409 | Attempted registration with an existing email address. |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests in a given time window. |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled exception or unexpected server failure. Generic message in production. |
| `DATABASE_ERROR` | 500 | Unhandled database error (raw query text concealed). |
| `DATABASE_TIMEOUT` | 503 / 504 | Database connection pool timeout (`P2024`) or query timeout (`P1008`). |
| `DATABASE_UNAVAILABLE` | 503 | Database service unreachable or connection rejected (`P1001`/`P1002`). |
| `NETWORK_ERROR` | 0 | Client-side only: fetch failed due to lack of network connection or CORS. |
| `SESSION_EXPIRED` | 401 | Client-side only: both access and refresh tokens failed; user must re-authenticate. |

---

## 4. Backend Implementation

### 4.1 Reusable `AppError`

Located in `backend/src/middleware/error-handler.ts`:

- Inherits from `Error`.
- Captures `statusCode`, `code`, `details`, `cause`, and `isOperational`.
- Factory methods:
  - `AppError.badRequest(message, code?, details?, cause?)`
  - `AppError.unauthorized(message?, code?, cause?)`
  - `AppError.forbidden(message?, code?, cause?)`
  - `AppError.notFound(message?, code?, cause?)`
  - `AppError.conflict(message, code?, details?, cause?)`
  - `AppError.validation(message, details, cause?)`
  - `AppError.internal(message?, cause?)`

### 4.2 Request Correlation ID (`X-Request-Id`)

Located in `backend/src/middleware/request-id.ts`:

- Attached as early as possible in `app.ts`.
- Reads `req.headers['x-request-id']` or generates `crypto.randomUUID()`.
- Sets `req.id` and the `X-Request-Id` response header.
- Propagated into all logs and error JSON payloads.

### 4.3 Prisma Database Error Mapping

`mapPrismaError(err)` translates known Prisma exceptions into safe, operational `AppError` instances:

| Prisma Code / Type | Mapped AppError Status & Code | Safe Public Message |
|---|---|---|
| `P2002` (Unique constraint) | `409 CONFLICT` | "A record with this [field] already exists." Field added to `details`. |
| `P2025` (Record not found) | `404 RECORD_NOT_FOUND` | "The requested record was not found." |
| `P2003` (Foreign key violation) | `400 FOREIGN_KEY_VIOLATION` | "Referenced record does not exist or relation constraint violated." |
| `P2014` (Relation constraint) | `400 RELATION_VIOLATION` | "Operation violates a required database relation." |
| `P2024` (Pool timeout) | `503 DATABASE_TIMEOUT` | "Database connection timed out. Please try again later." |
| `P1008` (Operation timeout) | `504 DATABASE_TIMEOUT` | "Database operation timed out. Please try again later." |
| `P1000`-`P1003` (Connection failed) | `503 DATABASE_UNAVAILABLE` | "Database service temporarily unavailable." |
| `PrismaClientValidationError` | `400 DATABASE_VALIDATION_ERROR`| "Invalid database query parameters." |
| `PrismaClientRustPanicError` | `500 INTERNAL_SERVER_ERROR` | "Internal database engine error." |

### 4.4 Centralized Error Handler Middleware

Located in `backend/src/middleware/error-handler.ts`:

- Normalizes any incoming error via `normalizeError()`.
- Serializes the standard error JSON response.
- In production (`NODE_ENV === 'production'`), non-operational 500 errors conceal their raw message behind a safe fallback: `"An unexpected error occurred. Please try again later."`
- Logs structured error details with `logger.error()`.

### 4.5 Sanitized Logging

Located in `backend/src/lib/logger.ts`:

- Recursive `sanitize()` function detects sensitive keys (matching `/password|token|secret|authorization|cookie|hash/i`) and replaces their values with `"[REDACTED]"`.
- Prevents authorization tokens, session cookies, and user credentials from appearing in standard error logs.

---

## 5. Frontend Implementation

### 5.1 `ApiError` Class and Normalization

Located in `frontend/lib/api-client.js`:

```javascript
export class ApiError extends Error {
  name = 'ApiError';
  status;       // HTTP status code (0 for network errors)
  code;         // Machine-readable code (e.g. 'VALIDATION_ERROR')
  details;      // Array of { field, message }
  fieldErrors;  // Computed map: { [field]: message }
  requestId;    // Server correlation ID or null
  isNetworkError; // boolean
  raw;          // Raw payload
}
```

- **JSON responses**: Extracts `code`, `message`, `details`, and `requestId`.
- **HTML/Non-JSON responses**: Reverse proxies (nginx/Cloudflare) or crashes returning HTML 502/504 are normalized to safe human-readable messages without dumping raw HTML into the UI.
- **Network disconnects**: Sets `isNetworkError = true`, `status = 0`, and friendly connectivity message.
- **Field Errors Map**: Convenience getter `err.fieldErrors` allows direct lookup: `err.fieldErrors.email`.

### 5.2 Token Refresh Coordination

- Automatically triggers a silent refresh if a protected endpoint returns 401 with `TOKEN_EXPIRED`.
- Prevents concurrent duplicate refresh requests by memoizing the pending `refreshPromise`.
- On successful refresh, retries the original request once (`isRetry = true`).
- If refresh fails, invokes `notifySessionExpired()`, clears memory tokens, and dispatches a clean `SESSION_EXPIRED` error.

### 5.3 Form Validation Error Handling

Located in `frontend/components/auth-card.js`:

- Submitting login or registration catches `ApiError`.
- If `err.fieldErrors` is present, it directly maps field-specific messages to the inputs (`loginErrors` or `regErrors`), triggering visible red validation borders and error text.
- If top-level error exists, sets the card banner alert (`loginSubmitError` or `regSubmitError`).

### 5.4 Next.js App Router Error Boundaries

- **`frontend/app/error.js`**: Segment-level error boundary. Catches page-level rendering and interaction errors. Shows a styled card with "Try Again" and "Back to Home" actions, including the error digest for debugging without exposing stack traces.
- **`frontend/app/global-error.js`**: Root layout error boundary. Renders fallback HTML/body if the root layout itself encounters a fatal error.
- **`frontend/app/not-found.js`**: Global 404 page styled with the Stormy Morning palette.

---

## 6. Verification and Testing

### Backend Test Suite

Run backend type checking and automated tests:

```bash
cd backend
npm run typecheck
npm test
```

Test coverage includes:
- `tests/unit/error-handler.test.ts`: `AppError` instantiation, factories, `mapPrismaError` codes, `normalizeError`, and production error redaction.
- `tests/unit/middleware.test.ts`: `requestIdMiddleware`, `validate`, `authenticate` (expired token vs missing token), and `authorize`.
- `tests/integration/error-handling.test.ts`: Live HTTP tests verifying 404 route handling, `X-Request-Id` propagation, validation error responses, and malformed JSON handling.

### Frontend Test Suite

Run frontend linting, testing, and production build:

```bash
cd frontend
npm run lint
npm test
npm run build
```

Test coverage includes:
- `tests/api-client.test.js`: `ApiError` class, `fieldErrors` map computation, standard JSON response normalization, HTML response fallback, and network failure handling.

---

## 7. Manual Testing Steps

1. **Verify 404 Route Response**:
   ```bash
   curl -i http://localhost:5000/api/v1/invalid-route
   ```
   *Expected:* HTTP 404, `X-Request-Id` header present, JSON `{ success: false, error: { code: "ROUTE_NOT_FOUND", ... } }`.

2. **Verify Field Validation Error**:
   ```bash
   curl -i -X POST http://localhost:5000/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email": "not-valid"}'
   ```
   *Expected:* HTTP 400, `code: "VALIDATION_ERROR"`, `details` containing field-level issues for `email` and `password`.

3. **Verify Request ID Correlation**:
   ```bash
   curl -i http://localhost:5000/api/v1/invalid-route -H "X-Request-Id: trace-custom-999"
   ```
   *Expected:* `X-Request-Id: trace-custom-999` in response headers and `"requestId": "trace-custom-999"` in the response body.

4. **Verify Malformed JSON Handling**:
   ```bash
   curl -i -X POST http://localhost:5000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{ broken-json '
   ```
   *Expected:* HTTP 400 with `code: "MALFORMED_JSON"`.

5. **Verify Frontend Form Validation**:
   - Open `http://localhost:3000`.
   - Submit registration with duplicate email.
   - The email input displays a red outline and specific error message ("Email is already registered").
