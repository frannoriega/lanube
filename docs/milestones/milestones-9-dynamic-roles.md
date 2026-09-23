# Milestone 9 — Superadmin-defined roles & permissions

> **Implemented (2026-09-23)** on branch `milestone-9` (from `preview`). Roles are rows
> in `roles`; `RegisteredUser.role` (the `UserRole` enum) became `roleId`. Migration
> `20260924000000_dynamic_roles` seeds USER/ADMIN/SUPERADMIN/COMUNICADOR with exactly the
> permission sets `ROLE_PERMISSIONS` held in code, so the cutover changed no behaviour —
> verified against the live dev DB (43 users repointed, counts unchanged) and pinned by
> `src/lib/db/roles.seed.test.ts`, which reads the migration SQL rather than restating the
> code. `docs/design/03-auth-and-permissions.md` was rewritten as the new authoritative
> description (item 6).
>
> **Open questions resolved while building:**
>
> - **How is `SUPERADMIN` represented?** → a protected `isSystem` + `isSuperadmin` `Role`
>   row whose permission check bypasses the stored list. Chosen over a separate boolean on
>   `RegisteredUser` so there is exactly one mechanism (`roleId`) to reason about, and so
>   the tier appears in the roles UI like any other. The lockout risk the question raised
>   is handled by `isSystem`: the API returns 403 on any edit/delete of such a row
>   (verified end-to-end), and `isSuperadmin` cannot be set from the UI at all —
>   `createRole` hardcodes both flags to `false`, so a superadmin can never mint a second
>   always-all-powerful tier.
> - **Can a role's permission set change while users hold it, with no transition step?** →
>   yes, as recommended. There is no transition state; the next authoritative check picks
>   up the new set.
>
> **Deviation from the recorded decision — the edge cache (see "blocker" below).** The doc
> decided _option 2, Vercel Global Config_. That store cannot be provisioned from the
> repo (it needs an account-level store plus a `GLOBAL_CONFIG`/`EDGE_CONFIG` token), so
> what shipped is the same shape behind a swappable seam: an in-process role snapshot in
> `src/lib/db/roles.ts` with a 30 s TTL, invalidated explicitly by every role write, read
> by the authoritative API/page layers. Middleware never touches it — the JWT carries the
> **resolved permission list**, recomputed from the DB inside `jwt()` on every call, so
> middleware stays DB-free exactly as before. Net effect on the property that motivated
> option 2: a role edit is authoritative immediately (layers 2 and 3 re-read), and reaches
> middleware on the session's next touch rather than at re-auth. Moving to Global Config
> later means implementing the same interface — no call site changes.
>
> **What shipped, against "What needs building" below:** 1 ✓ schema, 2 ✓ migration + seed
> (`prisma/seed.ts` now looks roles up by `key`), 3 ✓ `rbac.ts` rewrite + every call site,
> 4 ✓ `/admin/roles` with a grouped permission checklist and delete-restricted-while-in-use,
> 5 ✓ the user role picker now selects a `Role` id (`PATCH /api/admin/users/[id]` takes
> `roleId`), 6 ✓ design doc. Role writes are audit-instrumented
> (`role.create`/`role.update`/`role.delete`), closing part of milestone 2's rollout list.
>
> **Also fixed in passing:** the config nav section was all-or-nothing behind
> `spaces:manage`; each child now declares its own permission and is filtered
> individually, so a custom role granted exactly one config permission sees exactly that
> entry. `isAdminByEmail()` (`adminStats.ts`) compared the role name to the literal
> `"ADMIN"` — it now checks `admin:access`, so a superadmin-defined role counts.
>
> **Not done:** no UI to bulk-reassign users off a role before deleting it (the API
> returns a 409 naming the count, and the UI disables the button with a tooltip); the
> Global Config provider itself (above).

## Use case (as described 2026-09-21)

Roles today are fixed in code: `UserRole` (`USER/ADMIN/SUPERADMIN/
COMUNICADOR`) with a hardcoded permission map in `src/lib/rbac.ts`
(`docs/design/03-auth-and-permissions.md`). This surfaced as a real
limitation while discussing Milestone 2's audit-trail visibility: `ADMIN`
is meant to model an **employee** — someone running day-to-day operations
(reservations, check-in, events) — while some capabilities (seeing the
audit trail, changing other users' roles) should belong to the
institution's actual owner/operator tier, not to any employee holding the
`ADMIN` label. Confirmed resolution for audit trail specifically:
superadmin-only, for now (see `milestones-2-audit-trail.md`) — but that's a
one-off fix for one permission. The deeper ask: let a **superadmin define
new roles and choose which permissions each one carries**, instead of a
new tier requiring a code change + redeploy every time. Also noted as a
side benefit: this makes the app's role structure adaptable to a different
coworking's own org chart if this codebase were ever run for someone else.

## Engineering input

**What should stay fixed vs. become dynamic — this is the key design
decision.** The _catalog_ of permissions (`PERMISSIONS` in `rbac.ts`) can't
reasonably become fully dynamic: each permission string corresponds to an
actual `requirePermission()`/`hasPermission()` check hardwired into a
specific route, page, or middleware rule (`docs/design/
03-auth-and-permissions.md`). A superadmin typing an arbitrary new
permission name into a text field would create a permission that gates
nothing. **What should become dynamic is which permissions a role has**,
and **the existence of roles beyond the two that must stay special**
(`USER` — the no-permissions default, `SUPERADMIN` — the
always-all-powerful protected tier). Recommend: keep `PERMISSIONS` as a
code-defined catalog (unchanged); make role-to-permission assignment
data-driven; let superadmin create/rename/delete ordinary roles and
check/uncheck permissions from that fixed catalog per role.

**Treat `ADMIN` and `COMUNICADOR` as ordinary seeded roles, not special
cases.** The whole point is that neither should be more "built-in" than a
role a superadmin creates next month. Seed them as regular `Role` rows
(editable, renamable, deletable) with today's exact permission sets, so
behavior is identical on day one.

**`SUPERADMIN` needs to stay a protected, non-editable tier**, or this
feature creates a lockout risk: someone could otherwise rename/delete the
only role capable of managing roles at all. Recommend a `Role.isSystem`
flag; the seeded `SUPERADMIN` row (or a hardcoded bypass — see open
questions) can't be deleted, and its permission set isn't a stored,
editable list — it should implicitly include **every** permission,
including ones added to the code catalog in the future. Otherwise: ship a
new permission, forget to also grant it to the superadmin role's stored
list, and the institution's own owner tier is locked out of a feature
until someone notices and fixes a data row. That's a real bug class this
choice avoids entirely.

**Performance/architecture consequence — this is the part that isn't
free.** Today, `session.role` is a single string, and `hasPermission()` is
a pure in-memory lookup against a code map — cheap enough for
middleware's fast path (`docs/design/03-auth-and-permissions.md`'s
three-layer enforcement model). Once permissions are per-role _data_,
middleware needs the resolved permission set, not just a role name, to
keep making that same fast, DB-free decision. Two real options, not
decided here:

1. **Embed the resolved permission list in the JWT** at sign-in/refresh —
   the smallest change, since it's the same staleness model already
   documented for role changes today (a promotion/demotion doesn't apply
   until re-auth; the API layer re-reads fresh from the DB regardless).
2. **Cache role→permissions in a fast edge-readable store** (e.g. Vercel
   Global Config), invalidated when a superadmin edits a role, so
   middleware never carries a long-lived stale snapshot the way a 7-day
   JWT would.

**Decided (2026-09-21): option 2, edge-cached lookup** — role/permission
edits should take effect immediately, not on a session's next refresh.
Concretely: role→permissions cached in a fast edge-readable store (Vercel
Global Config is the natural fit — small, read-heavy, rarely-written data,
exactly its intended shape), invalidated whenever a superadmin edits a
role. Middleware reads the cache (no DB round-trip on the hot path); the
API layer keeps re-reading fresh from the DB as it does today. This is
more moving parts than embedding permissions in the JWT, but the
immediate-effect property was explicitly preferred over the simpler
option.

**Scope confirmed (2026-09-21): resale is a real, if not-immediate,
ambition** — one isolated instance per tenant (deploy-per-customer), not
shared multi-tenancy within one deployment. That's a materially different
(and much simpler) shape than a shared-instance SaaS: no per-request
tenant scoping, no cross-tenant data isolation to design, no shared
billing/plan model — "resellable" here means "installable," not
"multi-tenant." The landing page is explicitly excluded from this
ambition (it stays La Nube-specific, quadruple-helix branding and all);
everything else (reservations, events, forms, admin, and now roles) is in
scope to eventually be genericized. This is tracked as its own concern —
see [`05-resale-and-genericization.md`](../design/05-resale-and-genericization.md)
— rather than folded silently into this milestone. For _this_ milestone,
the practical consequence is small: build `Role` as ordinary per-install
data from the start (which the design above already does), and don't
hardcode anything institution-specific into the role/permission system
itself (e.g. don't bake "COMUNICADOR" as a privileged code path anywhere —
it's just a seeded example role, like `ADMIN`).

## What needs building

1. **Schema**: new `Role` model (`id`, `name`, `isSystem Boolean`,
   `permissions String[]` — validated against the code `PERMISSIONS`
   catalog at write time rather than a join table, since the catalog is
   small and code-defined already). `RegisteredUser.role` (the `UserRole`
   enum column) is replaced by `RegisteredUser.roleId String?` — `null`
   means the base `USER` tier (no admin permissions, nothing to store).
   `SUPERADMIN` is either a seeded `isSystem=true` `Role` row whose
   permission check bypasses the stored list (always true, see above), or
   a separate boolean on `RegisteredUser` kept alongside `roleId` — needs
   a decision (see open questions).
2. **Migration + seed**: convert existing `USER/ADMIN/SUPERADMIN/
COMUNICADOR` enum values on every `RegisteredUser` row into the
   equivalent `roleId` (or the superadmin flag), seeding `ADMIN` and
   `COMUNICADOR` as ordinary `Role` rows with their current exact
   permission sets so nothing changes behaviorally on cutover.
3. **`rbac.ts` rewrite**: `hasPermission()` becomes a DB-backed (or
   session-claim-backed, per the JWT-vs-cache decision above) lookup
   instead of a static map; `isAdminRole()` and friends adjust accordingly.
   Every call site (`api-auth.ts`, `page-auth.ts`, middleware, the admin
   user-role-change endpoint) needs updating to work against a `roleId`/
   permission-list shape instead of the `UserRole` enum.
4. **Admin UI — role management** (superadmin-only, likely
   `/admin/roles`, gated by a new `roles:manage` permission — distinct
   from the existing `users:roles:manage`, which is about _assigning_ a
   role to a user, not _defining_ what a role can do): list roles, create/
   rename/delete (blocked while any user holds the role — same
   delete-restricted-while-in-use precedent `ReservationType` already
   uses), and a permission checklist grouped by area (reservations,
   events, forms, news, config, audit) sourced from the fixed
   `PERMISSIONS` catalog.
5. **User role assignment UI**: the existing user-role-change control
   (`PATCH /api/admin/users/[id]`) switches from picking a `UserRole` enum
   value to picking a `Role` id from the current list.
6. **Update `docs/design/03-auth-and-permissions.md`** once this ships —
   its current description ("permissions are code-defined per role...
   nothing persisted beyond the role itself") becomes the _previous_
   architecture; this is exactly the kind of change the documentation
   workflow expects to be folded into the design doc, not left only in
   this milestone file, once built.

## Open questions

Both original questions are resolved — see the status block at the top of this file.
What remains open is the one blocker:

- **The Vercel Global Config provider.** The decision recorded above (option 2) is
  implemented in shape but not in substance: role→permissions is cached in-process with a
  30 s TTL rather than in an edge-readable store, because provisioning that store is an
  account-level action, not a repo change. The consequence in practice is narrow — the
  authoritative layers are always fresh, and the only window is up to 30 s during which a
  _different, already-warm serverless instance_ could serve a pre-edit snapshot to a
  non-authoritative check. To close it: create the store, add the token to the
  environment, and implement the same interface `src/lib/db/roles.ts` already exposes
  (`listRoles` / `getRoleById` / `invalidateRoleCache`).
