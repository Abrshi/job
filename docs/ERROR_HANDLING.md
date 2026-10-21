# Error Handling Standards — Job Aggregation Platform

## 1. Purpose

This document defines the standard error-handling architecture for the entire Job Aggregation Platform.

It covers both:

- **Frontend:** Next.js, React, TypeScript, and Tailwind CSS.
- **Backend:** Node.js, Express.js, TypeScript, and MySQL.

The goal is to make errors predictable, secure, easy to debug, and understandable to users.

All developers and AI coding agents must follow these guidelines when creating or modifying application features.

**Core principles:**

1. Handle errors explicitly instead of silently ignoring them.
2. Return consistent API error responses.
3. Show clear, user-friendly messages on the frontend.
4. Never expose sensitive technical details to users.
5. Log unexpected errors on the backend.
6. Avoid duplicating error-handling logic across features.
7. Preserve the existing architecture and conventions when implementing these standards.
8. Never claim an operation succeeded if it failed.

---

## 2. Error Categories

Errors must be classified according to their cause.

### 2.1 Validation Errors

Occur when submitted data is invalid or incomplete.

Examples:

- Required fields are missing.
- Email addresses have invalid formats.
- Passwords do not meet security requirements.
- Query parameters contain invalid values.
- Uploaded files violate size or format restrictions.

**HTTP status:** `400 Bad Request`

Use `422 Unprocessable Content` when the application explicitly distinguishes syntactically valid requests from semantically invalid data. Choose one convention and apply it consistently.

### 2.2 Authentication Errors

Occur when a user cannot prove their identity.

Examples:

- Missing authentication credentials.
- Expired or invalid access tokens.
- Invalid login credentials.
- Invalid refresh tokens.

**HTTP status:** `401 Unauthorized`

Never reveal whether an email address exists during login or password recovery unless the product's security policy explicitly permits that disclosure.

### 2.3 Authorization Errors

Occur when an authenticated user lacks permission to perform an operation.

Examples:

- Accessing an administrator-only endpoint.
- Editing another user's profile.
- Accessing a restricted dashboard.

**HTTP status:** `403 Forbidden`

The backend must enforce authorization. Hiding buttons in the frontend is not a security control.

### 2.4 Resource Errors

Occur when a requested resource cannot be found.

Examples:

- A job posting does not exist.
- A user profile cannot be found.
- A requested application record is unavailable.

**HTTP status:** `404 Not Found`

Do not reveal whether protected resources exist when doing so could expose private information.

### 2.5 Conflict Errors

Occur when a request conflicts with the current application state.

Examples:

- Registering an account with an already-registered email.
- Applying to the same job more than once.
- Updating a record that has changed since it was loaded.
- Violating a database uniqueness constraint.

**HTTP status:** `409 Conflict`

Translate known database constraint violations into appropriate application errors rather than returning raw database messages.

### 2.6 Rate-Limit Errors

Occur when a client exceeds an allowed request rate.

Examples:

- Repeated login attempts.
- Excessive password-reset requests.
- Too many requests to a public jobs endpoint.

**HTTP status:** `429 Too Many Requests`

Return a suitable retry indication when available. Apply stricter limits to sensitive authentication endpoints.

### 2.7 External Service Errors

Occur when an external dependency fails.

Examples:

- Email delivery failure.
- Job-source API unavailable.
- AI provider timeout.
- File storage service failure.

**HTTP status:** Usually `502 Bad Gateway`, `503 Service Unavailable`, or `504 Gateway Timeout`, depending on the failure.

Do not automatically retry operations that could create duplicate side effects. Use bounded retries, timeouts, and idempotency where appropriate.

### 2.8 Internal Server Errors

Occur when an unexpected failure prevents an operation from completing.

Examples:

- Unhandled exceptions.
- Unexpected database failures.
- Programming errors.
- Missing required server configuration.

**HTTP status:** `500 Internal Server Error`

Return a generic public message and record diagnostic details in server logs.

---

## 3. Backend Error-Handling Architecture

### 3.1 Centralized Error Handling

The backend must use a centralized error-handling system.

Avoid writing separate, inconsistent error-response logic in every controller.

The implementation should include the following responsibilities:

- **Application error types:** Represent expected operational errors with appropriate status codes and safe messages.
- **Validation layer:** Validate request bodies, route parameters, and query parameters before business logic executes.
- **Controllers:** Coordinate requests and responses without duplicating error-formatting logic.
- **Services:** Apply business rules and raise meaningful application errors when necessary.
- **Async error handling:** Ensure rejected promises and thrown errors from asynchronous handlers reach the central error handler.
- **Not-found handler:** Handle requests to unknown API routes.
- **Global error middleware:** Convert errors into standardized API responses.
- **Logging layer:** Record unexpected failures and useful diagnostic context.

Keep these responsibilities consistent with the existing backend folder structure. Do not introduce unnecessary architectural layers solely to handle errors.

### 3.2 Standard API Error Response

All backend API errors must follow a consistent JSON structure.

Example:

    {
      "success": false,
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Please check the submitted information.",
        "details": [
          {
            "field": "email",
            "message": "Enter a valid email address."
          }
        ],
        "requestId": "request-correlation-id"
      }
    }

Rules:

- `success` must always be `false` for errors.
- `error.code` must be a stable machine-readable identifier.
- `error.message` must be safe and understandable.
- `error.details` is optional and must contain only information safe to disclose.
- `error.requestId` should identify the request in server logs when a request ID is available.

Do not expose stack traces, SQL queries, database credentials, internal file paths, token values, environment variables, or raw third-party responses.

Successful API responses must follow the project's separately defined success-response convention.

### 3.3 Stable Error Codes

Use consistent error codes throughout the API.

Suggested codes:

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | Invalid request data |
| `AUTHENTICATION_REQUIRED` | Credentials are missing |
| `INVALID_CREDENTIALS` | Login credentials are invalid |
| `TOKEN_EXPIRED` | An access token has expired |
| `INVALID_TOKEN` | A token is invalid |
| `EMAIL_NOT_VERIFIED` | Email verification is required |
| `FORBIDDEN` | The operation is not permitted |
| `RESOURCE_NOT_FOUND` | The requested resource is unavailable |
| `RESOURCE_CONFLICT` | A resource conflicts with existing state |
| `RATE_LIMIT_EXCEEDED` | The request limit was exceeded |
| `DEPENDENCY_UNAVAILABLE` | A required external service is unavailable |
| `INTERNAL_SERVER_ERROR` | An unexpected server failure occurred |

Use additional domain-specific codes where necessary. Do not make frontend logic depend on message wording.

### 3.4 Async Errors

All asynchronous backend operations must have a defined error path.

Examples include:

- Database queries.
- Email delivery.
- Token refresh operations.
- File uploads.
- External API requests.
- AI service calls.

Avoid unhandled promise rejections and floating promises.

Use the async-handler pattern appropriate to the installed Express version. Verify the project's Express version before choosing an implementation strategy; do not assume Express 4 and Express 5 have identical async error behavior.

Never suppress errors with empty `catch` blocks.

If an error is handled locally, the code must either recover successfully or propagate the error to the appropriate handler.

### 3.5 Database Errors

## Database Error Handling — MySQL + Prisma ORM

### 1. Core Rules

The backend uses **Prisma ORM with MySQL** for database access.

- Use Prisma Client for database operations.
- Do not introduce raw MySQL queries when Prisma can handle the operation.
- Do not expose Prisma error messages, database details, or SQL statements to API consumers.
- Handle known Prisma errors centrally where practical.
- Translate database errors into stable application error codes and appropriate HTTP status codes.
- Do not treat every Prisma error as a missing resource.
- Preserve the original error for secure server-side diagnostics.
- Use transactions when multiple database operations must succeed or fail together.

### 2. Common Prisma Errors

| Prisma error | Meaning | Typical HTTP response |
|---|---|---|
| `P2002` | Unique constraint violation | `409 Conflict` |
| `P2003` | Foreign key constraint violation | `409 Conflict` or `400 Bad Request`, depending on context |
| `P2025` | Required record not found for an operation | `404 Not Found` when the resource is genuinely missing |
| `P2014` | Required relation violation | `409 Conflict` or `400 Bad Request`, depending on context |
| `P2024` | Timed out while acquiring a connection from the pool | `503 Service Unavailable` |
| `P1001` | Cannot reach the database server | `503 Service Unavailable` |
| `P1002` | Database server reached, but the connection timed out | `503 Service Unavailable` |
| `P1008` | Operation timed out | Depends on the operation; commonly `503` or `504` |
| `P2028` | Transaction API error | Depends on the cause; commonly `500` or a suitable conflict response |

These mappings are guidelines, not unconditional rules. The application must consider the operation, known failure cause, and whether the error is safe to expose.

Prisma error codes can vary by operation and failure context. Check the installed Prisma version and official documentation before implementing code-specific handling.

### 3. Prisma Error Categories

Handle Prisma errors according to their actual types.

**`PrismaClientKnownRequestError`**

Use this for known Prisma request errors with a Prisma error code. Handle recognized codes explicitly.

**`PrismaClientValidationError`**

Indicates invalid Prisma Client arguments or query construction. This may indicate a programming defect rather than invalid user input. Do not automatically return `400` for every occurrence.

**`PrismaClientInitializationError`**

Indicates a Prisma Client initialization or connection problem. Return a safe service-unavailable response when the database is temporarily unavailable.

**`PrismaClientUnknownRequestError`**

Indicates an unexpected request failure. Log sanitized diagnostic information and return a safe internal error unless a more specific cause is established.

**`PrismaClientRustPanicError`**

Where applicable to the installed Prisma version and engine configuration, this indicates a serious Prisma engine failure. Follow the version-specific recovery guidance and do not assume the client can safely continue operating.

Prisma error classes and available properties must be verified against the installed version.

### 4. Application-Level Handling

Prefer checking business conditions explicitly before performing operations when doing so is practical.

Examples:

- Check whether an email is already registered before returning a user-friendly registration error.
- Verify that a job exists before returning its details.
- Check application ownership before allowing a user to modify it.
- Use a unique database constraint as the final protection against concurrent duplicate writes.

Pre-checks do not replace database constraints. Two requests can pass the same pre-check simultaneously, so the application must still handle the resulting Prisma error safely.

### 5. Transactions

Use Prisma transactions for operations that require atomicity.

Requirements:

- Roll back related changes when a transaction fails.
- Do not report success before the transaction completes.
- Keep transaction scopes appropriately short.
- Handle transaction conflicts and timeouts according to the operation.
- Retry only recognized transient failures, with bounded attempts and backoff.
- Avoid repeating external side effects during a transaction retry.

Do not retry every Prisma error automatically.

### 6. Prisma Error-to-API Conversion

The centralized backend error handler should convert recognized Prisma errors into the platform's standard API error format.

Example response for a duplicate email:

    {
      "success": false,
      "error": {
        "code": "RESOURCE_CONFLICT",
        "message": "An account with this email already exists.",
        "requestId": "request-correlation-id"
      }
    }

The example is illustrative. The actual message must reflect the operation and must not reveal sensitive account information.

Do not return the raw Prisma error object or its metadata directly to the frontend.

### 7. Logging and Diagnostics

When logging Prisma failures:

- Record the request ID and relevant operation context.
- Record the Prisma error code when available.
- Include stack traces for unexpected failures in protected server logs.
- Avoid logging passwords, tokens, database URLs, or unnecessary personal information.
- Do not expose internal database names, schema details, SQL statements, or connection credentials to users.

### 8. Testing

Test the database error-handling layer for:

- Duplicate email registration.
- Duplicate job applications.
- Missing records.
- Invalid relationship references.
- Database connection failures.
- Transaction rollback.
- Concurrent duplicate requests.
- Connection-pool timeouts.
- Unexpected Prisma errors.
- Safe API responses and sanitized logging.

Use an isolated test database or controlled mocks. Never run destructive error tests against production data.

### 3.6 Authentication and Security

Authentication-related failures must be consistent and secure.

Requirements:

- Reject invalid or expired access tokens.
- Validate refresh tokens and rotate them according to the authentication design.
- Handle refresh-token reuse and revocation according to the security policy.
- Clear or invalidate authentication cookies when required.
- Use appropriate cookie attributes, including `HttpOnly`, `Secure` in production, and a suitable `SameSite` policy.
- Protect state-changing cookie-authenticated requests against CSRF where applicable.
- Never include tokens in error responses or logs.
- Do not trust frontend authorization checks.
- Avoid revealing sensitive account information through authentication errors.

A failed refresh operation must not silently leave the client in a falsely authenticated state.

### 3.7 Logging and Request IDs

Unexpected errors must be logged on the backend.

Logs should include, where applicable:

- Timestamp.
- Severity level.
- Request ID.
- HTTP method and route.
- Response status.
- Error code.
- Sanitized diagnostic message.
- Stack trace for unexpected server errors.
- Relevant operation or service context.

Do not log passwords, access tokens, refresh tokens, session cookies, database credentials, or unnecessary personal information.

Use structured logging where practical.

A request ID should be generated or safely validated at the request boundary and included in both logs and the API error response. Never trust arbitrary client-supplied identifiers without validation.

### 3.8 Error Middleware Ordering

The backend request pipeline should follow a consistent order appropriate to the existing application:

1. Request ID and request-context setup.
2. Security middleware and required request parsing.
3. Rate limiting where applicable.
4. Authentication and authorization middleware on protected routes.
5. API routes and validation.
6. API not-found handler.
7. Centralized error-handling middleware.

Adapt the order to middleware dependencies and the project's existing architecture. The central error handler must be registered after the routes it handles.

---

## 4. Frontend Error-Handling Architecture

### 4.1 Centralized API Client

The Next.js frontend must use a centralized API client or a shared API-request layer.

Do not duplicate token handling, response parsing, and error conversion across individual components.

The shared API layer should:

- Use the configured backend base URL.
- Parse successful and failed responses safely.
- Convert API failures into a predictable frontend error type.
- Handle network failures.
- Handle request timeouts or cancellation where supported.
- Preserve the backend's stable error code and request ID.
- Handle authentication failures according to the token-refresh strategy.
- Avoid leaking sensitive error details into the interface.

Keep the API client compatible with the project's actual authentication mechanism, including the chosen access-token and refresh-token storage strategy.

### 4.2 Standard Frontend Error Type

Normalize errors into a consistent internal representation.

Example:

    {
      "code": "VALIDATION_ERROR",
      "message": "Please check the submitted information.",
      "status": 400,
      "details": [
        {
          "field": "email",
          "message": "Enter a valid email address."
        }
      ],
      "requestId": "request-correlation-id"
    }

The frontend may add local-only properties, such as a network-error classification, when useful.

The frontend must tolerate malformed, empty, or non-JSON error responses without crashing.

### 4.3 Form Validation

Forms must provide clear validation feedback.

Requirements:

- Validate required fields.
- Validate formats and constraints.
- Display field-specific messages near the relevant inputs.
- Show a general error when the failure does not belong to one field.
- Preserve user-entered data after recoverable failures.
- Disable duplicate submissions while a request is in progress.
- Re-enable submission when the request fails.
- Avoid displaying the same error in multiple places unnecessarily.
- Keep server-side validation authoritative.

Client-side validation improves usability but does not replace backend validation.

### 4.4 Loading, Success, and Error States

Every asynchronous UI operation must have an appropriate state.

Typical states:

- `idle`
- `loading`
- `success`
- `error`

Apply these states to operations such as:

- Login and registration.
- Email verification.
- Loading job listings.
- Searching and filtering jobs.
- Viewing job details.
- Saving or applying to jobs.
- Updating user profiles.
- Uploading CVs.
- Loading dashboards.
- Refreshing authentication.

Do not leave the interface indefinitely loading after a failed request.

Use existing project conventions and shared components instead of introducing a separate state-management library without a clear need.

### 4.5 User-Friendly Messages

Messages must explain what happened and what the user can do next.

Examples:

| Situation | Suggested message |
|---|---|
| Network unavailable | Unable to connect. Check your internet connection and try again. |
| Invalid form data | Please check the highlighted fields. |
| Invalid login | Invalid email or password. |
| Expired session | Your session has expired. Please sign in again. |
| Permission denied | You do not have permission to perform this action. |
| Missing job | This job is unavailable or may have been removed. |
| Duplicate application | You have already applied to this job. |
| Server failure | Something went wrong. Please try again later. |
| Upload too large | The file is too large. Choose a smaller file and try again. |
| Rate limit reached | Too many attempts. Please wait before trying again. |

Use backend-provided messages only when they are explicitly designed for public display. Otherwise, map stable error codes to frontend messages.

Never display raw stack traces, SQL errors, internal server messages, or secrets.

### 4.6 Error Display Components

Use reusable UI patterns where appropriate:

- Field-level validation messages.
- Form-level error messages.
- Toast notifications for short-lived feedback.
- Inline error states for failed sections.
- Page-level error screens when a page cannot load.
- Retry actions for recoverable failures.
- Authentication prompts when the session is no longer valid.

Follow the existing frontend design system and accessibility standards.

Avoid using a toast as the only indication of a persistent error that the user needs to resolve.

### 4.7 Next.js Error Boundaries

Use the appropriate Next.js error-handling mechanisms for the installed router.

For the App Router:

- Use `error.tsx` for route-segment rendering failures.
- Use `global-error.tsx` for appropriate root-level failures.
- Use `not-found.tsx` for not-found UI.
- Use explicit handling for expected failures in forms and server actions.

For the Pages Router, use the mechanisms appropriate to that router instead.

Error boundaries do not automatically catch every asynchronous failure, event-handler error, or backend API error. Those must be handled at the appropriate request or operation boundary.

Keep error pages consistent with the application's visual design and provide a useful recovery action when possible.

### 4.8 Retry Behavior

Offer retries only when they are meaningful and safe.

Examples:

- Retry loading a job list after a temporary network failure.
- Retry loading a dashboard section.
- Retry an external API request when the operation is safe to repeat.

Do not blindly retry:

- Account creation.
- Job applications.
- Payment operations, if added later.
- Other mutations that could create duplicate records or side effects.

For mutations, use server-enforced idempotency where appropriate.

Avoid unlimited automatic retries. Use bounded retries and backoff for suitable transient failures.

---

## 5. Authentication Error Handling Across Both Layers

Authentication handling must be coordinated between Next.js and Express.

### Access-token expiration

1. The backend returns a consistent authentication error.
2. The frontend attempts the agreed refresh flow when appropriate.
3. The refresh process must be coordinated to avoid multiple simultaneous refresh requests.
4. If refresh succeeds, retry the original request at most once under the defined policy.
5. If refresh fails, clear the frontend's authenticated state and redirect or prompt the user to sign in.
6. Preserve a safe return destination when redirecting to the login interface.
7. Avoid infinite refresh and redirect loops.

### Important rules

- Do not refresh tokens for every `401` indiscriminately; distinguish refreshable access-token failures from invalid credentials and other authentication errors.
- Do not treat `403 Forbidden` as an expired session automatically.
- Do not expose tokens to client-side logs or error messages.
- Prevent simultaneous failed requests from causing uncontrolled refresh-token rotation.
- Do not assume that a successful refresh automatically authorizes the original operation.

The login and registration interfaces must display appropriate errors without revealing sensitive account details.

---

## 6. File Upload and External Service Failures

For CV uploads and future integrations:

- Validate file size and permitted file types on the backend.
- Treat browser-supplied MIME types as untrusted.
- Reject unsupported or malformed uploads with a clear response.
- Handle storage failures and request timeouts.
- Clean up incomplete uploads when necessary.
- Avoid exposing storage paths or provider credentials.
- Provide progress and failure feedback when supported.
- Allow a safe retry when the operation can be repeated.

For job-source APIs, AI providers, and email services:

- Set appropriate timeouts.
- Handle unavailable dependencies without crashing unrelated routes.
- Log sanitized diagnostic information.
- Distinguish a failed external request from a successful request returning no results.
- Avoid presenting stale or incomplete data as fresh and complete.
- Use bounded retries and appropriate circuit-breaking or backoff mechanisms when justified.

---

## 7. Error Handling for Job Aggregation Features

The following feature-specific rules apply to the platform.

### Job search and listings

- Invalid filters must produce clear validation feedback.
- Empty search results are a valid result, not an error.
- Failed requests must not be displayed as empty results.
- Pagination errors must be handled without breaking the entire page.
- Source synchronization failures must not be confused with the absence of jobs.

### Job details

- Handle deleted, expired, and unavailable jobs appropriately.
- Avoid displaying incomplete job details as if they were verified.
- Provide a way to return to search results.

### Job applications

- Validate application requirements on the backend.
- Handle duplicate applications consistently.
- Do not show an application as submitted until the backend confirms success.
- Protect against accidental duplicate submissions.
- Preserve safe form data after recoverable errors.

### CV uploads

- Explain file validation failures.
- Handle network interruptions and storage failures.
- Never report a successful upload before confirmation.

### AI-powered matching

- Handle provider outages and timeouts.
- Do not allow an AI failure to break unrelated core job-search features.
- Clearly distinguish unavailable recommendations from a legitimate absence of matches.
- Never expose API keys, prompts containing private data, or provider debugging output.
- Do not present failed AI-generated results as successful recommendations.

---

## 8. Accessibility and UX Requirements

Error messages must be accessible and understandable.

Requirements:

- Associate field errors with their corresponding inputs.
- Use appropriate `aria-invalid` and `aria-describedby` attributes where relevant.
- Announce important asynchronous feedback to assistive technologies.
- Do not rely on color alone to communicate an error.
- Keep error text readable and specific.
- Move focus appropriately when a form cannot be submitted because of validation errors.
- Avoid unexpectedly clearing fields after failures.
- Provide keyboard-accessible retry and recovery actions.

Error states must follow the project's established UI design system.

---

## 9. Testing Requirements

Error handling must be tested as part of feature implementation.

### Backend tests

Test:

- Invalid request bodies and query parameters.
- Missing and invalid authentication credentials.
- Expired access tokens and invalid refresh tokens.
- Unauthorized and forbidden requests.
- Missing resources.
- Duplicate records and uniqueness conflicts.
- Database connection failures and transaction rollbacks.
- External service timeouts.
- Rate limiting.
- Unknown API routes.
- Unexpected exceptions.
- Safe error-response formatting.
- Sensitive-data exclusion from logs and responses.

### Frontend tests

Test:

- Field-level validation.
- API validation errors.
- Network failures.
- Non-JSON and malformed API responses.
- Authentication expiration and refresh failures.
- Loading-state cleanup after errors.
- Retry actions.
- Duplicate-submission prevention.
- Page-level error boundaries.
- Empty states versus actual failures.
- Accessibility of error messages.

### Integration tests

Verify that the frontend correctly interprets backend status codes and error codes.

Verify that request IDs can be used to correlate frontend-visible failures with backend logs.

### End-to-end tests

Include scenarios such as:

1. Registering with invalid data.
2. Logging in with invalid credentials.
3. Attempting to access a protected feature without authentication.
4. Searching jobs while the API is unavailable.
5. Opening a job that no longer exists.
6. Submitting a duplicate application.
7. Uploading an unsupported CV file.
8. Recovering from an expired session.

Tests must not depend on real production credentials or uncontrolled external services.

---

## 10. Implementation Rules for AI Coding Agents

When implementing error handling in this repository, every coding agent must follow these rules:

1. Inspect the existing frontend and backend structure before making changes.
2. Check the installed framework versions and existing dependencies.
3. Read the project's architecture, authentication, API-response, and UI design documentation before implementation.
4. Reuse existing shared utilities and components where appropriate.
5. Do not introduce unnecessary libraries or architectural complexity.
6. Do not rewrite unrelated code.
7. Do not change API contracts without identifying affected consumers and documenting the change.
8. Keep error codes stable and machine-readable.
9. Do not swallow unexpected errors.
10. Never expose secrets, stack traces, SQL statements, or sensitive data to users.
11. Add or update tests for new error-handling behavior.
12. Run the relevant frontend and backend tests, lint checks, and type checks when available.
13. Report any checks that could not be run instead of claiming they passed.
14. Update the documentation when the established error-handling contract changes.

Before introducing a new convention, inspect the repository to determine whether an equivalent convention already exists.

---

## 11. Definition of Done

An error-handling implementation is complete only when:

- Expected failures are handled explicitly.
- Unexpected failures reach the centralized backend error handler or the appropriate framework boundary.
- API errors use the agreed response structure.
- Error codes and HTTP status codes are consistent.
- User-facing messages are understandable and safe.
- Loading indicators stop after failures.
- Recoverable failures provide appropriate recovery actions.
- Authentication refresh behavior cannot enter an uncontrolled retry loop.
- Sensitive information is excluded from public responses and logs.
- Relevant tests have been added or updated.
- Applicable tests, lint checks, and type checks have been run and their results reported.
- Documentation reflects any changed conventions.

---

## 12. Final Standard

**The backend is responsible for secure validation, business rules, authorization, consistent error responses, and diagnostic logging. The frontend is responsible for interpreting those responses, maintaining correct UI state, and communicating failures clearly to the user.**

Neither layer may assume that the other layer has handled every possible error.

Both layers must work together to provide reliable, secure, and maintainable error handling across the entire Job Aggregation Platform.
