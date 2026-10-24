# Backend Folder Structure --- Job Platform

**Status:** Proposed\
**Stack:** Node.js, Express, TypeScript, MySQL, Prisma\
**Purpose:** Define the backend folder structure before implementing
application features.

> This document describes the planned structure. It does not mean these
> folders or files have already been created in the backend application.

## 1. Design principles

-   Keep HTTP routes, controllers, business logic, database access,
    validation, and configuration separate.
-   Use feature-based modules where practical, so authentication and
    future job features remain organized.
-   Validate incoming data at the API boundary.
-   Keep secrets in environment variables; never commit `.env`.
-   Centralize error handling and authentication/authorization
    middleware.
-   Keep authentication tokens and session records under explicit
    server-side control.
-   Avoid creating empty abstractions until a feature needs them.

## 2. Proposed directory tree

``` text
job/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   │
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   │
│   │   ├── config/
│   │   │   ├── env.ts
│   │   │   └── cors.ts
│   │   │
│   │   ├── routes/
│   │   │   └── index.ts
│   │   │
│   │   ├── middleware/
│   │   │   ├── authenticate.ts
│   │   │   ├── authorize.ts
│   │   │   ├── validate.ts
│   │   │   ├── rate-limit.ts
│   │   │   └── error-handler.ts
│   │   │
│   │   ├── modules/
│   │   │   └── auth/
│   │   │       ├── auth.routes.ts
│   │   │       ├── auth.controller.ts
│   │   │       ├── auth.service.ts
│   │   │       ├── auth.validation.ts
│   │   │       ├── auth.repository.ts
│   │   │       └── auth.types.ts
│   │   │
│   │   ├── lib/
│   │   │   ├── prisma.ts
│   │   │   └── logger.ts
│   │   │
│   │   ├── utils/
│   │   │   └── async-handler.ts
│   │   │
│   │   └── types/
│   │       └── express.d.ts
│   │
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   │
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   ├── package-lock.json
│   └── tsconfig.json
│
├── frontend/
├── docs/
└── README.md
```

Some files and folders should be added only when their corresponding
feature is ready. For example, the `auth` module can be created when we
begin implementing authentication.

## 3. Responsibilities

  -----------------------------------------------------------------------
  Path                                Responsibility
  ----------------------------------- -----------------------------------
  `src/app.ts`                        Configure the Express app,
                                      middleware, and routes without
                                      starting the network listener

  `src/server.ts`                     Validate configuration, start the
                                      server, and handle graceful
                                      shutdown

  `src/config/`                       Load and validate environment
                                      configuration and define CORS
                                      settings

  `src/routes/`                       Register the top-level API routes

  `src/middleware/`                   Shared request authentication,
                                      authorization, validation, rate
                                      limiting, and error handling

  `src/modules/`                      Feature-specific code, grouped by
                                      domain

  `modules/auth/`                     Registration, login, refresh,
                                      logout, verification, and
                                      password-reset logic

  `src/lib/`                          Shared infrastructure clients such
                                      as Prisma and logging

  `src/utils/`                        Small reusable helpers that do not
                                      belong to a particular feature

  `src/types/`                        TypeScript declarations that extend
                                      shared types

  `prisma/`                           Database schema and versioned
                                      migrations

  `tests/unit/`                       Test isolated functions and
                                      services

  `tests/integration/`                Test API behavior and database
                                      interactions
  -----------------------------------------------------------------------

## 4. Request flow

A typical API request should follow this flow:

``` text
HTTP request
    ↓
Express app and common middleware
    ↓
Route
    ↓
Validation middleware
    ↓
Authentication / authorization middleware (when required)
    ↓
Controller
    ↓
Service (business rules)
    ↓
Repository or Prisma data access
    ↓
MySQL
    ↓
Standard response or centralized error handler
```

Not every endpoint needs every step. Public endpoints, for example, do
not require authentication. Authorization must still be enforced in the
backend for every protected resource.

## 5. Authentication module boundaries

When authentication implementation begins, keep these responsibilities
distinct:

-   **Routes:** define HTTP methods and paths.
-   **Controller:** read validated request data and return HTTP
    responses.
-   **Service:** implement registration, credential checks,
    refresh-token rotation, logout, email verification, and
    password-reset rules.
-   **Validation:** define and enforce request schemas.
-   **Repository:** encapsulate database queries if this layer is useful
    for the module.
-   **Middleware:** authenticate access tokens and check authorization.
-   **Configuration:** validate JWT secrets/keys, token lifetimes,
    cookie options, and other required environment variables.

Never place JWT secrets, database credentials, or email-provider secrets
in source code. Do not store raw refresh tokens or password-reset tokens
in the database; store appropriate cryptographic hashes. Passwords must
be hashed using a suitable password-hashing algorithm such as Argon2id.

## 6. Environment files

`backend/.env.example` should document the required variable names using
safe placeholder values, for example:

``` dotenv
NODE_ENV=development
PORT=5000
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/job_platform"
FRONTEND_ORIGIN="http://localhost:3000"
ACCESS_TOKEN_SECRET="replace-with-a-long-random-secret"
REFRESH_TOKEN_SECRET="replace-with-a-different-long-random-secret"
```

These names are illustrative and must be finalized during the
authentication and configuration design. If asymmetric JWT signing is
chosen, use private/public key configuration instead of shared secrets.
Never use the example values as production secrets.

The actual `.env` file must be excluded from Git. Production secrets
should be set through the deployment environment or secret manager.

## 7. Initial creation command

Run from the repository root only when you are ready to create the
planned directories:

``` bash
cd ~/Desktop/starcher/job/backend

mkdir -p prisma/migrations \
  src/config \
  src/routes \
  src/middleware \
  src/modules/auth \
  src/lib \
  src/utils \
  src/types \
  tests/unit \
  tests/integration
```

This command creates directories only. It does not create application
source files, initialize Prisma, alter the database, or implement
authentication.

## 8. Decisions still to confirm

Before implementation, confirm:

1.  The final module pattern and whether a repository layer is needed
    for every feature.
2.  The exact API version prefix, such as `/api/v1`.
3.  JWT signing approach, access-token lifetime, refresh-session
    lifetime, rotation, and revocation rules.
4.  Production frontend/backend domains and cookie/CORS/CSRF settings.
5.  MySQL and Prisma setup, migration workflow, and test database
    strategy.
6.  Logging, email delivery, rate limiting, and deployment
    configuration.

## 9. Implementation rule

Treat this as a proposed architecture, not a requirement to create every
file immediately. Build one feature at a time, starting with
configuration and the minimal Express app, then implement authentication
only after its security policy and API contract are approved.
