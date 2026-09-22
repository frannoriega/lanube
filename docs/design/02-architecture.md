# Architecture

Stack and structure. This doc states _where things live and why they're
split that way_; for exhaustive command/path listings see the root
[`CLAUDE.md`](../../CLAUDE.md), which stays the quick-reference copy.

## Stack

Next.js 15 (App Router) + TypeScript + TailwindCSS v4 + Radix/Shadcn UI,
Next.js API Routes as the backend, PostgreSQL 17 via Prisma, NextAuth v5
(Credentials provider, JWT sessions), Vitest for tests, deployed to Vercel
(cron support).

## Why business logic lives in SQL, not just application code

Reservation approval, capacity checks, and recurrence expansion
(`create_reservation()`, `approve_reservation()`, `get_unavailable_slots()`,
`get_user_next_reservations()`, `get_actor_size()`, `create_event_reservation()`,
`rebuild_reservation_ledger_forward()`) are Postgres functions, not
TypeScript. This is deliberate: capacity/conflict checks must be atomic
against concurrent bookings, and the ledger-bucket model
(`ReservationLedger`) is a read-optimized denormalization that only a
DB-side function can keep consistent with the RRULE source of truth on
write. Search migrations for `CREATE OR REPLACE FUNCTION` rather than
looking for this logic in `src/`.

## Polymorphic `reservable_id`

`Reservation.reservableId` points at either a `RegisteredUser` (USER
booking) or an `Event` (EVENT booking), distinguished by
`Reservation.reservableType`. The FK to `registered_users` was dropped in
migration `20260622000000` specifically so EVENT rows could exist. The
Prisma `Reservation.registeredUser` relation is kept for convenience (joins
on the column, resolves to `null` for non-USER rows) but is **not
enforced** by the database.

**Why not two separate tables (e.g. `EventReservation` vs
`UserReservation`)?** Not written down anywhere — this predates the design
docs. If this comes up again, it's a candidate for
[`docs/rejected/`](../rejected/README.md) once someone can state why the
polymorphic-column approach won over a real subtype split.

**Trap for future migrations**: `prisma migrate dev` doesn't know the FK
was dropped intentionally and will propose re-adding it. Discard that
proposal — the hand-written migration is the source of truth. (Also see
`CLAUDE.md`'s point 8 under Debug Tips: `migrate dev` hangs on this repo for
exactly this reason; use `migrate deploy`.)

## Timestamps are BigInt milliseconds everywhere

Every timestamp column is `BigInt` (Unix ms), generated DB-side via
`EXTRACT(EPOCH FROM clock_timestamp())::bigint`, not `NOW()` — `NOW()`
is frozen for the whole transaction, `clock_timestamp()` isn't, which
matters when multiple rows in one transaction need distinguishable
timestamps (e.g. ledger buckets). NextAuth's own tables (`User`, `Session`,
`VerificationToken`) are the one exception, kept as `Date` for
NextAuth-adapter compatibility, and bridged via
`src/lib/prisma-auth-bridge.ts` (a Prisma extension converting Date ↔
BigInt at the client boundary) rather than converting NextAuth itself.

Client code always converts at the boundary
(`unixMsToDate()`/`dateToUnixMs()`) and formats client-side in the viewer's
timezone/locale — see
[`../foundations/date-handling.md`](../foundations/date-handling.md).

## Faketime for date-dependent testing

The Docker Postgres image supports `libfaketime`; `docker-compose.timemock.yml`
overlays a fixed `FAKETIME`. This exists because RRULE expansion and
reservation-window logic are date-sensitive and need to be exercised at
arbitrary points in time (e.g. testing what "the anniversary window" or "an
event's registration close" looks like) without waiting for real dates to
arrive or mocking the DB's clock function per-query.

## Storage abstraction

`getStorage()` (`src/lib/storage/`) returns a `StorageProvider`
(`upload`/`remove`); selection is by `STORAGE_PROVIDER` env, defaulting to
Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, else a `local` filesystem
provider. The `local` provider is explicitly dev-only (writes to
`public/uploads`, not serverless-safe) — production must have
`BLOB_READ_WRITE_TOKEN` set or uploads (event images) silently write to a
throwaway filesystem on Vercel. See
[`docs/OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md#housekeeping).

## Notifications are synchronous, by design-for-now

Event/participant notification emails (`event-occurrence-update.ts`,
`event-decision.ts`) send inline in the request that triggers them, after
the DB transaction commits (never on rollback). This is fine at current
participant counts; there's a standing `TODO(scale)` to move to a
background job/queue once any event's participant list gets into the
hundreds, because Vercel functions have limited background execution time.
See [memory: notifications-sync-limitation] and
[`docs/OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md).

## Enforcement layers for permissions

Three independent layers check role/permission, not one — see
[`03-auth-and-permissions.md`](./03-auth-and-permissions.md) for why each
exists separately instead of one shared gate.
