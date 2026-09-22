# Milestone 5 — Cancel one occurrence vs. the whole series (regular reservations)

> **Implemented (2026-09-22):** the cancel-scope prompt is live in
> `WeekCalendar.tsx`'s reservation detail dialog — a recurring USER
> reservation's "Cancelar reserva" now asks "Solo esta reserva" vs. "Toda la
> serie" before either path; a one-time reservation keeps its original
> single-action button unchanged. "Solo esta reserva" calls
> `createReservationException` (already used by Events) with a cancel-type
> exception for the occurrence's date; "Toda la serie" is the existing
> `DELETE /api/resources/[spaceId]` whole-row delete. **Open questions
> resolved as the doc suggested**: no reason is required (private booking,
> no participants to notify) and no email is sent (nothing to notify).
>
> **A real bug had to be fixed to make this work at all**: `getCalendarDataBySpace`
> (`src/lib/db/resourceCalendar.ts`) was setting each occurrence's
> `reservationId` from `get_user_next_reservations()`'s synthetic per-occurrence
> `id` column (`"<reservationId>_<occurrenceStart>"` for recurring rows) instead
> of its `reservation_id` column (the real `Reservation.id`). For a one-time
> reservation the two happen to be equal, so the existing "Eliminar" button
> worked by coincidence; for a recurring reservation it meant cancelling from
> the calendar was already silently broken (a 404 from a bogus id) before this
> milestone — not just missing the per-occurrence option. Fixed as part of this
> change (now reads `reservation_id`); also added an `isRecurring` field to
> `ReservationOccurrence`, batch-looked-up from `Reservation` since the ledger
> RPC doesn't carry it.
>
> Not done: the admin reservations view doesn't get the same per-occurrence
> control (deferred per the doc's second open question — admins already have
> the Events mechanism for their own recurring activities); no new tests
> added (the occurrence-exclusion logic is exercised by the existing
> `createReservationException`/ledger-rebuild path, not new pure logic).

## Use case

Today, a USER with a recurring reservation (e.g. a weekly meeting-room
slot) can only cancel the **entire series** — there is no way to skip or
drop just one occurrence. The equivalent already exists for admin-run
Events (`ReservationException`, see
[`docs/design/04-events-and-forms.md`](../design/04-events-and-forms.md)),
but `createReservationException` has exactly one caller in the whole
codebase (`src/lib/db/events.ts`) — nothing reaches it from a plain user
booking.

Confirmed (2026-09-21): this is a real, if currently low-frequency, gap —
recurring reservations today are used mostly for Events rather than by
individual users booking recurring slots themselves, so it rarely bites in
practice, but there's no reason a user's recurring booking should have
strictly less control than an Event's. When a user cancels a recurring
reservation, they should be asked **"cancel this occurrence only, or the
whole series?"** — mirroring how most calendar apps handle a recurring
event's own cancel action.

## What needs building

- **Cancel-scope prompt** wherever a recurring reservation's cancel action
  exists today (user dashboard, `/user/spaces/[slug]`, and the admin
  reservations view when acting on a user's booking) — a dialog offering
  "Solo esta reserva" vs. "Toda la serie," shown only when
  `reservation.isRecurring` is true; a one-time reservation keeps its
  current single-action cancel.
- **"This occurrence only"** reuses the existing machinery:
  `createReservationException` with a cancel-type exception for the
  selected occurrence date, then the same ledger-rebuild path Events
  already use (`rebuild_reservation_ledger_forward`). No new SQL function
  needed — this is a new caller of code that already exists, not new
  reservation logic.
- **"Whole series"** is today's existing cancel path, unchanged.
- **Reason**: Event exceptions require a `reason` as a business rule (see
  `docs/design/04-events-and-forms.md`); decide whether a user
  self-cancelling one occurrence of their own booking needs one too, or
  whether that requirement is specifically about Events affecting other
  people (participants) and shouldn't carry over to a private booking with
  no one else to notify.
- **Notifications**: Event occurrence changes email participants
  (`event-occurrence-update.ts`). A user cancelling their own single
  occurrence has no one else to notify — confirm this stays silent (no
  email to self) rather than reusing that notification path.

## Open questions (needs a product decision before/while building)

- Does a user need to give a reason when skipping a single occurrence of
  their own booking, or is that requirement specific to Events (where a
  reason is shown to participants)?
- Should the admin reservations view get the same per-occurrence control
  when managing a user's booking on their behalf, or is that out of scope
  for this milestone (admins already have the Events mechanism for their
  own recurring activities)?
