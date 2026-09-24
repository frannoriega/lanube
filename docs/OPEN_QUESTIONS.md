# Open questions

A running list of product/design decisions that are still undefined — things
worth a conversation before or during the milestone that depends on them.
Resolved items move into the relevant milestone doc's own "Resolved" section
and get deleted from here; this file should only ever hold what's still open.

Grouped by milestone. See `docs/milestones/` for the full context behind each.

## Milestone 2 — Audit trail

Cascade attribution and rollout order are resolved — see
[`milestones/milestones-2-audit-trail.md`](./milestones/milestones-2-audit-trail.md).
What remains is product policy, not engineering:

- **Retention**: keep audit logs forever, or age them out after N months/years? Now that
  every admin mutation writes an entry (check-outs included, which are the highest-volume
  source), the table grows faster than it did — so this is worth deciding before it is a
  problem rather than after. Affects whether a cron-based purge is in scope.
- **Scope of "activity"**: admin-surface mutations only (current), or also user
  self-service actions (cancelling one's own reservation, editing one's own profile)?
  Recommend staying admin-only unless something specific drives the broader scope;
  instrumenting every write in the app is a materially bigger effort.
- **Who can see what**: is the full trail superadmin-only (current), or can ADMIN see a
  filtered subset — e.g. everything except role and ban changes on other admins? Would
  mean splitting `audit:view` into two permissions.
- **Should check-outs live in the same trail?** They are instrumented now, and the view
  filters by action and entity type, so they do not drown anything today. If the volume
  becomes a nuisance in practice, the alternative is a separate lighter log rather than
  going back to not recording them.

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

## Milestone 9 — Dynamic roles

- **Vercel Global Config store for the role cache.** Milestone 9 decided role→permission
  lookups should live in an edge-readable store so edits take effect immediately across
  instances. Shipped instead: an in-process snapshot (30 s TTL, invalidated on every role
  write) behind the same interface, because creating the store and wiring its token is an
  account-level action, not a repo change. Open: provision it and implement the provider,
  or accept the in-process cache as the permanent answer. See
  [`milestones/milestones-9-dynamic-roles.md`](./milestones/milestones-9-dynamic-roles.md).
- **Bulk reassignment before deleting a role.** Deleting an in-use role is blocked with a
  409 naming the affected user count; there is no UI to move those users somewhere else
  first. Worth building only if roles turn out to churn in practice.

## Milestone 10 — Frontend audit (error handling, a11y, security)

The audit's five original questions are resolved — see the status block in
[`milestones/milestones-10-frontend-audit-hardening.md`](./milestones/milestones-10-frontend-audit-hardening.md).
What is still open is the work deliberately held back:

- **The CSP nonce (F3.1).** `'unsafe-inline'` is still in `script-src`, which is the
  single biggest remaining gap in the header: it permits exactly the injected script the
  policy exists to stop. Everything else in slice C shipped. Removing it needs a
  middleware-generated nonce, and a wrong nonce blanks the whole app with `npm run build`
  passing — so it wants a preview deployment walked route group by route group,
  `/forms/[slug]` included (the auth-gated routes never exercise it). Open: schedule that,
  or accept `'unsafe-inline'` as the standing position.
- **Dark mode for the auth pages.** `signin` / `reset` / `signup` are wrapped in
  `ThemeProvider` but contain not one `dark:` class (~60 palette literals), so in dark
  mode they render light-theme colors. Slice D's mechanical sweep is the wrong tool here —
  these are full-bleed branded screens, so it is a design pass. Open: do it, or decide the
  auth screens are deliberately light-only and drop the `ThemeProvider`.
- **Did the `--muted-foreground` change land well?** It moved `#888282` → `#666666`,
  affecting ~220 secondary-text usages at once to clear AA. Measured and now asserted in
  `src/lib/contrast.test.ts`, but it is a deliberate visual change and nobody has looked
  at it in a browser yet.
- **Is the per-day "Reservar" button the right keyboard path?** Built as option (a), the
  audit's own recommendation, because the alternative was leaving a WCAG Level A failure
  with no workaround. It adds a visible control to every day column — worth confirming it
  reads well before merge, and whether it should also appear on touch-width layouts.
- **Finish the Incidents feature.** Now honest about being unavailable rather than faking
  a working screen, and unreachable from the nav. The `Incident`/`IncidentUser` models and
  a commented-out implementation exist. Its own milestone when it is wanted.

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
