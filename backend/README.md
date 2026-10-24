# Backend --- Job Platform API

This backend provides the RESTful API for the Job Platform, built with Node.js, Express, TypeScript, MySQL, and Prisma.

## Architecture & Folder Structure

```text
backend/
├── prisma/
│   ├── schema.prisma        # Prisma data models & MySQL schema
│   ├── migrations/          # Version-controlled database migrations
│   └── prisma.config.ts     # Prisma CLI and datasource config
│
├── src/
│   ├── app.ts               # Express application configuration & middleware setup
│   ├── server.ts            # Server bootstrap & graceful shutdown handler
│   │
│   ├── config/              # Environment variable parsing & CORS configuration
│   │   ├── env.ts
│   │   └── cors.ts
│   │
│   ├── routes/              # Top-level versioned API routes (/api/v1)
│   │   └── index.ts
│   │
│   ├── middleware/          # Shared Express middleware
│   │   ├── authenticate.ts  # JWT bearer token verification
│   │   ├── authorize.ts     # Role-based access control (RBAC)
│   │   ├── validate.ts      # Zod request validation
│   │   ├── rate-limit.ts    # IP rate-limiting (global and auth-specific)
│   │   └── error-handler.ts # Centralized error handler & AppError
│   │
│   ├── modules/             # Feature modules (domain-driven)
│   │   └── auth/            # Authentication & session management
│   │       ├── auth.routes.ts
│   │       ├── auth.controller.ts
│   │       ├── auth.service.ts
│   │       ├── auth.validation.ts
│   │       ├── auth.repository.ts
│   │       └── auth.types.ts
│   │
│   ├── lib/                 # Shared infrastructure clients
│   │   ├── prisma.ts        # PrismaClient singleton with MySQL adapter
│   │   └── logger.ts        # Structured logger
│   │
│   ├── utils/               # Common helper utilities
│   │   └── async-handler.ts # Express async route handler wrapper
│   │
│   └── types/               # TypeScript type extensions
│       └── express.d.ts     # Express.Request user augmentation
│
├── tests/
│   ├── unit/                # Unit tests
│   └── integration/         # Integration tests
│
├── .env.example             # Documented environment variable template
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## Getting Started

### 1. Prerequisites
- Node.js (>= 20.x or 22.x)
- MySQL / MariaDB Server

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your database credentials and secrets:
```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Environment (`development`, `production`, `test`) | `development` |
| `PORT` | HTTP port for server listener | `5000` |
| `DATABASE_URL` | MySQL connection string (`mysql://user:pass@host:port/db`) | Required |
| `FRONTEND_ORIGIN` | Allowed origin for CORS | `http://localhost:3000` |
| `ACCESS_TOKEN_SECRET` | Secret key for signing access JWTs (min 16 chars) | Required |
| `REFRESH_TOKEN_SECRET` | Secret key for signing refresh JWTs (min 16 chars) | Required |
| `ACCESS_TOKEN_EXPIRES_IN` | Access token lifespan | `15m` |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token lifespan | `7d` |

### 3. Database & Prisma

Generate Prisma Client:
```bash
npm run prisma:generate
```

Run database migrations:
```bash
npm run prisma:migrate
```

Open Prisma Studio:
```bash
npm run prisma:studio
```

### 4. Running the Server

Start in development mode with hot-reloading:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Run production build:
```bash
npm run start
```

Type-check without emitting files:
```bash
npm run typecheck
```

---

## API Endpoints

### System
- `GET /api/v1/health` - Health check & server uptime

### Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/register` - Register a new user account (with Argon2id password hashing)
- `POST /api/v1/auth/login` - Authenticate user, receive JWT access token & secure httpOnly refresh cookie
- `POST /api/v1/auth/refresh` - Rotate refresh token & receive new access token
- `POST /api/v1/auth/logout` - Revoke current refresh token session & clear cookie
- `GET /api/v1/auth/me` - Get current authenticated user profile (Requires `Authorization: Bearer <token>`)

