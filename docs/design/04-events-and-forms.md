# Capability spec: Events, forms & participant approval

Status: **implemented** (this documents the system as built, reconstructed
from code — it was not written before the feature, unlike the workflow's
usual "spec first" order; see
[`docs/rejected/0001-retroactive-docs-migration.md`](../rejected/0001-retroactive-docs-migration.md)).
Treat this as the current authoritative description; new changes to this
area should update this doc as part of the change, not just the code.

## What an Event is

An admin-run, weekly-recurring activity (workshop/class) on one `Resource`.
Creating an Event materializes **one `Reservation` per selected weekday**
via `create_event_reservation()`, `APPROVED`, sized (`actorSize` = resource
capacity) so the resource is fully blocked for that slot — an Event never
competes for capacity with a regular user booking on the same resource.

## Lifecycle

`status`: `DRAFT → PUBLISHED ⇄ PAUSED`. `ENDED` and `CANCELLED` are
**derived**, never stored:

- `ENDED`: `eventDisplayStatus()` returns it once `recurrenceEnd ??
endTime` is in the past. No cron flips a stored flag — this is
  computed at read time everywhere status is shown.
- `CANCELLED`: derived from `deletedAt` being set (soft delete). Highest
  precedence in `eventDisplayStatus` — a cancelled-but-not-yet-ended event
  still shows CANCELLED, not its date-based status.

Only `PUBLISHED` events are public (`getPublicForm`, `submitForm`,
`getUpcomingPublicEvents` all gate on it, plus window/capacity/not-ended).
`EventForm.isPublished` mirrors `status === PUBLISHED`, kept as a
denormalized flag purely so the calendar query doesn't need to join back to
`Event.status` on every read.

Editing and re-saving a soft-deleted event **revives** it (clears
`deletedAt`) — there is no separate "restore" action; save is idempotent
either way.

## Forms: template vs. instance

Templates are built and managed independently (`/admin/forms`,
`db/forms.ts`). Binding a template to an event **clones** it into a fresh
instance `Form` (new field ids) plus an `EventForm` (slug + registration
window). This clone is a deliberate snapshot:

- Editing or deleting the template afterward never changes the bound
  event's fields, nor any already-submitted participant's stored answers
  (answers are keyed by field id, which only exists on the instance).
- On event edit, re-cloning only happens if the template itself is
  swapped for a different one — and that swap is **blocked once anyone has
  registered**, because it would orphan existing answers against a
  different field-id space. Otherwise editing an event only touches the
  registration window/publish state, keeping the slug and field ids
  stable.

## Sessions (per-occurrence cancel/reschedule)

Events stay weekly-recurring; individual occurrences are
cancelled/rescheduled as `ReservationException`s, requiring a `reason`
(business rule — the underlying column is nullable, but event exceptions
must always carry one). Pure occurrence math (weekly expansion + exception
overlay + drop detection + saved-vs-staged merge) lives in
`src/lib/events/occurrences.ts`, unit-tested, deliberately separated from
the UI/persistence layer.

**The `Sesiones` dialog is a client-side staging UI, not a live editor.**
It previews occurrences computed from the _live, unsaved form recipe_,
overlaid with already-saved exceptions, plus a local, not-yet-persisted
`SessionAction[]` array. **Nothing persists, and no email sends, until the
whole event form is saved.** Actions are keyed by weekday + nominal
occurrence date (not reservation id) specifically so they survive the user
also editing the recipe (e.g. changing the date range) in the same sitting
without losing already-staged session edits.

On save, `updateEvent` resolves each staged action to a reservation by
weekday **after** diffing the recurrence, writes/clears the corresponding
exception, rebuilds the ledger, and only sends notifications **after the
transaction commits** — an edit that gets rolled back must never have
emailed anyone.

**Editing preserves exceptions**: weekday changes update reservations in
place (no delete+recreate), specifically so saved exceptions survive
routine edits. It throws (409, dropped-sessions list) only when an edit
would _drop_ a saved exception (weekday removed, date now out of range,
resource changed) — the UI then confirms and resends with `force: true`
rather than silently discarding a cancellation/reschedule someone already
made.

## Participant approval

`Event.requiresApproval` toggles whether registration is auto-approved
(default) or filtered by an admin.

- Status: `PENDING / APPROVED / REJECTED / CANCELLED`. **The one capacity
  rule**: `SPOT_HOLDING_STATUSES` = PENDING + APPROVED is the single
  source of truth for "counts toward capacity," reused by every count
  site (`getPublicForm`, `submitForm`, `resourceCalendar`, landing/event
  cards). This means for a manual-approval event, cupo caps
  **registrations received**, not the final approved headcount — a
  deliberate trade-off (over-subscribing pending review isn't prevented)
  rather than an oversight. Don't reintroduce ad hoc status filters
  elsewhere; extend `SPOT_HOLDING_STATUSES` if the rule ever needs to
  change.
- Re-registering after REJECTED/CANCELLED reactivates that same row
  (clears the prior decision) rather than creating a duplicate — the
  unique constraint is `(eventId, email)`.
- Admin decisions are scoped and asymmetric: **approve only touches
  PENDING**, **reject touches PENDING + APPROVED** — so approving never
  re-emails someone already approved, but an admin can still walk back an
  approval.
- **Not supported**: re-approving a REJECTED participant in place. Freeing
  and re-occupying a spot needs a fresh capacity check that the current
  write path doesn't do; the workaround is the participant re-registering,
  which does go through the normal capacity check.

## Notifications

Occurrence changes (cancelled/rescheduled/restored) and decisions
(approved/rejected) both email affected participants, both synchronously
after commit — see
[`02-architecture.md`](./02-architecture.md#notifications-are-synchronous-by-design-for-now).
