# Auth & permissions

## Roles are data; permissions are code

Since **milestone 9** a role is a row in `roles`, not an enum value. The split is
deliberate and is the single most important thing to understand here:

- **The permission _catalog_ stays code-defined** (`PERMISSIONS` in `src/lib/rbac.ts`).
  Every string in it corresponds to a real `requirePermission()` / `hasPermission()`
  call site, so a permission invented at runtime would gate nothing. Adding one is
  still a code change.
- **Which catalog permissions a role carries is data** (`Role.permissions`, a
  `String[]`), edited by a superadmin at `/admin/roles` (gated on `roles:manage`).
  Writes are validated against the catalog and sanitized again on read, so a role row
  can outlive a permission a later deploy removed.
- `RegisteredUser.roleId` replaced the old `UserRole` enum column. **NULL is the base
  tier** — no admin permissions — and is treated identically to the seeded `USER`
  role, so an unassigned row can never read as privileged.

### Protected rows

`Role.isSystem` rows cannot be renamed, deleted or re-scoped from the UI or the API
(403). `USER` and `SUPERADMIN` are seeded that way; without it a superadmin could
delete the only role able to manage roles at all.

`SUPERADMIN` additionally carries `Role.isSuperadmin`, which short-circuits
`hasPermission()` to **always true** and ignores the stored list. This is not a
shortcut — it is what stops a permission added in a later deploy from being silently
withheld from the owner tier until someone remembers to edit a data row. `roles:manage`
is deliberately _not_ seeded to `ADMIN`: defining roles is an owner capability, which
is the employee-vs-owner separation this milestone exists to draw.

### Seeded roles (migration `20260924000000_dynamic_roles`)

Cutover was behaviour-preserving — these carry exactly the sets `ROLE_PERMISSIONS`
held in code beforehand. `src/lib/db/roles.seed.test.ts` asserts that against the
migration SQL so it cannot drift. All four are ordinary rows; `ADMIN` and
`COMUNICADOR` are editable and deletable like any role a superadmin creates.

| Permission                                                                                                                   | ADMIN | SUPERADMIN | COMUNICADOR |
| ---------------------------------------------------------------------------------------------------------------------------- | ----- | ---------- | ----------- |
| `admin:access`                                                                                                               | ✓     | ✓          | ✓           |
| `reservations:manage`, `users:manage`, `events:manage`, `forms:manage`, `reports:view`, `checkin:manage`, `incidents:manage` | ✓     | ✓          |             |
| `news:manage`                                                                                                                | ✓     | ✓          | ✓           |
| `news:approve`                                                                                                               | ✓     | ✓          |             |
| everything else (`users:roles:manage`, `spaces:manage`, …, `roles:manage`, `audit:view`)                                     |       | ✓          |             |

`COMUNICADOR` is deliberately narrow: it can enter `/admin` and manage Noticias
content (including submitting for review), but nothing else — not even approving its
own posts (`news:approve` is withheld).

## Why three enforcement layers, not one

1. **Middleware** (`src/middleware.ts`, JWT claim, fast path): gates `/admin` on
   `admin:access`, and the subpaths listed in `ADMIN_PATH_PERMISSIONS` on a specific
   permission each — `/admin/spaces`, `/admin/resources`,
   `/admin/reservation-types`, `/admin/site` and `/admin/themes` on their `*:manage`,
   `/admin/roles` on `roles:manage`, `/admin/audit` on `audit:view`. That table is the
   source of truth; this list mirrors it and both must move together.

   Because roles are data, the token carries the **resolved permission list**
   (`token.permissions` + `token.isSuperadmin`) rather than a role name — that is what
   keeps middleware DB-free on the hot path. The list is recomputed from the DB inside
   the `jwt()` callback on every call, the same freshness contract the role string had
   before, so a role edit reaches middleware on the session's next touch.

2. **API routes**: `requirePermission()` (`src/lib/api-auth.ts`) resolves permissions
   **fresh from the DB** via `getPermissionSetForUser()`. This exists because the JWT
   claim can lag by one request, and an API mutation is exactly the moment staleness
   would matter (a just-demoted admin still holding a valid JWT must not be able to
   mutate through the API even if middleware's cached claim let the page load).
3. **Pages/layouts**: `requirePagePermission()` (`src/lib/page-auth.ts`) for the
   superadmin config pages; the admin layout separately resolves from the DB and
   passes the resolved set down to client components through `UserProvider`, so
   `hasPermission(user, …)` in the UI agrees with the server.

### The role cache

`src/lib/db/roles.ts` holds a module-scoped snapshot of the `roles` table with a 30 s
TTL, invalidated explicitly by every role write. Layers 2 and 3 read through it, so
resolving a permission set is not a query per request. Milestone 9 named Vercel Global
Config as the eventual edge-readable cache; that store can't be provisioned from the
repo, so this module is the seam — implementing the same shape against Global Config
changes no call site. See `docs/milestones/milestones-9-dynamic-roles.md`.

None of these three is redundant with another: middleware is cheap and
coarse, the API layer is authoritative and fresh, the page layer prevents a
stale-but-not-yet-mutating page render.

## Session & ban interaction

Sessions are NextAuth JWT, 7-day expiration. `jwt()` callback checks ban
status on every session refresh and populates `session.role` (the role's display
name), `session.permissions` and `session.isSuperadmin` by resolving
`RegisteredUser.roleId` through the role cache. If a user is banned **mid-session**, the ban's
`endTime` becomes the new effective session expiration — forcing
re-authentication once the ban lifts, rather than leaving a banned user's
existing session valid until its original 7-day expiry.

## Auth flow (sign-up → sign-in)

Sign-up → email verify → profile completion (creates `RegisteredUser`) →
credentials sign-in. See root `CLAUDE.md` "Authentication Flow" for the
exact endpoint sequence — kept there since it's a linear list, not a design
decision that needs rationale.

## Email identity

Canonical email must match between registration and sign-in. Client-side
validates format only (no MX lookup); `src/lib/email/identity-server/`
applies Gmail dot-stripping deterministically server-side, with no MX
check, so normalization is reproducible without a network call on every
auth attempt. `displayEmail` preserves what the user actually typed for
display, separately from the normalized value used as the lookup key — the
same pattern `EventParticipant` reuses for public form registrations.
