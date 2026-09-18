# Milestone 2 — Audit trail

## Use case

Right now nothing records _who_ changed _what_ in the admin surfaces —
reservation approvals/rejections, bans, role changes, space/resource/
reservation-type edits, site config, event and form changes, incident
records. If something looks wrong (a reservation approved that shouldn't
have been, a role silently escalated, a space's capacity changed and nobody
remembers why), there's no record to check — only `git blame` on the code,
which says nothing about runtime data changes.

Goal: every meaningful admin write is logged with **who did it**, **what
changed** (a diff of the affected slice of state, before → after), and
**when**, in a human-readable form, viewable by admins/superadmins.

There is currently **no audit model, table, or logging of this kind
anywhere in the codebase** (checked `prisma/models/*.prisma` and
`src/lib` — nothing named `Audit`/`audit`). This is a net-new feature, not
an extension of something partial.

## What needs building

1. **Schema**: a new `AuditLog` model (new `prisma/models/audit.prisma`),
   roughly:
   - `id` (cuid2), `actorUserId` (nullable FK to `RegisteredUser` — nullable
     to survive user deletion and to represent system/cron actions),
     `actorLabel` (denormalized snapshot of the actor's name/email at write
     time, so the log stays readable after the user is edited/deleted),
   - `action` (a stable string/enum, e.g. `reservation.approve`,
     `user.role.update`, `space.update`, `event.delete`),
   - `entityType` + `entityId` (what was acted on),
   - `before` / `after` (JSON — the changed slice only, not the whole row —
     see "diff scope" below),
   - `createdAt` (BigInt ms, consistent with the rest of the schema —
     `dateToUnixMs()`/`unixMsToDate()` at the boundary per existing
     convention),
   - optional `reason`/`metadata` JSON for actions that already carry a
     reason (e.g. reservation rejection `deniedReason`, participant decision
     `decisionReason`).
   - Indexes on `(entityType, entityId)` and `(actorUserId, createdAt)` for
     the two obvious query patterns (history of one record; activity by one
     admin).
2. **Write path**: a single `recordAudit()` helper
   (e.g. `src/lib/audit/record.ts`) that every mutating admin route/DB
   helper calls after a successful write, inside the same transaction where
   feasible so the audit entry can never exist without the change it
   describes (or vice versa).
   - Compute the diff as a **shallow field-level before/after** of only the
     columns that changed (not a full-row dump), so entries stay small and
     readable — e.g. `{ role: { before: "USER", after: "ADMIN" } }`.
   - Needs a small diffing utility shared across call sites so every route
     doesn't hand-roll its own before/after comparison.
3. **Instrumentation of existing mutation routes.** Candidate list, from
   `src/app/api/admin/*/route.ts` and `[id]/route.ts` handlers:
   - Reservations: approve/reject (`reservations/[id]`), the
     `approve_reservation()` SQL path auto-rejecting conflicts (this one
     matters — a single admin action can cascade into rejecting _other_
     reservations; those cascaded rejections need their own entries with
     `actorLabel` pointing at the approval that caused them, not a bare
     "system").
   - Users: role changes, bans (`users/[id]`).
   - Spaces, Resources, Reservation Types: create/update/delete
     (superadmin config CRUD).
   - Events: create/update/delete/soft-delete, session
     cancel/reschedule/revert (`event-sessions` staged actions, once
     committed).
   - Forms: template create/update/delete.
   - Participant decisions: approve/reject (`events/[id]/participants/decision`).
   - Incidents: create/update.
   - Site config.
   - Checkin: check-in/check-out actions, if considered audit-worthy (lower
     priority — high frequency, low blast-radius; candidate for exclusion or
     a lighter/separate log to avoid drowning the audit trail).
4. **Read/view surface**: an admin-only page (e.g. `/admin/audit`, gated by a
   new `audit:view` permission in `src/lib/rbac.ts` — likely superadmin-only
   given it can expose role changes and bans) showing:
   - A paginated, filterable list (by entity type, actor, date range —
     mirrors the pagination approach from Milestone 1).
   - Each row: human-readable timestamp (client-formatted per
     `[[date-handling-principle]]` — store/transmit UNIX ms, render in the
     viewer's locale/timezone, not a raw epoch), actor, action label, and an
     expandable diff view (before → after, field by field).
   - Optionally, a "history for this record" entry point from existing admin
     detail views (e.g. a reservation's or a user's own audit history)
     rather than only a global firehose — worth deciding as part of design,
     not required for a first cut.

## Implementation plan

1. **Schema + migration**: add `AuditLog` model, generate + apply migration
   (`npm run db:migrate:deploy` locally per this repo's documented quirk with
   `prisma migrate dev`).
2. **Core helper**: `recordAudit({ actorUserId, action, entityType, entityId, before, after, reason? })`
   in `src/lib/audit/record.ts`, plus a `diffFields(before, after, keys)`
   utility. Follow the existing error/logging conventions
   ([[api-error-logging-conventions]]) — audit writes should never throw and
   break the primary mutation; log-and-continue on audit-write failure
   (with a clear `logger.error` so a broken audit pipe is itself visible),
   never roll back or fail the user-facing action because logging failed.
3. **Wire up one route end-to-end first** (suggest: reservation
   approve/reject, since it already has the richest existing mutation logic
   — approval preview, cascade auto-rejects, deniedReason) as the reference
   implementation and pattern for the rest.
4. **Roll out to the remaining routes** from the candidate list above,
   grouped by domain (users → spaces/resources/reservation-types → events/
   forms/participants → incidents/site-config), each as its own PR-sized
   chunk.
5. **Permission + read API**: `audit:view` in `rbac.ts`, `GET /api/admin/audit`
   (filters + pagination), following existing `requirePermission` +
   `apiSuccess`/`apiCatch` conventions.
6. **Admin UI**: `/admin/audit` list page + diff detail view; add to the
   admin nav.
7. **Tests**: unit test the diff utility, integration test that a sample
   mutation (e.g. role change) produces the expected `AuditLog` row with
   correct before/after.

## Open questions (needs a product decision before/while building)

- **Retention**: keep audit logs forever, or age them out after N
  months/years? (Affects whether a cron-based purge belongs in this
  milestone or is explicitly out of scope.)
- **Scope of "activity"**: does this cover only admin-surface mutations, or
  also user self-service actions (a user cancelling their own reservation,
  editing their own profile)? The use case as described ("keep track of any
  activity") suggests broad scope eventually, but instrumenting every write
  in the app is a much larger effort than the admin-surface list above —
  recommend starting admin-only and treating user-initiated actions as a
  follow-up milestone.
- **Cascade attribution**: when one action (e.g. approving a reservation)
  triggers others (auto-rejecting conflicts) inside the SQL function layer
  (`approve_reservation()`), does the audit trail need to represent that as
  one grouped event or as N independent entries linked by a shared
  correlation id? Recommend a correlation id (e.g. a `requestId` shared by
  all entries written in one HTTP request) to keep entries atomic but
  groupable in the UI.
- **Who can see what**: is the full audit trail superadmin-only, or can
  ADMIN see a filtered subset (e.g. everything except role/ban changes on
  other admins)? Affects the `audit:view` permission shape in `rbac.ts`
  (may need to be two permissions, not one).
