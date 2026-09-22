# Use case: capacity-limited workshop with manual approval

## Situation

An admin runs a 20-seat "3D printing intro" workshop every Wednesday for a
month. Because seats are scarce, they want to personally approve who gets
in rather than first-come-first-served. One approved registrant later
cancels, and someone else registers to take the freed spot.

## Walkthrough

1. Admin creates an `Event` (Resource = the lab, weekday = Wednesday,
   `requiresApproval=true`), publishes it (`status=PUBLISHED`), and binds a
   registration `Form` template (cloned into an instance `Form` +
   `EventForm` with a slug and registration window) —
   `docs/design/04-events-and-forms.md`.
2. `create_event_reservation()` materializes one weekly `Reservation`
   (Wednesdays, `APPROVED`, `actorSize` = lab capacity) — the lab is fully
   blocked for that slot regardless of how many workshop seats are filled.
3. Public visitors hit `/forms/[slug]`; `getPublicForm`/`submitForm` gate on
   `PUBLISHED` + window + capacity, using `SPOT_HOLDING_STATUSES`
   (PENDING+APPROVED) against the 20-seat cap. Each submission creates an
   `EventParticipant` with `status=PENDING` (because
   `requiresApproval=true`), normalized-email-unique per event.
4. Admin reviews the participants table, bulk-selects some, and approves
   them via the confirm-and-type-to-arm dialog →
   `POST /api/admin/events/[id]/participants/decision` →
   `decideParticipants()` (touches only PENDING rows) → approval emails
   sent after commit.
5. One approved participant later self-cancels via their `editToken` link
   (`/forms/response/[token]`) → `status=CANCELLED`. Their seat is now free
   (CANCELLED isn't in `SPOT_HOLDING_STATUSES`).
6. A new visitor registers with the same email the cancelled participant
   used → per `docs/design/04-events-and-forms.md`, this **reactivates**
   the same `EventParticipant` row (clearing the prior decision) rather
   than erroring on the unique `(eventId, email)` constraint or creating a
   duplicate. New status is `PENDING` again (since `requiresApproval` is
   still true), and it goes through the normal capacity check at
   submission time.

## Gaps / friction

None found — this scenario is fully covered by the documented model
(`docs/design/04-events-and-forms.md`), including the reactivation edge
case in step 6, which is explicitly called out there rather than being an
undocumented surprise.
