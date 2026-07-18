# Booking core

The **baseline domain** of the app: reservations, the 15-minute `ReservationLedger`,
capacity/conflict checks, and the resources they book. Everything else (events, a
future newsletter, …) is a **module** layered on top.

This folder is the booking core's **operations port** — the single, typed surface
that the rest of the app and every module call. Nothing outside `src/core/booking`
should touch the `reservation` / `reservation_ledger` / `reservation_exceptions`
tables or the reservation SQL functions (`create_event_reservation`,
`rebuild_reservation_ledger_forward`, `reservation_window_conflicts`, …) directly.

```ts
import { booking, BookingError } from "@/core/booking";

await booking.createBlockingReservation(spec, tx); // reserves + fills the ledger
const rows = await booking.listReservationsForOwner({ type: "EVENT", id }, tx);
await booking.rebuildLedger(reservationId, tx);
```

Operations are **owner-scoped** and take an opaque `OwnerRef` (`reservable_type` +
`reservable_id`) — booking never joins the owner back to a concrete table (the FK
was intentionally dropped), so a module owns its own rows via its id without booking
knowing anything about it.

Errors are language-neutral `BookingError`s with a stable `code`
(`ALREADY_BOOKED`, `RESOURCE_NOT_FOUND`, `RESCHEDULE_CONFLICT`); callers map codes to
their own localized messages.

## End-goal: an independently-versioned, cross-repo package

The intent is to lift this folder into a standalone package (its own versioning,
its own Prisma schema slice + migrations, its own SQL functions) so other projects
can reuse the booking engine. Routing all reservation/ledger access through this
port is what makes that lift mechanical rather than a rewrite. Three remaining seams
must be cut first (deferred to that session):

1. **Actor / identity resolver.** The core still assumes app concepts for
   _who_ is booking: `registered_users` and `get_actor_size()` (USER = 1,
   TEAM/ORG = member count). For a generic package this must become an **injected
   interface** — the host passes an `actorId` + a `resolveActorSize(actorId)`
   callback — so booking never references the host's user tables. (Events don't hit
   this path: they block by resource capacity, so the events refactor didn't need
   it — but the core's own USER/TEAM/ORG reservations do.)

2. **SQL + migrations travel with the package.** The real business logic lives in
   Postgres functions/triggers (`create_reservation`, `approve_reservation`,
   `get_unavailable_slots`, ledger rebuild, …). The package owns those migrations.
   `create_event_reservation` should be renamed/generalized to
   `create_blocking_reservation` (parametrized `reservable_type`) at that point.
   ⚠️ `prisma migrate dev` still tries to re-add the dropped `reservable_id` FK —
   the hand-written migration is the source of truth.

3. **Transaction ownership.** Today callers (e.g. `updateEvent`) open one
   `prisma.$transaction` spanning both their own tables and booking's, and pass the
   `tx` into port ops. That only works while everything shares one PrismaClient.
   A separate package with its own client needs a `runInTransaction` it owns, or a
   shared pool — this is the main reason a separate _service_ with its own DB
   (rather than a shared-DB library) would be a much bigger change.

## Residual coupling still in `src/modules/events`

Not blocking, but noted for the extraction pass: the events read queries still join
the `Space` and `ReservationType` Prisma relations for display names/capacity
(`event.space.name`, `event.type.name`). Those are read-only FK joins on the `Event`
model. When schema ownership actually splits, replace them with a
`booking.getResource(...)` / reservation-type lookup. They were left as-is here
because they carry no data-integrity risk (unlike the ledger writes, which are now
fully behind the port).
