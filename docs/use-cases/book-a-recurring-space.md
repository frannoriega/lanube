# Use case: book a recurring space, then skip one week

## Situation

A logged-in member wants the same meeting room every Tuesday 10–11am for
the next two months, but knows they'll be away one particular Tuesday and
want that single week off without cancelling the whole series.

## Walkthrough

1. User opens `/user/spaces/[slug]` for the meeting room (resolved by the
   Space's editable `slug`).
2. They pick a weekly recurrence and an end date; the client submits an
   RRULE string + `recurrenceEnd`.
3. `create_reservation()` (SQL) creates one `Reservation` row
   (`isRecurring=true`) and populates `ReservationLedger` with a 15-min
   bucket per occurrence, rejecting the whole request up front if any
   occurrence would exceed capacity — this is why the ledger exists as a
   precomputed structure rather than computing capacity from the RRULE on
   every write.
4. Because this is a meeting room, `exclusive` governs approval: if
   `exclusive=true`, `approve_reservation()` allows only one approved
   reservation on that resource for a given slot and auto-rejects
   conflicting pending ones; if it's capacity-based instead,
   `approve_reservation()` rejects pending ones only once capacity is
   exceeded, per `docs/design/00-overview.md`'s "Complex DB Features"
   section (in `CLAUDE.md`).
5. To skip one Tuesday: the user (or admin) creates a
   `ReservationException` for that specific occurrence date, cancelling
   just that instance. `docs/design/01-domain-model.md` — the exception is
   applied on top of the RRULE expansion at read time; the underlying
   `Reservation` row and its RRULE are untouched.
6. The calendar UI and any availability check for that resource/date now
   reflect the skipped week without the user needing to re-book the
   remaining occurrences.

## Gaps / friction

- **Step 5 does not actually exist for a regular USER booking.**
  `createReservationException` (`src/lib/db/reservations.ts`) has exactly
  one caller in the whole codebase — `src/lib/db/events.ts`, i.e. only the
  admin-facing Event `Sesiones` flow (`docs/design/04-events-and-forms.md`)
  can skip/reschedule a single occurrence. There is no route or UI that
  lets a USER (or an admin, for a plain user booking) skip one occurrence
  of their own recurring reservation — the only lever is cancelling the
  entire series. This is a real product gap, not a documentation gap: it
  changed what this walkthrough could honestly describe, so step 5 above
  is aspirational, not current behavior. Added to
  [`docs/OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md) under "Design docs."
