# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start Commands

```bash
# Install dependencies
npm install

# Development
npm run dev                      # Start Next.js dev server on http://localhost:3000
npm run dev -- -H 0.0.0.0       # Bind to all interfaces (for Docker or remote access)

# Database
npm run db:generate             # Generate Prisma client
npm run db:migrate              # Create and run new migrations
npm run db:push                 # Push schema to DB without migrations
npm run db:reset                # Drop DB, re-run migrations, run seed
npm run db:seed                 # Run seed script (creates example users)
npm run db:normalize-emails     # One-shot script: re-normalize all existing user emails
npm run db:studio               # Open Prisma Studio UI on http://localhost:5555

# Linting & Formatting
npm run lint                    # Run ESLint
npm run format                  # Auto-format with Prettier
npm run format:check            # Check formatting without changing files

# Testing
npm test                        # Run all tests (vitest, node environment)
npm run test:watch              # Run tests in watch mode

# Build & Production
npm run build                   # Build for production (lints, checks format, migrates, builds)
npm run build:next              # Build Next.js only (skip migrations, lint, format)
npm start                       # Run production server

# Docker
docker compose -f docker/docker-compose.yml up --build          # Start full stack
docker compose -f docker/docker-compose.yml up postgres mailpit # Infra only (no app container)
docker compose -f docker/docker-compose.yml down -v             # Stop and remove volumes

# Simulated time (for date-dependent testing)
FAKETIME='@2026-01-01 00:00:00' docker compose -f docker/docker-compose.yml -f docker/docker-compose.timemock.yml up --build
```

## Architecture Overview

**Framework**: Next.js 15 with App Router, TypeScript, TailwindCSS (v4), Radix UI
**Backend**: Next.js API Routes
**Database**: PostgreSQL 17 with Prisma ORM (v7.4)
**Auth**: NextAuth.js v5 with Credentials provider
**UI Components**: Shadcn UI + Radix UI primitives
**Testing**: Vitest (node environment)
**Email**: Nodemailer (Mailpit for local dev)
**Deploy**: Vercel (with cron support)

### Project Structure

```
src/
├── app/                          # Next.js App Router (pages & API routes)
│   ├── (public)/                 # Public pages (landing, about, services, policies)
│   ├── (management)/             # Auth-gated section
│   │   ├── auth/                 # Sign-in, sign-up, password reset, magic-link
│   │   ├── user/                 # Logged-in user pages
│   │   │   ├── dashboard/        # User dashboard with stats
│   │   │   ├── coworking/lab/auditorium/meeting-room/  # Reservation booking UIs
│   │   │   └── settings/         # User profile configuration
│   │   ├── admin/                # Admin-only section (guards by role in middleware)
│   │   │   ├── dashboard/        # Admin overview
│   │   │   ├── reservations/     # Admin reservation management
│   │   │   ├── users/            # User list, search, ban management
│   │   │   ├── checkin/          # Check-in/out system
│   │   │   └── incidents/        # Incident tracking
│   │   └── banned/               # Fallback page when user is banned
│   │
│   └── api/
│       ├── auth/                 # NextAuth routes + custom endpoints
│       │   ├── [...nextauth]/    # NextAuth handler
│       │   ├── register/         # Registration endpoint
│       │   ├── confirm-email/    # Email verification
│       │   ├── signup/           # Profile completion after email verify
│       │   ├── reset/            # Password reset request
│       │   └── magic-link/       # (deprecated/planned)
│       ├── user/
│       │   ├── profile/          # GET/PUT user profile
│       │   └── stats/            # GET user dashboard stats
│       ├── admin/
│       │   ├── reservations/     # Admin CRUD for reservations
│       │   ├── users/            # Admin user management
│       │   ├── stats/            # Admin dashboard metrics
│       │   └── incidents/        # Incident CRUD
│       ├── resources/[type]/     # Get available resources & calendar for a type
│       ├── session/              # GET current session (session validation)
│       ├── cron/
│       │   ├── maintain-reservations/  # Daily 5am UTC: expire old reservations
│       │   └── process-jobs/     # (planned)
│       └── dev/
│           └── server-time/      # GET server time (dev only, checks faketime)
│
├── components/
│   ├── ui/                       # Shadcn UI components (button, form, dialog, etc.)
│   ├── atoms/                    # Small single-purpose components (status-badge, etc.)
│   ├── molecules/                # Composed components (forms, info blocks)
│   ├── organisms/                # Page-level complex components
│   ├── templates/                # Layout wrappers
│   ├── providers/
│   │   ├── session-provider.tsx  # NextAuth SessionProvider
│   │   └── server-time.tsx       # ServerTimeProvider (client-side time sync)
│   └── user-layout.tsx           # Shared layout for authenticated users
│
├── lib/
│   ├── auth.ts                   # NextAuth config & verifyCaptcha()
│   ├── prisma.ts                 # Singleton Prisma client with PrismaPg adapter
│   ├── clock.ts                  # Server wall clock (now(), nowMs()) — respects libfaketime
│   ├── unix-ms.ts                # Helpers: dateToUnixMs(), unixMsToDate()
│   ├── prisma-auth-bridge.ts     # Prisma extension to convert NextAuth Date ↔ BigInt timestamps
│   ├── ratelimit.ts              # Rate limiting via DB (checkRateLimit())
│   ├── utils.ts                  # General utilities
│   ├── json-bigint.ts            # BigInt serialization helpers
│   │
│   ├── db/                       # Database query helpers (organized by domain)
│   │   ├── users.ts              # User queries: getRegisteredUserByEmail(), getUserByEmailAndPassword(), getUsersWithPagination()
│   │   ├── reservations.ts       # Reservation logic: createReservation(), approveReservation(), getReservationsByUser()
│   │   ├── resourceCalendar.ts   # Calendar/availability: getUnavailableSlots(), getResourceCalendar()
│   │   ├── adminReservations.ts  # Admin-specific reservation queries
│   │   ├── adminStats.ts         # Admin dashboard metrics
│   │   ├── dashboardStats.ts     # User dashboard metrics
│   │   ├── verificationTokens.ts # Email verification token management
│   │   └── ...
│   │
│   ├── email/
│   │   ├── confirmation.ts       # Email confirmation template & send logic
│   │   ├── reset.ts              # Password reset email
│   │   ├── identity/             # Email validation (Gmail dot rules, MX checks)
│   │   └── identity-server/      # Server-side email normalization
│   │
│   ├── schemas/
│   │   └── auth.ts               # Zod schemas for auth inputs (registerSchema, signInSchema, etc.)
│   │
│   ├── constants/
│   ├── admin/                    # Admin utilities (timezone, timeline calculations)
│   └── utils/
│       ├── string.ts
│       └── date.ts
│
├── types/
│   ├── prisma.ts                 # Type definitions mirroring Prisma enums (keep in sync with schema)
│   ├── navigation/               # Navigation types for typed links
│   └── admin/                    # Admin-specific types
│
└── assets/
    └── policies/                 # Policy content (markdown/mdx)
```

### Database Model Overview

**Auth Models** (NextAuth-compatible via PrismaAdapter):

- `User`: Email, passwordHash, emailVerified (BigInt ms)
- `Account`: OAuth provider accounts
- `Session`: JWT sessions
- `VerificationToken`: Email verification tokens

**Core Domain** (custom models):

- `RegisteredUser`: User profile after signup (name, lastName, DNI, institution, role, bans, relationships)
- `Reservation`: Booking record (can be recurring with RRULE)
- `ReservationException`: Overrides for a single occurrence of a recurring reservation
- `ReservationLedger`: Expanded bookings by 15-min bucket (used for capacity/availability checks)
- `CheckIn`: User entry/exit records (linked to reservation)
- `Resource`: Physical/digital resource (coworking desk, auditorium seat, lab, meeting room)
- `FungibleResource`: Resource category (capacity, exclusive flag)
- `Ban`: User suspension record (time-bounded)

**Features** (expanding):

- `Organization`, `Team`, `OrgMembership`, `TeamMember`: Group management
- `Event`, `UserEvent`: Calendar events
- `Incident`, `IncidentUser`: Incident tracking
- `Proposal`, `ProposalComment`, `ProposalLike`: Suggestions system
- `Inventory`, `PurchaseOrder`: Stock management
- `RateLimit`: DB-backed rate limiting

**Key Fields**:

- Timestamps stored as **BigInt milliseconds** (Unix epoch \* 1000) via dbgenerated `EXTRACT(EPOCH FROM clock_timestamp())::bigint`
- `RegisteredUser.createdAt/updatedAt`, `Reservation.startTime/endTime`, etc. are all BigInt
- NextAuth expects `Date`, so `prisma-auth-bridge.ts` extension converts Date ↔ BigInt for User/Session/VerificationToken

### Complex DB Features

**Reservation System**:

1. Reservations can be one-time or recurring (RRULE-based)
2. `ReservationLedger` table stores 15-min buckets for each reservation occurrence
3. Ledger entries track capacity usage and allow fast availability checks
4. SQL functions in migration `20251019204243_functions_and_triggers`:
   - `create_reservation()`: Creates reservation & populates ledger; rejects if no capacity
   - `approve_reservation()`: Approves a reservation and auto-rejects conflicting pending ones
   - `get_unavailable_slots()`: Returns busy time windows for a resource type
   - `get_user_next_reservations()`: Expands recurring reservations via `generate_series()`
   - `get_actor_size()`: Computes how many users are represented (1 for USER, count of members for TEAM/ORG)

**Timestamps**:

- All user-facing times stored as BigInt ms
- Conversions happen at Prisma client layer via `prisma-auth-bridge.ts` (User, Session, VerificationToken only)
- Other tables (Reservation, CheckIn, etc.) read/write BigInt directly
- Client receives times as numbers; ServerTimeProvider syncs client clock with server

### Authentication Flow

1. **Sign-up**: `/auth/signup` → POST `/api/auth/register` → email + password hashed (bcryptjs, 12 rounds)
2. **Email Verification**: GET `/api/auth/confirm-email?token=...` → marks `emailVerified`
3. **Profile Completion**: POST `/api/auth/signup` → creates `RegisteredUser` (name, DNI, institution, reason)
4. **Sign-In**: POST `/api/auth/signin` → Credentials provider validates email + password, checks `emailVerified`
5. **Session**: NextAuth JWT strategy (7-day expiration); ban status checked in `jwt()` callback
6. **Role-based**: `session.role` populated from `RegisteredUser.role` in `jwt()` callback; admin pages guarded client-side

**Special Cases**:

- Users banned mid-session: ban `endTime` becomes new session expiration (forces re-auth at ban end)
- `displayEmail`: Preserves user's original email input (before normalization) for display

### Email Handling

- **Identity/normalization**: `src/lib/email/identity/` applies Gmail dot-stripping rules (user+tag@gmail.com → usertag@gmail.com), plus optional MX validation
- **Identity Server**: `src/lib/email/identity-server/` is server-side version (deterministic, no MX lookup)
- **Sending**: Nodemailer via SMTP env vars; local dev uses Mailpit (port 1025 SMTP, UI at :8025)
- **Templates**: Confirmation & password reset via `src/lib/email/*.ts`

### Rate Limiting

- Database-backed (RateLimit table with `(key, endpoint)` unique constraint)
- Endpoint-specific windows (configured per route)
- Blocked IPs can be temporarily locked; used for auth endpoints (register, reset, confirm-email)

### Time Handling (Non-Obvious)

1. **Server clock**: `src/lib/clock.ts` returns `new Date()` / `Date.now()`
2. **Under libfaketime** (Docker + timemock overlay): Node process sees faked time
3. **Client time**: Browser sends real time; ServerTimeProvider syncs client to server via `serverNowMs`
4. **Verification**: `/api/dev/server-time` endpoint (dev-only) lets you verify fake time is working
5. **RRULE expansion**: Calculated in SQL (`generate_series`) using Postgres `now()`; must be in sync

## Key Patterns & Non-Obvious Behavior

### 1. Recurring Reservations via RRULE

- Stored as a single Reservation row with `isRecurring=true` + RRULE string + recurrenceEnd
- Ledger entries created for each 15-min bucket of each occurrence
- Expansion happens in two places: SQL functions (for availability) & client (for UI calendars)
- ReservationException table allows overriding a single occurrence (cancel, reschedule, rescind)

### 2. Reservation Approval Logic (in SQL)

- New reservations start as PENDING
- Admin approval: `approve_reservation()` in SQL
  - For **exclusive** resources: only one approved reservation allowed; pending conflicts auto-rejected
  - For **non-exclusive** (capacity-based): pending ones rejected if capacity exceeded
- ReservationLedger powers this; queries sum actor_size over time windows

### 3. Email Normalization (No MX Checks in Identity Server)

- Client: validates format, does NOT do MX lookup
- Server (`identity-server.ts`): applies Gmail dot-stripping deterministically, no MX
- Same canonical email must be used for sign-in & registration (normalize on input)

### 4. Cron Job (Vercel)

- `/api/cron/maintain-reservations` scheduled daily at 5am UTC
- Vercel injects `Authorization: Bearer <CRON_SECRET>` automatically
- **Correctness requirement, not just cleanup**: if it misses, recurring reservations stop being materialized forward and conflict checks silently fail

### 5. Prisma Config & Schema

- `prisma/schema.prisma` contains only datasource & generator; models live in `prisma/models/*.prisma` (imported via `include`)
- Business logic lives in DB functions, not application code — search migrations for `CREATE OR REPLACE FUNCTION`
- PrismaPg adapter with connection pooling via `pg.Pool`

### 6. Component Structure

- Pages are Server Components by default; add `"use client"` at the component level when needed
- Forms: react-hook-form + Zod; toasts: Sonner; path alias `@/` → `src/`

## Testing & Seeding

**Vitest Configuration** (`vitest.config.ts`):

- Node environment (no jsdom)
- Includes all `*.test.ts` files under `src/`
- Alias `@/` set to `./src`

**Example Tests**:

- `src/lib/email/identity/identity.test.ts`: Email normalization logic
- `src/lib/admin/admin-timezone.test.ts`: Timezone calculations
- `src/lib/admin/admin-timeline.test.ts`: Timeline/availability logic

**Database Seeding** (`prisma/seed.ts`):

- Creates 30 regular users (u1-u30@lanube.local) + 10 admins (a1-a10@lanube.local)
- Password: `123123123` (local dev only)
- Hashed with bcryptjs (12 rounds)
- Marks all as `emailVerified` (skips email confirm flow)
- Run via `npm run db:seed` or auto-run in `docker compose up migrate`

## Environment & Deploy

**Local Development**:

- `.env` file (example in `env.example`)
- Database: Postgres 17 (Docker or local)
- Email: Mailpit SMTP (Docker)
- Optional: Libfaketime for simulated dates

**Vercel Deploy**:

- Build command: `npm run build` (lint + format check + migrate + next build)
- Env vars: DATABASE*URL, NEXTAUTH_SECRET, NEXTAUTH_URL, SMTP*_, TURNSTILE\__, CRON_SECRET
- Database must be reachable from Vercel runners (migrations run at build time)
- Preview deployments can use separate DB or shared (must handle concurrent migrations)

**Docker Stack** (`docker/docker-compose.yml`):

- **postgres**: Custom image (Dockerfile.postgres) with optional libfaketime
- **app**: Next.js dev server, source mounted, node_modules in volume
- **migrate**: One-shot Prisma migrate + seed
- **mailpit**: SMTP server + web UI
- Health checks ensure correct startup order

## Coding Conventions

- **Imports**: Use absolute imports (`@/...`) via tsconfig paths
- **Unused variables**: Prefix with `_` (ESLint rule configured)
- **Database IDs**: CUID2 via `@paralleldrive/cuid2` (not UUID)
- **Timestamps**: Always BigInt ms in DB; convert at boundaries with `unixMsToDate()` / `dateToUnixMs()`

## Useful Debug/Development Tips

1. **Check fake time**: `curl http://localhost:3000/api/dev/server-time | jq` (dev only)
2. **Inspect emails**: Mailpit UI at http://localhost:8025
3. **Prisma Studio**: `npm run db:studio`
4. **Raw SQL**: `prisma.$queryRaw` / `prisma.$executeRaw` (see `src/lib/db/reservations.ts` for examples)
5. **Attach Node debugger** (Docker): VS Code/Cursor → F5 → "Next.js: attach (Docker, port 9229)"
6. **Log BigInt**: `BigInt(timestamp).toString()` — `JSON.stringify` will throw on BigInt values
