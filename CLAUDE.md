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
docker compose -f docker/docker-compose.yml up --build          # Start full stack (app on :3000)
APP_PORT=3001 docker compose -f docker/docker-compose.yml up --build  # Use a different host port
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
│   │   │   ├── spaces/[slug]/       # Reservation booking UI (dynamic; resolves Space by slug)
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

### Whitelabel & Module System (non-obvious — read before touching branding or events)

The app is **whitelabeled** and **module-based**. Two systems govern this:

**1. Whitelabel config** — all brand identity lives in the root **`app.config.ts`** (the
single file an integrator edits), resolved through **`src/config/`**:

- `app.config.ts` — brand (name, tagline, description, `logo` component, `theme` colors,
  `themeStorageKey`), contact + social, `copy` strings, and the `modules` enable map.
- `src/config/index.ts` — `appConfig` with `NEXT_PUBLIC_*` env overrides applied; exports
  `getBrand()`, `getContact()`, `getCopy()`, `getThemeStorageKey()`, `getModuleSettings()`.
- **Colors**: `app.config.ts › brand.theme` is injected as `--color-brand-*` CSS variables
  by `<BrandThemeStyle/>` (root layout), overriding the defaults in `globals.css`. Tailwind
  utilities are `bg-brand-primary` / `text-brand-secondary` / `brand-selected` / `brand-accent`
  (the old `la-nube-*` tokens were renamed). Change a hex in the config → whole app recolors.
- **Logo**: `<Brand/>` (`src/components/atoms/logos/brand.tsx`) renders `brand.logo`.
  Components never import a specific logo. `logos/lanube` is just the default example.
- Metadata (`src/app/layout.tsx`), footer, hero, forms shell, and contacts all read config.
- See `docs/WHITELABEL.md`.

**2. Modules** — features are self-contained under **`src/modules/<id>/`**, split across the
server/client boundary (module data is server-only; nav is client-safe):

- `manifest.ts` (client-safe: id, name, nav, config schema) vs `index.ts` (server: manifest
  - `operations`). Two registries mirror this: `src/modules/manifests.ts` (client — `getModuleNav`,
    `isModuleEnabled`) and `src/modules/registry.ts` + `src/modules/index.ts` (server —
    `getModule`, `getModuleConfig`, and the typed **`modules`** accessor).
- **Modules expose operations, not routes.** A module ships plain server functions (reads _and_
  writes) as `operations`; it does **not** own HTTP routes. Route files live in `src/app/**`
  (integrator-owned, filesystem routing) and are thin **delegates** that call a module operation
  via the `modules` accessor — so modules never collide on endpoints. See `docs/MODULES.md`.
- **Standardized data retrieval**: frontends/route delegates call `modules.events?.getUpcoming(...)`
  (returns `undefined` when disabled → degrade gracefully). The landing (`templates/landing/events`)
  and `/api/events` consume events this way — **not** via a direct db import.
- Enable/disable per deployment in `app.config.ts › modules`. Disabling removes the module's
  nav + data + graceful-null everywhere. Built-ins: **events** (`src/modules/events`) and
  **news** (`src/modules/news`, a disabled scaffold). See `docs/MODULES.md`.
- **Events moved into its module** (was under `src/lib`): `db/events.ts`, `db/forms.ts`,
  `db/participants.ts` → `src/modules/events/db/*`; `lib/events/*` → `src/modules/events/lib/*`;
  `schemas/events.ts` → `src/modules/events/schema.ts`; `constants/events.ts` →
  `src/modules/events/constants.ts`; `email/event-*.ts` → `src/modules/events/email/*`.
  Prisma models stay app-wide in `prisma/models` (a module owns queries, not schema).
- The management sidebar (`templates/management`) aggregates module admin/user nav via
  `getModuleNav()`; events/forms/`Mis eventos` entries come from the events manifest.

**3. Booking core** (`src/core/booking/`) — the baseline reservation domain (reservations, the
15-min `ReservationLedger`, capacity/conflict checks, resources) exposed as a single **operations
port** (`booking.*`). Modules must **not** touch `reservation`/`reservation_ledger`/
`reservation_exceptions` or the reservation SQL functions directly — they call the port
(owner-scoped ops keyed by an opaque `{ type, id }` `OwnerRef`; the events module uses
`type:"EVENT"`). Errors are language-neutral `BookingError` codes (`ALREADY_BOOKED`,
`RESOURCE_NOT_FOUND`, `RESCHEDULE_CONFLICT`); callers map codes → messages. The events module was
refactored onto this port (only `events/db/events.ts` was coupled). **End-goal**: lift
`src/core/booking` into an independently-versioned, cross-repo package — the remaining seams
(actor/identity resolver for `get_actor_size`/`registered_users`, SQL+migration ownership,
transaction boundary, and the residual `Space`/`ReservationType` display joins in events) are
documented in `src/core/booking/README.md`.

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
- `Space`: Reservable space (coworking, lab, auditorium, meeting room) with capacity/exclusive/reservable flags — superadmin CRUD at `/admin/spaces`. Booking UI is the single dynamic route `/user/spaces/[slug]` (resolves the Space by its editable `slug`; 404s if missing or not reservable) — there are no per-space hardcoded folders. The user sidebar's space links are built from `getReservableSpaces()` in the user layout and passed to `ManagementLayout` (`spaceNav`), so a renamed/added space stays in sync automatically.
- `Resource`: Physical equipment inventory (superadmin CRUD at `/admin/resources`)
- `ReservationType`: Catalog of reservation/event types (was the `event_types` Postgres enum). `code` is the stable identifier stored on `Event.eventType` / `Reservation.eventType` (text FK, `ON UPDATE CASCADE`, delete restricted while in use); `name` is the display name. Superadmin CRUD at `/admin/reservation-types`; public read at `GET /api/reservation-types`. Migration `20260706110000` seeded MEETING/WORKSHOP/CONFERENCE/OTHER and recreated the SQL functions with `text` params.
- `Ban`: User suspension record (time-bounded)

**Features** (expanding):

- `Organization`, `Team`, `OrgMembership`, `TeamMember`: Group management
- `Event`: Admin-run workshops/classes booked on a resource with a weekly cadence. Each
  event owns its reservations (`reservableType=EVENT`, `reservableId=event.id`) and an
  optional custom form.
- `Form`, `FormField`: a form's structure (name, description, fields à la Google Forms).
  A `Form` is either a reusable **template** (`isTemplate=true`, managed in the admin Forms
  section) or a per-event **instance** (`isTemplate=false`) cloned from a template at bind time.
- `EventForm`: binds a cloned instance `Form` to an event, carrying the public `slug`,
  registration open/close window, and `isPublished` flag (`@@unique` on both `eventId` and
  `formId`; `templateId` records the source template).
- `EventParticipant`: A registration, keyed by **normalized email** per event
  (`@@unique([eventId, email])`), with `displayEmail`, a tokenized `editToken` (edit/cancel
  without an account), and a nullable `userId` linked if the participant later registers.
  A `ParticipantStatus` enum (PENDING/APPROVED/REJECTED/CANCELLED) drives the lifecycle
  (replaced the old `cancelled` boolean); `decisionReason`/`decidedAt` record an admin's
  approve/reject. See "Participant approval" below.
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
6. **Role-based (RBAC)**: `session.role` populated from `RegisteredUser.role` in `jwt()` callback. Roles: **USER / ADMIN / SUPERADMIN**; permissions are code-defined per role in `src/lib/rbac.ts` (`ROLE_PERMISSIONS`, `hasPermission()`, `isAdminRole()`). Enforcement layers:
   - **Middleware** (JWT role, fast path): `/admin` needs `admin:access`; config paths (`/admin/spaces|resources|reservation-types`) need their `*:manage` permission.
   - **API routes**: `requirePermission()` (`src/lib/api-auth.ts`) re-reads the role from the DB (fresh after promotions/demotions) and returns 401/403.
   - **Pages/layouts**: `requirePagePermission()` (`src/lib/page-auth.ts`) for the superadmin config pages; the admin layout checks the DB role.
   - Superadmin extras: manage spaces/resources/reservation-types + change user roles (`PATCH /api/admin/users/[id]`; never your own role). Seed superadmins: `sa1`/`sa2@lanube.local`.

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

### 5. Events & Custom Forms

- **Events create reservations**: an event creates one weekly-recurring reservation per
  selected weekday via the `create_event_reservation()` SQL function (specific resource,
  status `APPROVED`, `actor_size` = resource capacity so the resource is fully blocked).
- **Forms are templates; events bind instances**: admins build reusable form templates in
  their own section (`/admin/forms`, `db/forms.ts`). Creating/editing an event optionally
  picks a template; binding **clones** the template into an instance `Form` (fresh field ids)
  plus an `EventForm` carrying the registration window. The clone is a snapshot — editing or
  deleting a template never alters a bound event's fields or its participants' answers (answers
  are keyed by field id). On event edit, re-cloning happens only when the template is swapped,
  which is blocked once anyone has registered; otherwise only the window/publish state changes,
  keeping the slug + field ids stable. `deleteEvent` drops the instance `Form` explicitly (the
  event FK doesn't cascade to it).
- **Polymorphic `reservable_id`**: the `reservations.reservable_id → registered_users` FK
  was dropped (migration `20260622000000`) so EVENT reservations can point at an event.
  The Prisma `Reservation.registeredUser` relation is kept (joins on the column; yields
  `null` for non-USER rows). ⚠️ A plain `prisma migrate dev` may propose re-adding this FK —
  **discard that**; the hand-written migration is the source of truth.
- **Calendar display**: `getEventOccurrencesForType()` surfaces APPROVED EVENT occurrences
  as named, read-only cards (with an "Inscribirse" form link) instead of anonymous
  unavailable blocks (see `resourceCalendar.ts` + `WeekCalendar.tsx`).
- **Public form flow**: unauthenticated routes under `/forms/[slug]` (submit) and
  `/forms/response/[token]` (edit/cancel); APIs under `/api/forms/*` (rate-limited).
  Participant email uses the same normalization + `displayEmail` rules as registration.
  Public pages show the **event** name + description + image (`EventHero`); the internal
  form name is never exposed (`getPublicForm` returns `eventName/eventDescription/eventImageUrl`).
- **Event image**: optional `Event.imageUrl`, uploaded via `POST /api/admin/events/upload`
  → `getStorage().upload()`. The reusable `ImageUpload` molecule drives it.
- **Form picker**: events choose a template via `FormPicker` — a searchable dialog (shadcn
  Command) showing each template as a card with a field-type-chip preview. `listFormTemplates`
  includes a lightweight `fields` summary for the preview. Field-type labels/icons live in
  `src/lib/constants/form-fields.ts` (shared by the picker + form builder).

### Storage abstraction (`src/lib/storage/`)

`getStorage()` returns a `StorageProvider` (`upload`/`remove`). Selection: `STORAGE_PROVIDER`
env (`vercel-blob` | `local`), defaulting to Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set,
else a `local` filesystem provider (writes `public/uploads`, dev only — not serverless-safe).
Add a future S3/custom provider by implementing the interface + registering it in the factory;
no call sites change. Allow new public image hosts in `next.config.ts` (`STORAGE_PUBLIC_HOST`).

Reusable UI: `CopyField` (molecule) backs `CopyFormUrl` — generic copy-to-clipboard for any
text (box or button variant).

### Event description (markdown)

### Event sessions (per-occurrence cancel / reschedule)

Events stay **weekly-recurring** (one reservation per weekday). Individual sessions are
cancelled/rescheduled as **`ReservationException`s** — the reservation machinery applies them
(`effective_occurrence_window` + `rebuild_reservation_ledger_forward`). A **reason is required**
for event exceptions (business rule; the `reason` column is optional). The pure occurrence logic
(weekly expansion + exception overlay, drop detection, and the saved-vs-staged merge
`effectiveExceptions`) lives in `src/lib/events/occurrences.ts` (unit-tested).

- **Sessions commit with the event, not on their own.** The `Sesiones` dialog
  (`event-sessions.tsx`, launched from the event form / the `?sessions=1` card shortcut) is a
  **client-side staging UI**: it previews occurrences from the _live form recipe_ (`planEventOccurrences`
  - `expandEventOccurrences`) overlaid with the saved exceptions (`getEventSessionExceptions`,
    passed as `existingExceptions`) and the not-yet-saved `SessionAction[]` held in the form. Editing
    a session only mutates that local array (rows show a **"Sin guardar"** badge; the button shows a
    count). **Nothing persists — and no email is sent — until the event is saved.** So date-range
    edits reflect in the list instantly, without a save round-trip. Actions are keyed by
    **weekday + nominal occurrence date** (not reservation id) so they survive recipe edits.
- On save the form sends `sessionActions` with the `PUT`; `updateEvent` (`opts.sessionActions`)
  resolves each to a reservation by weekday **after** the recurrence diff, writes/clears the
  exception (one per date), rebuilds the ledger, and **collects notifications sent only after the
  transaction commits** (never on a rolled-back edit). `revert` emails a **"restored"** notice.
- **Editing preserves exceptions:** `updateEvent` diffs weekdays and updates reservations in place
  (no delete+recreate). It throws `EventEditDropWarning` (→ **409** with the dropped sessions) only
  when an edit would **drop** a saved exception (removed weekday / out-of-range date / resource
  change); the event form confirms, then resends `force: true`.
- **Notifications** (`src/lib/email/event-occurrence-update.ts`, kinds cancelled/rescheduled/restored)
  email all non-cancelled participants. **⚠️ Sent synchronously in the request** — fine at current
  scale, but for ~100+ participants move to a background job/queue (Vercel has little background
  capacity). See the `TODO(scale)` at `notifyEventParticipants`.

### Event lifecycle status

`Event.status` is an `EventStatus` enum — **DRAFT / PUBLISHED / PAUSED** (migration
`20260629000000`). **ENDED is derived, never stored** (`eventDisplayStatus()` returns ENDED once
`recurrenceEnd ?? endTime` is in the past). Only PUBLISHED events are public: `getPublicForm` /
`submitForm` / `getUpcomingPublicEvents` gate on `status === PUBLISHED` (+ window/capacity/not-ended).
`EventForm.isPublished` is kept as a mirror of `status === PUBLISHED` (set on save) for the
calendar query. The admin sets status via a Select in the event form (no separate publish
toggle); PAUSED takes a published event down without deleting it. Admin Events + Forms lists
are paginated (`listEvents`/`listFormTemplatesPage`, newest first) via the `Pagination` molecule

- `?page=`; the form picker still loads all templates via `listFormTemplates`.

**Soft delete:** `Event.deletedAt` (migration `20260630000000`). `deleteEvent` is a soft delete —
it sets `deletedAt`, frees the reservations (resource no longer blocked), and keeps the event +
form + participant history. Cancelled events show as **CANCELLED** (derived, highest precedence
in `eventDisplayStatus`) and are excluded from every public surface; editing + saving revives
one (clears `deletedAt`). Delete is triggered from the event edit page (`DeleteEventButton`).

**Admin events list:** filterable by status / resource type / date-range overlap
(`listEvents(filters)` → `buildEventListWhere`; derived ENDED/CANCELLED map to date/`deletedAt`
conditions) via the `EventFilters` bar (wrapped in `Suspense` for `useSearchParams`); pagination
preserves filters. Cards show the event date + time + weekdays and a de-emphasized registration
window ("Inscripción: …"). The shared `DateRangePicker` molecule (shadcn Popover + Calendar
range mode) drives both the event form's date range and the filter bar. Landing cards show the
registration phase (`getUpcomingPublicEvents` returns `registration` + window): open →
"Inscribirme" + closes-on date; upcoming → disabled "Disponible el …"; closed → quiet note.

An event's description is **markdown**, required (min 100 chars), authored with `MarkdownEditor`
(toolbar: heading/bold/italic/quote/code/link + ordered/bullet list, write/preview tabs, and a
"Soporta markdown" badge linking to external Spanish docs) and rendered with `Markdown`
(`molecules/markdown.tsx`) on the public form (`EventHero`). `Markdown` uses react-markdown +
remark-gfm only — raw HTML is **not** parsed (react-markdown escapes it) and URLs are sanitized
by react-markdown's default transform, so admin-authored content is safe to show publicly.

### Participant approval

`Event.requiresApproval` (migration `20260801200000`) toggles per-event whether registrations
are auto-approved (default `false`) or filtered by an admin.

- **Status model:** `EventParticipant.status` is a `ParticipantStatus` enum
  (PENDING/APPROVED/REJECTED/CANCELLED) that **replaced the `cancelled` boolean**. PENDING is
  admin-awaiting; APPROVED is in; REJECTED is admin-declined; CANCELLED is self-cancelled.
- **The one capacity rule:** a participant "holds a spot" (counts toward capacity/cupo) while
  **PENDING or APPROVED** — `SPOT_HOLDING_STATUSES` in `src/lib/constants/participants.ts`, used
  by _every_ count (`getPublicForm`, `submitForm`, `resourceCalendar`, the landing/event cards).
  So for auto events it equals the old `cancelled=false` count; for manual events the cupo caps
  **registrations**, not the final approved headcount. Don't reintroduce ad-hoc status filters —
  reuse `SPOT_HOLDING_STATUSES`.
- **Registration (`submitForm`):** initial status is PENDING when `requiresApproval`, else
  APPROVED. Re-registering a REJECTED/CANCELLED row reactivates it (clears the prior decision).
  The confirmation email (`event-registration.ts`) has a manual-approval variant reinforcing
  "inscribirte no garantiza tu lugar"; the public form + submitted screen show the same notice.
- **Admin decisions:** the participants table (`participants-table.tsx`) shows a status column;
  for manual events it adds row checkboxes + a bulk **Aprobar/Rechazar** bar → a confirm dialog
  (lists the selected people, optional shared reason, type-**APROBAR**/**RECHAZAR** to arm).
  `POST /api/admin/events/[id]/participants/decision` → `decideParticipants()` (scoped to the
  event; approve touches only PENDING, reject touches PENDING+APPROVED — so approving never
  re-emails the already-approved). **Emails send after the write commits** via
  `notifyParticipantsDecision` (`event-decision.ts`): approval = "you're in"; rejection = the
  reason if given, else a neutral generic message. Same synchronous fan-out caveat as
  `notifyEventParticipantsBatch` (TODO(scale) at ~100+ recipients).
- **Not supported yet:** re-approving a REJECTED participant in place (freeing→re-occupying a
  spot needs a capacity recheck); they re-register instead.

### Event card summary + featured

- `Event.summary` (nullable, ≤200 chars, plain text) is the blurb shown on landing/event cards.
  The markdown `description` is for the detail page only — cards render `summary` (never raw
  markdown; empty → no blurb). Authored via the "Resumen" field in the event form.
- `Event.isFeatured` + `Event.featuredOrder` (migration `20260801100000`) mark events that lead
  the landing "Próximos eventos" section. Featured events sort first (`isFeatured desc`,
  `featuredOrder asc`, then `startTime desc`) and render in a distinct emphasized row (ring +
  "Destacado" star badge) above the normal grid (`EventsSection` splits featured vs rest; the
  `EventCard` `featured` prop drives the emphasis). Set via the "Destacar en el inicio" switch.

### Landing "Próximos eventos"

`getUpcomingPublicEvents()` (public, auth-free) returns events whose last occurrence hasn't
passed, newest start first. Featured events lead (see above); the section renders right after
the hero on the landing. The landing `EventsSection` (`templates/landing/events/`) renders
them in a dependency-free scroll-snap `EventsCarousel`; the **section returns `null` when
there are none** (no empty placeholder). Cards link to `/forms/[slug]` when registration is
open. The public `/forms` shell (`app/forms/layout.tsx`) is its own branded, chrome-light
layout (logo + theme, no nav) showing the **event** identity via `EventHero`. Shared event
labels (type + weekday) live in `src/lib/constants/events.ts`.

### 6. Prisma Config & Schema

- `prisma/schema.prisma` contains only datasource & generator; models live in `prisma/models/*.prisma` (imported via `include`)
- Business logic lives in DB functions, not application code — search migrations for `CREATE OR REPLACE FUNCTION`
- PrismaPg adapter with connection pooling via `pg.Pool`

### 7. Component Structure

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
- Env vars: DATABASE*URL, NEXTAUTH_SECRET, NEXTAUTH_URL, SMTP*\_, TURNSTILE\_\_, CRON_SECRET
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
7. **After a Prisma schema change** (local Docker): run `npm run db:generate`, then **restart the app container** (`docker restart lanube-app`) — the running dev server caches the old client, so new columns/enums throw `Unknown field …` until it reloads. Vercel builds regenerate the client fresh, so this only affects local dev.
8. **Applying migrations locally**: `npm run db:migrate` (`prisma migrate dev`) **hangs** on this repo — it prompts about re-adding the dropped polymorphic `reservable_id` FK. Use `npx prisma migrate deploy` (a.k.a. `npm run db:migrate:deploy`) to apply pending migrations non-interactively; the build (`npm run build`) already uses `migrate deploy`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
