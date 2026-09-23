# Milestones

Forward-looking feature docs, one per milestone. Each doc states the use case,
what needs building, and an implementation plan — not a task-by-task
execution plan (see `docs/superpowers/plans/` for that level of detail once a
milestone is scheduled).

Grouping criterion: one coherent piece of user-facing (or operator-facing)
capability per milestone, regardless of how many files it touches. A
milestone is done when its use case is fully satisfied, not when an arbitrary
task list is checked off.

- [`milestones-1-admin-reservations-browsing.md`](./milestones-1-admin-reservations-browsing.md) — replace the fixed two-week reservation window (dashboard + admin page) with a paginated, arbitrary-window view, and add an "All spaces" filter as the default. **Implemented** on branch `milestone-1`.
- [`milestones-2-audit-trail.md`](./milestones-2-audit-trail.md) — record who did what, with a before/after diff and a human-readable timestamp, across admin mutations. **Partially implemented** on branch `milestone-2`: schema, write helper and the `/admin/audit` view are done, and 7 routes are instrumented (`users/[id]`, `reservations/[id]`, `spaces/[id]`, `resources/[id]`, `reservation-types/[id]`, `news/[id]`, `news/[id]/decision`). Still uninstrumented: every collection `POST` (creates aren't logged, only edits/deletes), plus `events/*`, `forms/*`, participant decisions, `incidents/*`, `site-config`, `themes/*`, `checkin/[id]` and `spaces/reorder`. No tests yet.
- [`milestones-3-seasonal-landing-themes.md`](./milestones-3-seasonal-landing-themes.md) — superadmin-configurable date-based landing themes (anniversary/Christmas/etc.), starting with a first-visit "tada" emoji shower. **v1 implemented** on branch `milestone-3` (`LandingTheme` model, `resolveActiveTheme()`, `/admin/themes`, `EmojiShower`, hero eyebrow/keywords override); the effect-trigger question is resolved in the doc. The deferred v2 items (accent presets, top banner/ribbon) stay open in `OPEN_QUESTIONS.md`.
- [`milestones-4-news-section.md`](./milestones-4-news-section.md) — a public "Noticias" section backed by a new `NewsPost` model, a new Comunicador role, and a featured flag. **Implemented** on branch `milestone-4`.
- [`milestones-5-recurring-reservation-cancel-scope.md`](./milestones-5-recurring-reservation-cancel-scope.md) — ask "this occurrence or the whole series?" when a user cancels a recurring reservation. **Implemented** on branch `milestone-5`.
- [`milestones-6-teams-and-organizations.md`](./milestones-6-teams-and-organizations.md) — flat admin-provisioned `Organization`s plus self-service `Team`s as bookable actors. Planning only.
- [`milestones-7-proposals.md`](./milestones-7-proposals.md) — a community suggestion box; the dormant `Proposal`/`ProposalComment` schema gets migrated to match the use case. Planning only.
- [`milestones-8-inventory-and-purchase-orders.md`](./milestones-8-inventory-and-purchase-orders.md) — track equipment and consumables with restock thresholds; restructures the dormant `Inventory`/`PurchaseOrder` schema. Planning only.
- [`milestones-9-dynamic-roles.md`](./milestones-9-dynamic-roles.md) — replace the hardcoded `UserRole` + `rbac.ts` permission map with superadmin-defined roles. **Implemented** on branch `milestone-9` (branched from `preview`): `Role` rows + `RegisteredUser.roleId`, `/admin/roles` CRUD, resolved permissions on the JWT, behaviour-preserving seed. One blocker left open — the Vercel Global Config cache the doc decided on is shipped as a swappable in-process seam instead.
- [`milestones-10-frontend-audit-hardening.md`](./milestones-10-frontend-audit-hardening.md) — findings from the 2026-09-23 frontend audit (error handling, accessibility/contrast in both themes, security headers), sliced into fixes. A **quality** milestone rather than a feature one. **Implemented** on branch `milestone-10` (from `milestone-9`): all six slices, plus a contrast regression test that reads the tokens out of `globals.css`. Two items held back on purpose — the CSP nonce (needs a preview walkthrough) and the auth pages' dark mode (needs a design pass).

See [`../OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md) for the running list of undefined product/design decisions across these milestones.
