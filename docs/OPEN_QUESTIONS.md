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
- **Rollout order**: which of the not-yet-instrumented routes (bans, spaces/
  resources/reservation-types CRUD, events/forms/participant decisions,
  incidents, site-config) matter most to see logged first?

## Milestone 3 — Seasonal landing themes

- **Effect trigger**: once-per-browser-per-day (localStorage-gated, current
  plan) vs. replaying every visit while a theme is active. Once-per-day matches
  "first time you get into the page," but worth confirming a repeat visitor
  shouldn't also get to see it again.
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

- **`/noticias` index page**: a separate paginated "all posts" page beyond the
  landing preview section (recommended, mirrors how `/admin/events` vs. the
  landing's upcoming-events teaser both exist) — not yet confirmed.
- **Who can approve**: does Admin (not just Superadmin) get `news:approve`, or
  is approval Superadmin-only? The milestone doc assumes both Admin and
  Superadmin can approve; worth a one-line confirmation since it's a single
  permission-grant either way.
- **Comments/reactions on news posts**: explicitly out of scope unless raised —
  listed here only so it stays a deliberate "not now," not an oversight.

## Housekeeping

- **`day-reservation-card.tsx` font sizes**: the Impeccable design hook flags
  four `text-[22px]` stat-card values (lines ~113/123/133/154) as off the
  documented type ramp in `DESIGN.md`. These are pre-existing (not introduced
  by milestone 1's changes to that file). Still undecided: fold `22px` into
  `DESIGN.md`'s type ramp as a sanctioned step, or restyle those stat numbers to
  an existing documented size.
