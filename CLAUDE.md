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
│   ├── (public)/                 # Public pages (landing, about, spaces, news, events, policies)
│   │   └── news/[yyyy]/[mm]/[dd]/[slug]/  # Noticia detail. Public URLs are English:
│   │                             #   "/noticias" 308-redirects here (next.config.ts)
│   ├── forms/                    # Public, UNAUTHENTICATED event registration
│   │   ├── [slug]/               # Submit a registration (+ /submitted confirmation)
│   │   └── response/[token]/     # Edit/cancel via the participant's editToken
│   ├── (management)/             # Auth-gated section
│   │   ├── auth/                 # Sign-in, sign-up, password reset, magic-link
│   │   ├── user/                 # Logged-in user pages
│   │   │   ├── dashboard/        # User dashboard with stats
│   │   │   ├── spaces/[slug]/    # Reservation booking UI (dynamic; resolves Space by slug)
│   │   │   ├── events/           # Events the user can see/register for
│   │   │   └── settings/         # User profile configuration
│   │   ├── admin/                # Admin-only section (guards by role in middleware)
│   │   │   ├── dashboard/        # Admin overview
│   │   │   ├── reservations/     # Admin reservation management
│   │   │   ├── users/            # User list, search, ban management
│   │   │   ├── checkin/          # Check-in/out system
│   │   │   ├── incidents/        # ⚠️ NOT FUNCTIONAL: the API is a 501 stub, so the
│   │   │   │                     #   page shows an "unavailable" notice. Not in the
│   │   │   │                     #   nav — URL-only. See milestones-10 F1.6
│   │   │   ├── events/           # Event CRUD (+ participants, sessions)
│   │   │   ├── forms/            # Reusable form templates
│   │   │   ├── news/             # Noticias authoring/approval (COMUNICADOR)
│   │   │   ├── reports/          # Usage reports (+ print.css)
│   │   │   ├── audit/            # Audit trail viewer (superadmin)
│   │   │   ├── spaces/           # Superadmin: Space CRUD
│   │   │   ├── resources/        # Superadmin: Resource CRUD
│   │   │   ├── reservation-types/# Superadmin: ReservationType CRUD
│   │   │   ├── site/             # Superadmin: site config
│   │   │   ├── themes/           # Superadmin: seasonal landing themes
│   │   │   └── roles/            # Superadmin: Role CRUD + permission checklist
│   │   └── banned/               # Fallback page when user is banned
│   │
│   └── api/
│       ├── auth/                 # NextAuth routes + custom endpoints
│       │   ├── [...nextauth]/    # NextAuth handler
│       │   ├── register/         # Registration endpoint
│       │   ├── confirm-email/    # Email verification
│       │   ├── signup/           # Profile completion after email verify
│       │   ├── reset/            # Password reset request
│       │   └── magic-link/       # Magic-link sign-in
│       ├── user/
│       │   ├── profile/          # GET/PUT user profile
│       │   ├── events/           # GET events for the current user
│       │   └── stats/            # GET user dashboard stats
│       ├── admin/                # reservations, users, stats, incidents, events,
│       │                         #   forms, news, reports, resources, spaces,
│       │                         #   reservation-types, site-config, themes, checkin
│       ├── forms/                # Public form submit/edit/cancel + uploads
│       ├── spaces/ events/ reservation-types/   # Public read endpoints
│       ├── resources/[spaceId]/  # Available resources & calendar for a Space
│       ├── session/              # GET current session (session validation)
│       ├── cron/
│       │   ├── maintain-reservations/  # Daily 5am UTC (scheduled in vercel.json)
│       │   └── report-snapshot/  # ⚠️ Endpoint exists but is NOT in vercel.json's
│       │                         #   `crons` — it never fires on Vercel today
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
│   │   ├── session/              # NextAuth SessionProvider
│   │   ├── user/                 # Current-user context
│   │   └── server-time.tsx       # ServerTimeProvider (client-side time sync)
│   └── organisms/layouts/        # user-layout.tsx, admin-layout.tsx, public-layout/
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
- `Space`: Reservable space (coworking, lab, auditorium, meeting room) with capacity/exclusive/reservable flags — superadmin CRUD at `/admin/spaces`. Booking UI is the single dynamic route `/user/spaces/[slug]` (resolves the Space by its editable `slug`; 404s if missing or not reservable) — there are no per-space hardcoded folders. The user sidebar's space links are built from `getReservableSpaces()` in the user layout and passed to `ManagementLayout` (`spaceNav`), so a renamed/added space stays in sync automatically.
- `Resource`: Physical equipment inventory (superadmin CRUD at `/admin/resources`)
- `ReservationType`: Catalog of reservation/event types (was the `event_types` Postgres enum). `code` is the stable identifier stored on `Event.eventType` / `Reservation.eventType` (text FK, `ON UPDATE CASCADE`, delete restricted while in use); `name` is the display name. Superadmin CRUD at `/admin/reservation-types`; public read at `GET /api/reservation-types`. Migration `20260706110000` seeded MEETING/WORKSHOP/CONFERENCE/OTHER and recreated the SQL functions with `text` params.
- `Role`: RBAC role (milestone 9) — `key`, `name`, `permissions String[]`, `isSystem` (protected from edit/delete), `isSuperadmin` (implicit all-permissions). `RegisteredUser.roleId` FKs here with `onDelete: Restrict`, so an in-use role can't be deleted. Superadmin CRUD at `/admin/roles`.
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
6. **Role-based (RBAC)** — ⚠️ **roles are DATA, not an enum** (milestone 9). A role is a row in `roles` (`prisma/models/roles.prisma`); `RegisteredUser.roleId` replaced the old `UserRole` enum column, and **NULL means the base tier**. The permission _catalog_ stays code-defined in `src/lib/rbac.ts` (`PERMISSIONS`, `hasPermission()`, `isAdminRole()`) because each string maps to a real call site; _which_ of those a role carries is `Role.permissions`, edited by a superadmin at `/admin/roles` (`roles:manage`). Full rationale: `docs/design/03-auth-and-permissions.md`.
   - **Protected rows**: `Role.isSystem` blocks rename/delete/re-scope (403) — seeded on `USER` and `SUPERADMIN`. `Role.isSuperadmin` makes `hasPermission()` return true for _everything_, including permissions added in a later deploy; it can never be set from the UI (`createRole` hardcodes both flags false). Seeded roles: USER / ADMIN / SUPERADMIN / COMUNICADOR, with the exact permission sets they had pre-migration. COMUNICADOR is an admin-panel role scoped to authoring Noticias (`news:manage`) — it cannot approve its own posts.
   - **Middleware** (fast path, no DB): the JWT carries the _resolved_ permission list (`token.permissions` + `token.isSuperadmin`), not a role name. `/admin` needs `admin:access`; `ADMIN_PATH_PERMISSIONS` in `src/middleware.ts` additionally gates `/admin/spaces`, `/admin/resources`, `/admin/reservation-types`, `/admin/site`, `/admin/themes`, `/admin/roles` and `/admin/audit` on their own permission. Keep that table, this list, and `configNavigation`'s per-child `permission` in sync.
   - **API routes**: `requirePermission()` (`src/lib/api-auth.ts`) resolves fresh from the DB via `getPermissionSetForUser()` and returns 401/403. Authoritative — the JWT claim can lag by one request.
   - **Pages/layouts**: `requirePagePermission()` (`src/lib/page-auth.ts`); the admin/user layouts resolve the set and pass it into `UserProvider`, so client components call `hasPermission(user, "…")` on the user object directly (both `Session` and `CurrentUser` structurally _are_ a `PermissionSet`).
   - **Role cache**: `src/lib/db/roles.ts` keeps a module-scoped snapshot (30 s TTL) invalidated by every role write. Call `invalidateRoleCache()` if you add a new write path. It is the seam for a future Vercel Global Config provider (see `docs/OPEN_QUESTIONS.md`).
   - Assigning a role to a user is `users:roles:manage` (`PATCH /api/admin/users/[id]` takes `roleId`; never your own). _Defining_ what a role can do is `roles:manage` — a deliberate split. Seed superadmins: `sa1`/`sa2@lanube.local`.
   - ⚠️ The `jwt()` callback takes only `{ token }` — it deliberately ignores NextAuth's `trigger`/`session` arguments and recomputes `signedUp`/`banned`/`role`/`permissions` from the DB on every call. That is what makes a client-side `useSession().update({...})` unable to forge session state; don't "fix" it by merging the client-supplied session.

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
- **Event image**: `Event.imageUrl`, uploaded via `POST /api/admin/events/upload`
  → `getStorage().upload()`. The reusable `ImageUpload` molecule drives it. **Required**
  at the schema layer (`eventInputSchema`) — same for a Noticia's `coverImageUrl`
  (`newsPostInputSchema`). The DB columns stay nullable for pre-existing rows, so the
  cover-less fallbacks in `EventCover` / `NewsCover` must stay; `eventToFormDefaults`
  maps a null to `""` so editing a legacy row surfaces the validation error.
  `NewsCover`'s fallback is a generated brand cover, **deterministic per slug**
  (`coverPattern()` in `src/lib/news/cover-pattern.ts` — pure, no `Math.random`, so it
  renders identically on server and client). Public news pages: milestone 15.
- **Uploaded covers are never cropped**: `FramedImage` (`molecules/framed-image.tsx`) keeps a
  fixed frame (set by the parent) and draws the whole image `object-contain` over a blurred,
  darkened copy of itself — uploaders reuse Instagram flyers (4:5, 9:16) and `object-cover`
  was cutting off their titles. `NewsCover`, `EventCover`, `EventHero`, the news detail page
  (4:3, `max-h-[70vh]`) and the `ImageUpload` preview all use it; only tiny thumbnails pass
  `fit="cover"`. Don't reintroduce `object-cover` for user-uploaded images. The upload widget
  takes `hint={<CoverImageHint />}`: recommended size **in px** (1920 × 1080, Canva's
  «Presentación») with the ratio in parentheses — uploaders aren't specialists — plus a
  non-blocking toast if the image's long side is < 1080 px.
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

- **Sessions commit with the event, not on their own.** The `Sesiones` panel
  (`event-sessions.tsx`, **inline in the event form's "Agenda" section** since milestone 14: a
  live summary line + "Gestionar sesiones" → a 10-per-page list; the `?sessions=1` card shortcut
  expands it and scrolls to it) is a **client-side staging UI**: it previews occurrences from the _live form recipe_ (`planEventOccurrences`
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
preserves filters. Since milestone 16 it is a **table** (`EventsAdminTable`, one card per row on
phones) — event (thumbnail, ★ if featured, type · space) / dates + weekdays + time / status /
registrations + window / actions — with checkboxes + bulk **Destacar / Quitar destacado /
Cancelar eventos** (`POST /api/admin/events/bulk`), and a "Destacados" tab (`?featured=1`,
unpaginated, in featured order) where the same table is reordered. The shared `DateRangePicker` molecule (shadcn Popover + Calendar
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
- **The featured order is not a form field** (milestone 14): it is set with "Reordenar
  destacados" on the Events list (and "Reordenar destacadas" on News, `news:approve` only) —
  since milestone 16 a link to the list's "Destacados/as" view (`?featured=1&reorder=1`), which
  reorders **in the same table** (no modal) → `POST /api/admin/{events,news}/featured-order`.
  Bulk "Destacar" appends to the end of that order (`setEventsFeatured`/`setNewsPostsFeatured`). Event/news
  updates pass `featuredOrder: undefined`, so saving a form never overwrites that order.

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

### 8. Frontend data-fetching & error conventions

- **Never call `fetch` directly from a component.** Use `apiGet` / `apiSend`
  (`src/lib/api/client.ts`) or the `useApi` hook (`src/hooks/use-api.ts`). They
  carry `ApiError` with the server's `message`, dedupe concurrent GETs, and give
  you `apiErrorMessage(err, fallback)` for the toast. A few raw `fetch` call sites
  remain (the auth forms and the public form, which need captcha/token handling);
  they all now have a `catch` — don't add more without one.
- **Always handle `useApi`'s `error`.** Rendering only `data`/`firstTime` makes
  a failed request look like an empty result set — the empty state then reads as
  "the data is gone." Use the `LoadError` molecule
  (`src/components/molecules/load-error.tsx`) for an inline message + retry;
  every current caller does (milestone-10 F1.2).
- **API routes must use the envelope** (`apiSuccess` / `apiError` / `apiCatch`
  from `src/lib/api/response.ts`) so failures are logged server-side and the
  client never sees internal error text. Every route now has a `try`/`catch`;
  ~11 still hand-roll `NextResponse.json` for their _success_ shape — migrate
  rather than copy them.
- **Error boundaries exist per route group** (`src/app/error.tsx` and one each in
  `(public)/`, `(management)/user/`, `(management)/admin/`, `forms/`, plus
  `global-error.tsx` for a root-layout crash). They share
  `ErrorBoundaryScreen`; note it never renders `error.message`, only the `digest`.

### 9. Styling & accessibility

- **Use the design tokens, not raw palette classes.** `bg-*`/`text-*` literals
  like `bg-green-100` need a `dark:` sibling or they break dark mode. Prefer
  `--background`/`--card`/`--muted-foreground`/`--border` and friends. For status
  chips use `ToneBadge` / `StatusBadge` (`src/components/atoms/status-badge.tsx`),
  which defines every tone for both themes in one place — don't write a new
  status→color `switch`.
- **⚠️ The token contrast ratios are asserted by a test.** `src/lib/contrast.test.ts`
  parses `globals.css` and fails if `--muted-foreground`, `--foreground`, `--ring`,
  `--border` or `--input` drop below AA. If you change a token and that test fails,
  the token is wrong — don't relax the test. (This exists because
  `--muted-foreground` had silently drifted to 3.06:1 across ~220 usages.)
- **Brand-colored text uses `text-la-nube-selected dark:text-la-nube-secondary`.**
  `text-la-nube-primary` measures 3.06:1 on the light background and fails AA at
  body size. It is fine for borders, icons, spinners, gradient stops, and large
  bold text (≥18.66px, where 3:1 is the AA threshold).
- **Remaining gap: the auth pages have no `dark:` classes at all**
  (`signin`/`reset`/`signup`), so they render light-theme colors in dark mode.
  Tracked in `docs/OPEN_QUESTIONS.md` as a design pass, not a mechanical sweep.

### 10. Navigation

- **Management pages don't hand-roll a back button.** `ManagementLayout` renders
  `ManagementBreadcrumbs` above every page in both shells; the trail comes from
  `managementCrumbs(pathname, userType, spaceNav)` in
  `src/lib/constants/management-crumbs.ts`, so a **new page under `/admin` or `/user`
  gets navigation for free** — there is nothing to opt into. Breadcrumbs rather than a
  bare back link because the section reaches four levels
  (`/admin/events/[id]/participants`), where "back" is ambiguous, and because no sidebar
  item highlights on a detail page, so the trail is also the "where am I".
- **Adding a route means adding its label** to `SEGMENT_LABELS` (or
  `SECTION_LEAF_LABELS` when Spanish gender needs "Nueva" instead of "Nuevo"). A segment
  with no entry is treated as a **dynamic** one and labelled with the action ("Editar"),
  never the raw cuid2 — which is also the fallback if you forget. A grouping prefix with
  no page of its own goes in `NON_NAVIGABLE` so its crumb isn't a dead link
  (`/user/spaces` is the only one today). `management-crumbs.test.ts` covers all of this.
- **Public URLs are English** (`/news`, `/spaces`, `/events`, `/forms`) even though the
  UI copy is Spanish. Renaming one means adding a permanent redirect from the old path in
  `next.config.ts` — shared links live forever (`/services` → `/spaces`,
  `/noticias` → `/news`).
- **The logo is always a link to `/`** — public header (desktop + mobile drawer), the
  `/forms` shell, the sign-in card, and both management sidebars. Sign-in additionally has
  an explicit "Volver al inicio", since **signing out lands there** (`signOut({ callbackUrl:
"/auth/signin" })` in `user-profile`) and there may be no history to go back through.

### 11. Audit trail

- **Every admin route that mutates state must write an audit entry.** This is enforced:
  `src/lib/audit/actions.test.ts` walks `src/app/api/admin/**/route.ts` and fails if a
  file exports a `POST`/`PUT`/`PATCH`/`DELETE` without calling `beginAudit`, `emitAudit` or
  `recordAudit`. If a route
  genuinely shouldn't be audited, add it to that test's `AUDIT_EXEMPT` map **with a
  reason** — don't weaken the check.
- **The registry is the single source of truth** (milestone 16, `src/lib/audit/registry.ts`):
  `AUDIT_ENTITIES` (chip label, sentence phrase, `subject` field, and **which fields are audited
  and their type** — `fields.ts`: `text`/`longText`/`bool`/`number`/`enum`/`date`/`dateTime`/
  `monthDay`/`image`/`set`/`items`/`order`, each with its own diff in the panel) and
  `AUDIT_EVENTS` (entity, `kind` create/update/delete/custom, label, verb, `cascaded`).
  `AUDIT_ACTIONS` (`actions.ts`) only names the ids for call sites and is type-checked against
  the registry. Never a free-text action string. Action ids are persisted in
  `audit_logs.action`, so **renaming one orphans existing history**. `registry.test.ts` fails if
  a piece is missing.
- **In routes: `const audit = await beginAudit("Entity", id)` before writing, then
  `await audit.commit(session, AUDIT_ACTIONS.x, { entityId?, reason?, requestId?, extra? })`**
  (`src/lib/audit/emit.ts`). It snapshots the record before/after (`snapshots.ts`, names
  resolved at write time) and stores only the registered fields per `kind` (`pick.ts`): a
  create stores the non-empty "after", a delete the "before", an update **only what changed —
  and nothing at all if nothing audited changed**. `context` comes from the entity's `subject`.
  For `custom` events (decisions, check-in, reorders) use `emitAudit(session, action, {...})`.
  Both never throw — a broken audit pipe must not break the mutation — and fan out through
  `AUDIT_SUBSCRIBERS` (today: the `audit_logs` writer via `recordAuditFromSession`).
- **Adding something auditable** = declare the entity (fields + `subject`) and its loader in
  `SNAPSHOTS`, the event in `AUDIT_EVENTS` + its name in `AUDIT_ACTIONS`, then
  `beginAudit`/`commit` in the route. Don't hand-pick fields in the route.
- **Everything outside "Información del sistema" must be human-readable** (`humanize.ts`).
  Never put only an id in `before`/`after` — record the name alongside (`role` next to
  `roleId`); `*Id`/`*Ids` keys are hidden from the readable diff. Reorder routes record
  `before/after: { order: [{ id, name }] }` via `snapshotOrder()` (`src/lib/db/auditOrder.ts`);
  a new reorderable list needs a loader there.
- **Bulk actions write one entry per record** (milestone 16 `events|news/bulk`), sharing a
  `requestId` — no "bulk" action id.
- **Cascades share a `requestId`.** One admin action can change records the admin never
  touched — approving a reservation auto-rejects conflicting ones inside
  `approve_reservation()`. Those get their own entries, attributed to the _approving
  admin_ (not "system"), all carrying one `requestId` so `/admin/audit` can group them.
  Add new cascading actions to `CASCADED_ACTIONS` so the view de-emphasises them.
- ⚠️ `approve_reservation()` returns `auto_rejected_ids`; read it with `$queryRaw`.
  `$executeRaw` returns a row count and silently discards the result set — that was a
  real bug that made the cascade invisible for months.

### 12. Notification system

- **Pluggable by design** (milestone 13, `src/lib/notifications/`): a call site builds a
  typed `NotificationEvent` (`types.ts`) and calls `notify(event)` — it never talks to a
  channel directly. `notify()` fans out to every `NotificationProvider` in `dispatch.ts`'s
  `PROVIDERS` array (today: `in-app`, `email`); adding SMS/WhatsApp/push is a new provider
  file plus one line there, no call site changes. Like `recordAudit`, `notify()` **never
  throws** — a broken notification pipe must not fail the mutation that triggered it.
- **Renderers are pure functions per channel** (`render/in-app.ts`, `render/email.ts`,
  switched on `event.type`), so they're unit-tested without touching Prisma or nodemailer.
  A renderer returning `null` means "this event type has nothing to say on this channel" —
  used by `event.sessionChanged`'s email renderer, since that event's email is still sent
  by the pre-existing batched sender (see below).
- **In-app channel** writes one `Notification` row per (event, recipient) via
  `src/lib/db/notifications.ts`; the bell UI (`NotificationBell`, in the shared
  `ManagementLayout` header) polls `/api/user/notifications` every 60s.
- **`event.sessionChanged` is additive, not a replacement**:
  `notifyEventParticipantsBatch` (`src/lib/email/event-occurrence-update.ts`) keeps its own
  bespoke **one email per participant covering a whole batch of changes** — a per-event
  `notify()` call can't reproduce that batching — and separately calls `notify()` once per
  (participant-with-an-account, change) for the in-app channel only.
- Same synchronous-fan-out trade-off as every other email sender in this codebase (see the
  `TODO(scale)` on `notifyEventParticipantsBatch`): `notify()` dispatches inline, inside the
  triggering request. Fine at current scale; Vercel Queues is the named next step if that
  changes. Full design: `docs/milestones/milestones-13-notifications.md`.

### 13. Mobile layout & form conventions (milestone 14)

Full design + decisions: `docs/milestones/milestones-14-mobile-redesign.md`.

- **Admin lists use `DataTable` (`src/components/ui/data-table.tsx`), never a hand-rolled
  `<Table>`.** Below `md` it renders **one card per row** from each column's
  `meta.mobile` role (`title` | `meta` (default) | `badge` | `actions` | `leading` |
  `hidden`) and `meta.label` (the "Etiqueta: valor" text). Small static lists use
  `useStaticTable(data, columns)`; clickable rows use `onRowClick`. Don't add an
  `overflow-x-auto` table "fix" — a wrapper alone still makes a phone scroll sideways.
- **Dialogs: `ResponsiveDialog*` (`molecules/responsive-dialog.tsx`)**, same API as
  `ui/dialog` — a centered Dialog from `md`, a bottom Drawer (vaul) below. **Dialog vs page
  rule:** a form stays in a dialog only if it has ≤ ~4 simple fields, fits a phone without
  scrolling and has no rich editors / nested pickers; otherwise it gets its own page (e.g.
  `/admin/themes/new`, `/admin/roles/[id]/edit`).
- **Page forms** use `molecules/form-layout.tsx`: `FormPageLayout` (main column + aside,
  aside sticky on `lg` and stacked **last** on phones), `FormSection` (title + one-line
  description; `tone="danger"` for a "Zona de peligro"), `FormJumpIndex` (lg only),
  `StickySaveBar` (Guardar/Cancelar always reachable; `fixed` to the window bottom, right of the sidebar, with a measured spacer — not `sticky`, which floated mid-page on short forms / wide windows), plus
  `useUnsavedChangesGuard` + `UnsavedChangesDialog` (`hooks/use-unsaved-changes-guard.tsx`:
  `beforeunload` + internal-link interception; call `guard.release()` right before a
  post-save `router.push`). The browser Back button is not intercepted (known limit).
- **No numeric order/priority fields.** Ordering is the shared **"Reordenar" mode**
  (`@dnd-kit`, grip handle at row end, keyboard sensor, explicit Guardar/Cancelar). Since
  milestone 16 admin lists reorder **inside the same `DataTable`**: `useTableReorder(items,
onSave)` + `ReorderBar` (`molecules/table-reorder.tsx`) and `DataTable`'s `reorder` prop
  (hides `actions`/`leading` columns while active). `ReorderList` (`molecules/reorder-list.tsx`)
  remains only for lists inside a form (form builder, space FAQs). Backed by an audited bulk
  endpoint per entity
  (`spaces/reorder`, `reservation-types/reorder`, `themes/reorder` — list order **is** the
  priority, top wins — `events|news/featured-order`). Edits never write the order columns.
- **Bulk actions** (milestone 16, `molecules/bulk-actions.tsx`): `selectionColumn()` +
  `BulkActionBar` + `BulkConfirmDialog` (lists what will be touched) + `useBulkAction(endpoint)`
  against a `POST …/bulk` route (`{ ids, action }` → `{ done, skipped: [{ id, reason }] }`,
  `src/lib/schemas/bulk.ts`). The route re-applies the same per-record permission rules and
  skips with a reason instead of failing the batch. Used by events and news.
- **Yearly windows ("MM-DD", landing themes)** use `AnnualRangePicker`
  (`molecules/annual-range-picker.tsx`): the shadcn range calendar with month-only captions,
  able to cross the year end; helpers in `src/lib/landing-themes/month-day.ts`.
- **Slugs are derived, never typed** (news, spaces): slugified from the title/name on
  create, **stable afterwards**, tucked behind "Editar" / "Avanzado" for the rare manual
  fix; collisions get a numeric suffix server-side (`-2`).
- **KPI tiles** use `StatGrid` / `StatTile` (`molecules/stat-grid.tsx`): 2×2 compact on
  phones, tones with built-in `dark:` variants.
- **Booking calendar** (`organisms/calendar/`): `WeekCalendar` shows 1 / 3 / 5 days by width
  (`calendar-utils.ts`, unit-tested), `DayStrip` on narrow views, tap-a-slot → booking drawer
  on touch (drag-select is mouse-only), opens on the first week/day still bookable under the
  24h notice rule. Pure date logic lives in `calendar-utils.ts`; keep it there.
- **Mobile screenshots:** `node scripts/mobile-shots.mjs <name> [filter]` (Playwright, signs
  in as `u1` / `sa1`) captures every route at phone 390 (light + dark) / tablet 820 /
  desktop 1440 into gitignored `.mobile-shots/<name>/` and prints **OVF** lines for
  page-level horizontal overflow. Run it for any layout change; the agreed baseline is
  `.mobile-shots/baseline/`.
- The management nav drawer is a `Sheet` at `z-[120]` (the sticky header is `z-100`); the
  WhatsApp floating button is hidden under `/admin` and `/user`.

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
