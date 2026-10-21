# Backend Authentication System — Implementation Guide

## 1. Purpose

Implement a secure, production-oriented authentication system for the job aggregation platform.

The system must support:

- Email and password registration.
- Login and logout.
- JWT access tokens.
- Refresh-token rotation and reuse detection.
- PostgreSQL database access through Prisma ORM.
- Email verification.
- Password reset.
- Session management and revocation.
- Role-based authorization.
- Protected API routes.
- Security-focused validation and automated tests.

**Implementation rule:** Follow the existing backend folder-structure document strictly. Do not create a competing architecture, rename existing directories, or introduce unnecessary folders. Inspect the repository before making changes.

## 2. Technology Stack

| Responsibility | Technology |
|---|---|
| Runtime | Node.js |
| Backend framework | Express.js |
| Database | PostgreSQL |
| ORM | Prisma ORM |
| Authentication | JWT access tokens |
| Password hashing | Argon2id |
| Request validation | Zod |
| API testing | Existing test framework, or Vitest if none exists |
| Email | Configurable email service |
| Environment configuration | dotenv or the existing configuration system |

Use TypeScript if the existing backend is configured for TypeScript. Otherwise, preserve its established language and module system unless a deliberate migration is approved.

Use compatible, stable package versions. Do not upgrade unrelated dependencies.

## 3. Authentication Architecture

The Express backend is responsible for authentication and authorization.

The Next.js frontend must not independently decide whether a user has permission to access protected resources.

PostgreSQL stores users, refresh-token sessions, email-verification records, and password-reset records. Prisma manages database queries and migrations.

### Access tokens

- Lifetime: 10 minutes.
- Format: signed JWT.
- Purpose: authenticate API requests.
- Transport: `Authorization: Bearer <token>`.
- Storage: frontend memory, not `localStorage` or `sessionStorage`.
- Validation: verify signature, allowed algorithm, issuer, audience, expiry, and required claims.
- Claims: include the user's ID and role only as needed.

### Refresh tokens

- Initial session inactivity limit: 7 days.
- Absolute session lifetime: 30 days.
- Transport: Secure, HttpOnly cookie in production.
- Storage: persist only a cryptographic hash in PostgreSQL.
- Rotation: issue a new refresh token whenever a valid refresh is used.
- Revocation: support individual-session and all-session revocation.
- Reuse detection: detect attempts to reuse an invalidated token and revoke the affected token family.

Do not store raw refresh tokens in the database or logs.

### Session expiry

Every refresh must enforce both the inactivity deadline and the original absolute expiry. Rotating a token must never extend the absolute expiry indefinitely.

Update the last-used timestamp only after successful validation. Use database transactions to prevent concurrent refresh requests from successfully rotating the same token more than once.

## 4. Repository and Folder-Structure Rules

Before coding:

1. Read the backend folder-structure document.
2. Inspect the current backend files and package configuration.
3. Identify existing database, Prisma, environment, routing, middleware, controller, service, and test conventions.
4. Map each authentication responsibility to the existing approved directories.
5. Present the proposed file changes before implementation if the required locations are ambiguous.

Do not invent a new folder hierarchy in this document.

Do not create duplicate authentication modules, duplicate Prisma clients, or multiple competing configuration systems.

Keep business logic, HTTP request handling, validation, database access, and security middleware separated according to the existing architecture.

## 5. Database Design

Use Prisma models backed by PostgreSQL. Adapt model names and relationships to the existing Prisma schema without breaking other features.

### User

The user model must support:

- Unique email address.
- Password hash.
- Role.
- Email verification status and verification timestamp.
- Account status.
- Creation and update timestamps.

Use `USER` as the default role. Support `ADMIN` for authorized administrators.

Email addresses must be normalized consistently before registration and login. Enforce uniqueness at the database level.

Never accept an arbitrary role from public registration requests.

### RefreshTokenSession

Represent each authenticated device or browser session.

Store the minimum information needed for:

- Session ID.
- User relationship.
- Current refresh-token hash.
- Session-family identifier.
- Creation timestamp.
- Last-used timestamp.
- Inactivity expiry.
- Absolute expiry.
- Revocation timestamp and reason, where appropriate.

If individual token records are needed to support rotation and reuse detection, model the token history or family relationship explicitly.

Ensure database constraints and transactions protect rotation against race conditions.

### EmailVerificationToken

Store:

- User relationship.
- Hash of the random verification token.
- Expiry timestamp.
- Consumption timestamp.
- Creation timestamp.

Verification tokens must be single-use.

### PasswordResetToken

Store:

- User relationship.
- Hash of the random reset token.
- Expiry timestamp.
- Consumption timestamp.
- Creation timestamp.

Reset tokens must be single-use and invalid after their expiry.

Use appropriate unique constraints and indexes. Add migrations through Prisma; do not modify production tables manually.

## 6. Environment Configuration

Use the existing environment configuration conventions.

The implementation will need appropriately named variables for:

- PostgreSQL connection string.
- Access-token signing secret or private key.
- Refresh-token signing secret or private key, if refresh tokens are JWTs.
- Access-token issuer and audience.
- Frontend origin.
- Backend public URL.
- Cookie security and domain configuration.
- Email service credentials and sender address.
- Application environment.

Validate required environment variables when the application starts. Fail safely if mandatory production secrets are missing.

Use different secrets for different purposes. Generate high-entropy secrets and never commit real secrets or `.env` files.

Provide an `.env.example` containing placeholder values only.

Do not assume the frontend and backend share a domain. Configure CORS, cookie scope, and CSRF defenses according to the actual deployment domains.

## 7. API Endpoints

Follow the project's existing API versioning and route conventions.

Implement these capabilities:

| Endpoint capability | Authentication | Purpose |
|---|---|---|
| Register | Public | Create an account with the default `USER` role |
| Login | Public | Validate credentials and create a session |
| Refresh | Refresh cookie | Rotate the refresh token and issue a new access token |
| Logout | Refresh cookie or authenticated session | Revoke the current session and clear its cookie |
| Logout all | Authenticated | Revoke the user's active sessions |
| Get current user | Access token | Return the authenticated user's safe profile |
| Verify email | Public, single-use token | Verify ownership of the email address |
| Resend verification | Public, rate-limited | Request another verification email |
| Forgot password | Public, rate-limited | Request a password-reset email |
| Reset password | Public, single-use token | Set a new password |
| Change password | Authenticated | Change the password and revoke affected sessions |
| List sessions | Authenticated | View the user's active sessions |
| Revoke session | Authenticated | Revoke a session owned by the user |

Use generic responses for registration, verification-resend, and password-reset requests where needed to prevent account enumeration.

Validate all request bodies, parameters, and query values.

Return consistent response formats and appropriate HTTP status codes without exposing internal errors.

## 8. Registration and Login

### Registration flow

1. Validate and normalize the submitted email address.
2. Validate the password against the documented password policy.
3. Check for an existing account without relying on a race-prone pre-check for uniqueness.
4. Hash the password using Argon2id with a reviewed production-appropriate configuration.
5. Create the user with the default `USER` role and an unverified email status.
6. Generate a cryptographically random verification token.
7. Store only the verification token hash with its expiry.
8. Send the verification link through the configured email service.
9. Return a safe response without exposing the password hash or raw token.

Handle duplicate-email races through database constraints and safe error mapping.

### Login flow

1. Validate the request.
2. Find the account using the normalized email.
3. Verify the password with Argon2id.
4. Use a generic error response for invalid credentials.
5. Enforce account status and applicable login restrictions.
6. Create a refresh session.
7. Issue a short-lived access token.
8. Set the refresh cookie with the correct security attributes.
9. Return a safe user profile and access token.

Do not permit suspended or disabled accounts to authenticate.

Do not include password hashes, refresh tokens, reset tokens, or verification tokens in responses.

Decide explicitly whether unverified users may receive a restricted authenticated session. Regardless, they must not access personalized features that require verified email ownership.

## 9. Refresh and Revocation

### Refresh flow

1. Read the refresh cookie.
2. Validate its signature and required claims if it is a JWT.
3. Locate the corresponding session and validate its stored token hash.
4. Verify that the session is active and within both expiry limits.
5. Atomically invalidate the old token and store the new token hash.
6. Issue a new access token and refresh token.
7. Replace the refresh cookie.
8. Return the new access token.

Use a database transaction or equivalent atomic operation to prevent duplicate successful rotation.

### Reuse detection

If a previously rotated token is presented again, treat it as a potential compromise.

- Revoke the affected token family or session according to the implemented design.
- Require the user to authenticate again.
- Record a security event without recording the raw token.
- Return a generic authentication error.

Define how concurrent browser tabs and retried network requests behave. Do not silently disable reuse detection to solve race conditions.

### Logout

Logout must revoke the server-side session and clear the refresh cookie using matching cookie attributes.

Logout-all must revoke all applicable active sessions. Password changes and suspected compromise must invalidate sessions according to the security policy.

## 10. Cookie and CSRF Security

Production refresh cookies must use:

- `HttpOnly`.
- `Secure`.
- An appropriate `SameSite` policy.
- A restricted path, ideally limited to refresh and logout endpoints where compatible with the API design.
- The narrowest practical domain scope.

Do not set a broad cookie domain unnecessarily.

If the frontend and API are cross-site, determine whether `SameSite=None; Secure` is required and implement explicit CSRF protection.

Use a CSRF token or another well-reviewed defense for cookie-authenticated state-changing requests when required by the deployment model.

Configure CORS with explicit trusted origins and credentials only where needed. Never combine credentialed requests with a wildcard origin.

## 11. Email Verification

Email verification must use a separate random, single-use token rather than an access token.

- Generate tokens using a cryptographically secure random generator.
- Store only the token hash.
- Apply a documented expiry.
- Validate and consume the token atomically.
- Prevent replay.
- Do not expose whether another account exists through resend responses.

Public job browsing and search remain available without verification.

Block CV uploads, personalized job recommendations, and other designated personalized features until the user's email is verified.

Enforce verification requirements in Express, not only in the Next.js interface.

## 12. Password Reset and Password Changes

### Password reset

1. Accept a reset request without revealing whether the account exists.
2. Generate a random, single-use token.
3. Store its hash and expiry.
4. Send a reset link through the email service.
5. Validate and consume the token atomically.
6. Hash the new password with Argon2id.
7. Invalidate existing sessions.
8. Notify the account owner where supported.

Do not log reset links or raw reset tokens.

### Password change

Require an authenticated user and, where appropriate, confirmation of the current password.

After a successful change:

- Store the new Argon2id hash.
- Revoke other active sessions.
- Apply the defined policy to the current session.
- Send a security notification.

## 13. Authentication and Authorization Middleware

Implement authentication middleware that validates access tokens and establishes a trusted authenticated-user context.

Implement authorization middleware for role checks and other explicit permissions.

Requirements:

- Verify JWT signatures using an explicit algorithm allowlist.
- Validate issuer, audience, expiry, and required claims.
- Reject malformed, expired, or invalid tokens.
- Do not trust user IDs or roles supplied in request bodies.
- Verify resource ownership for CVs, saved jobs, profiles, and sessions.
- Protect administrative endpoints on the backend.
- Never grant `ADMIN` through public registration.
- Do not rely on frontend route guards as a security boundary.

A valid access token establishes identity; it does not automatically authorize every operation.

## 14. Security Middleware and Operational Controls

Configure the existing Express application to include:

- Helmet or equivalent security headers.
- Request body-size limits.
- Strict input validation.
- Rate limiting for login, registration, verification, refresh, and password-reset endpoints.
- Safe CORS configuration.
- Centralized error handling.
- Production-safe logging.
- HTTPS in production.
- Secret management through environment configuration.

Avoid logging passwords, raw tokens, authorization headers, session cookies, or sensitive verification URLs.

Use structured security events for login failures, refresh-token reuse, password changes, and session revocation without exposing credentials.

Consider breached-password checks and additional account-protection controls as later enhancements.

## 15. Testing Requirements

Implement automated tests using the existing test framework.

### Registration and login

- Valid registration.
- Duplicate email.
- Invalid email and password.
- Successful login.
- Invalid credentials.
- Suspended account.
- Public registration cannot create an administrator.

### Token handling

- Valid access token.
- Expired access token.
- Invalid signature.
- Invalid issuer or audience.
- Expired refresh session.
- Successful refresh rotation.
- Reuse of an old refresh token.
- Concurrent refresh attempts.
- Logout and subsequent refresh rejection.
- Logout-all.
- Absolute expiry enforcement.

### Email verification and password reset

- Valid verification.
- Expired verification token.
- Reused verification token.
- Verification-token hash validation.
- Generic resend responses.
- Password-reset expiry and replay protection.
- Session invalidation after a password reset.

### Authorization and integration

- Unauthenticated requests cannot access protected resources.
- Unverified users cannot use restricted personalized features.
- Users cannot access another user's private resources.
- Non-admin users cannot access administrative operations.
- Cookie, CSRF, and CORS behavior matches the deployment configuration.

Tests must not use production credentials or real users. Use an isolated test database.

## 16. Implementation Milestones

Complete these milestones in order.

### Milestone 1 — Inspect and prepare

- [ ] Read the backend folder-structure document.
- [ ] Inspect the existing Express application.
- [ ] Confirm TypeScript or JavaScript conventions.
- [ ] Inspect the Prisma schema and database configuration.
- [ ] Identify existing error handling, validation, logging, and test patterns.
- [ ] Present the exact files to be created or modified.

**Acceptance criteria:** The plan matches the existing folder structure and avoids unnecessary architectural changes.

### Milestone 2 — Database and configuration

- [ ] Configure PostgreSQL and Prisma.
- [ ] Define the required authentication models and constraints.
- [ ] Add environment validation.
- [ ] Add an `.env.example`.
- [ ] Create and verify the database migration.

**Acceptance criteria:** Migrations apply successfully to a clean development database without destructive changes to unrelated data.

### Milestone 3 — Registration and login

- [ ] Implement input validation.
- [ ] Implement Argon2id password hashing.
- [ ] Implement registration and login.
- [ ] Implement access-token issuance.
- [ ] Add initial authentication tests.

**Acceptance criteria:** Valid users can register and sign in securely, with generic credential errors and no public administrator creation.

### Milestone 4 — Refresh sessions

- [ ] Implement refresh-session persistence.
- [ ] Implement refresh-token hashing.
- [ ] Implement rotation and reuse detection.
- [ ] Implement inactivity and absolute expiry.
- [ ] Implement logout, logout-all, and session revocation.
- [ ] Test concurrent refresh behavior.

**Acceptance criteria:** Invalidated tokens cannot silently restore a revoked session.

### Milestone 5 — Email verification

- [ ] Integrate the email service.
- [ ] Implement single-use verification tokens.
- [ ] Implement verification and resend endpoints.
- [ ] Enforce verified-email requirements in backend middleware.

**Acceptance criteria:** Personalized features remain protected until verification succeeds.

### Milestone 6 — Password recovery

- [ ] Implement forgot-password requests.
- [ ] Implement single-use reset tokens.
- [ ] Implement password reset and password change.
- [ ] Revoke affected sessions.
- [ ] Test expiry and replay protection.

**Acceptance criteria:** Reset tokens cannot be reused and password changes invalidate affected sessions.

### Milestone 7 — Authorization and hardening

- [ ] Implement authenticated-user middleware.
- [ ] Implement role-based authorization.
- [ ] Verify resource ownership.
- [ ] Configure rate limiting, CORS, cookies, and CSRF protections.
- [ ] Review logging and error responses.

**Acceptance criteria:** Unauthorized and unverified requests cannot bypass backend security controls.

### Milestone 8 — Final verification

- [ ] Run all automated tests.
- [ ] Run linting and type checks where configured.
- [ ] Run Prisma validation and migration checks.
- [ ] Review the environment configuration.
- [ ] Verify that no secrets are committed.
- [ ] Document endpoint behavior and local setup.

**Acceptance criteria:** All authentication tests pass, migrations work, and the system is ready for frontend integration after deployment-specific security checks.

## 17. Definition of Done

The authentication system is complete when:

- All required authentication endpoints work.
- PostgreSQL persistence uses Prisma.
- Access and refresh tokens follow the agreed lifetimes.
- Refresh-token rotation, reuse detection, and revocation are tested.
- Passwords are hashed using Argon2id.
- Email verification and password recovery use single-use tokens.
- Session and resource ownership checks are enforced.
- Role permissions are enforced by Express.
- Cookie, CSRF, CORS, and HTTPS settings match the deployment architecture.
- Automated tests pass.
- Environment secrets are excluded from version control.
- The implementation follows the existing backend folder-structure document.

## 18. Coding Instructions for the Implementation Agent

Work milestone by milestone. Do not generate the entire system in one pass.

Before each milestone:

1. Inspect the relevant existing files.
2. Explain the files that will change.
3. Confirm compatibility with the established folder structure.
4. Implement only the current milestone.
5. Run relevant tests and report the results.
6. Summarize changes, assumptions, and remaining work.

Do not silently change the architecture, database design, package system, or established conventions.

Do not overwrite existing files without inspecting them first.

Do not claim a test passed unless it was actually executed successfully.

Begin with **Milestone 1: Inspect and prepare**. Do not start implementing authentication until the existing folder-structure document and backend configuration have been inspected.
