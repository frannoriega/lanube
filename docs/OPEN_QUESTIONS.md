# Open questions

A running list of product/design decisions that are still undefined — things
worth a conversation before or during the milestone that depends on them.
Resolved items move into the relevant milestone doc's own "Resolved" section
and get deleted from here; this file should only ever hold what's still open.

Grouped by milestone. See `docs/milestones/` for the full context behind each.

## Milestone 2 — Audit trail

- **Retention**: keep audit logs forever, or age them out after N months/years?
  Affects whether a cron-based purge is in scope for a future pass.
- **Scope of "activity"**: admin-surface mutations only (current, implemented
  slice), or also user self-service actions (cancel own reservation, edit own
  profile)? Recommend staying admin-only unless there's a specific need driving
  the broader scope — instrumenting every write in the app is a materially
  bigger effort.
- **Cascade attribution**: when one action (e.g. approving a reservation)
  triggers others (auto-rejecting conflicts) inside `approve_reservation()`,
  should the trail show that as one grouped event or independent entries linked
  by a correlation id? The schema already has a `requestId` column for this,
  unused so far since the app layer doesn't currently surface which
  reservations got auto-rejected — needs that surfaced first.
- **Who can see what**: is the full trail superadmin-only (current), or can
  ADMIN see a filtered subset (e.g. everything except role/ban changes on other
  admins)? Would mean splitting `audit:view` into two permissions.
- **Rollout order**: which of the not-yet-instrumented routes matter most to
  see logged first? Instrumented as of 2026-09-23: `users/[id]` (role changes),
  `reservations/[id]`, `spaces/[id]`, `resources/[id]`, `reservation-types/[id]`,
  `news/[id]`, `news/[id]/decision`. **Still uninstrumented**: every
  _collection_ POST (creating a space/resource/reservation-type/news post is
  not logged — only editing and deleting one is), plus `events/*`, `forms/*`,
  `events/[id]/participants/decision`, `incidents/*`, `site-config`, `themes/*`,
  `checkin/[id]` and `spaces/reorder`. The create-vs-update asymmetry is
  probably the most surprising gap and worth closing first.

## Milestone 3 — Seasonal landing themes

- **Accent-preset swap** (v2, deferred): which named presets to build first
  (e.g. "Aniversario" gold, "Navidad" red/green), and whether a developer-curated
  list is an acceptable trade-off against true color freedom for a superadmin —
  the recommendation is to keep it curated, to protect `DESIGN.md`'s restraint
  rules, but this hasn't been explicitly confirmed for v2.
- **Top banner/ribbon** (v2, deferred): not yet scoped in detail — text length
  limit, whether it's dismissible, whether it appears on every public page or
  just the landing.
- **Beyond the anniversary**: is a Christmas theme (or others) wanted on the
  same system once v1 ships, or was the anniversary the only concrete trigger
  for building this at all? Affects how soon v2 (banner/accent) gets prioritized.

## Milestone 4 — Noticias / Comunicador

- **Comments/reactions on news posts**: explicitly out of scope unless raised —
  listed here only so it stays a deliberate "not now," not an oversight.

## Milestone 10 — Frontend audit (error handling, a11y, security)

See [`milestones/milestones-10-frontend-audit-hardening.md`](./milestones/milestones-10-frontend-audit-hardening.md)
for the full findings behind each of these.

- **Incidents: finish it or hide it?** (F1.6) `src/app/api/admin/incidents/route.ts`
  is a 501 stub whose real implementation is commented out, while
  `/admin/incidents` ships a complete UI in front of it — so every create and
  update fails with a generic toast and the list is permanently empty. The
  `Incident`/`IncidentUser` models exist. Finishing it is a feature and probably
  its own milestone; leaving a dead page in the admin nav is the worst of the
  three options. _Recommendation:_ hide the nav entry now, open a milestone to
  build it properly.
- **What is the keyboard path for booking?** (F2.5) The `WeekCalendar` creates
  reservations via a mouse drag on a `<div>` — there is no keyboard route at
  all. Drag-select cannot be made keyboard-operable in place. Options: (a) a
  "Reservar" button opening the existing time-range dialog pre-filled, or
  (b) focusable 15-minute cells with space-to-extend, closer to Google Calendar.
  (a) is much cheaper and probably better on touch too. Needs a product call
  before slice E can start.
- **How visible a change is the `--muted-foreground` fix?** (F2.2, slice A)
  Raising it to clear AA changes the look of ~220 secondary-text usages at once.
  That is a deliberate visual change, not a neutral bug fix. Worth eyeballing a
  preview before merging — is slightly heavier secondary text an acceptable
  trade for AA?
- **Is a preview-only rollout enough for the CSP nonce?** (F3.1, slice C) A
  wrong nonce blanks the entire app and `npm run build` will not catch it. The
  proposal is to ship to a preview deployment and walk every route group —
  including `/forms/[slug]`, which the auth-gated routes never exercise —
  before promoting. Confirm that's acceptable, or whether the nonce work should
  wait entirely.
- **Is `reservation-timeline-legacy.tsx` dead?** (F2.7) 53 hardcoded palette
  literals in a file named "legacy". If nothing mounts it, slice D should delete
  it rather than fix it.

## Housekeeping

- **Production storage must have `BLOB_READ_WRITE_TOKEN`.**
  `docs/design/02-architecture.md#storage-abstraction` links here for this, but
  the item had never actually been written down. `getStorage()` falls back to
  the `local` filesystem provider when the token is absent — which on Vercel
  means uploads (event/space/news images) write to a throwaway filesystem and
  vanish, **silently**. Open: should the `local` provider hard-fail when
  `NODE_ENV === "production"` instead of degrading quietly?
- **`/api/cron/report-snapshot` is not scheduled.** The route exists and writes
  `report_snapshots` rows, but `vercel.json`'s `crons` array only lists
  `/api/cron/maintain-reservations`. So it never fires in production. Decide
  whether to add a schedule (note Hobby-tier cron limits) or drop the endpoint.
  Found during the milestone-10 audit; not a milestone-10 finding since it's
  backend/config, not frontend.
