# Auth & permissions

> **Planned change**: this document describes the current, code-defined
> role system. [`../milestones/milestones-9-dynamic-roles.md`](../milestones/milestones-9-dynamic-roles.md)
> proposes making role→permission assignment data-driven (superadmin-defined
> roles) instead of hardcoded here — once that ships, this doc becomes the
> "previous architecture" and should be rewritten as the new authoritative
> description, not left describing a system that no longer exists.

## Roles

`USER / ADMIN / SUPERADMIN / COMUNICADOR` (`UserRole` enum). Permissions are
**code-defined per role** in `src/lib/rbac.ts` (`ROLE_PERMISSIONS`) —
nothing permission-related is persisted beyond the role itself. Granting or
revoking a capability means editing that map, not a DB migration.

| Permission                                                                                                                                         | ADMIN | SUPERADMIN | COMUNICADOR |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------- | ----------- |
| `admin:access`                                                                                                                                     | ✓     | ✓          | ✓           |
| `reservations:manage`, `users:manage`, `events:manage`, `forms:manage`, `reports:view`, `checkin:manage`, `incidents:manage`                       | ✓     | ✓          |             |
| `news:manage`                                                                                                                                      | ✓     | ✓          | ✓           |
| `news:approve`                                                                                                                                     | ✓     | ✓          |             |
| `users:roles:manage`, `spaces:manage`, `resources:manage`, `reservation-types:manage`, `site-config:manage`, `landing-themes:manage`, `audit:view` |       | ✓          |             |

`COMUNICADOR` is deliberately narrow: it can enter `/admin` and manage
Noticias content (including submitting for review), but nothing else — not
even approving its own posts (`news:approve` is withheld). This is the only
role that can author news; `ADMIN`/`SUPERADMIN` can also author _and_
approve.

## Why three enforcement layers, not one

1. **Middleware** (`src/middleware.ts`-equivalent, JWT role, fast path):
   gates `/admin` on `admin:access`, and superadmin config subpaths
   (`/admin/spaces|resources|reservation-types`) on their `*:manage`
   permission. Runs on the JWT claim — no DB round-trip — because it's on
   the hot path for every admin request.
2. **API routes**: `requirePermission()` (`src/lib/api-auth.ts`) **re-reads
   the role from the DB**. This exists because the JWT role can be stale —
   a promotion/demotion doesn't invalidate existing sessions instantly, and
   an API mutation is exactly the moment staleness would matter (a just-
   demoted admin still holding a valid JWT must not be able to mutate
   through the API even if middleware's cached claim let the page load).
3. **Pages/layouts**: `requirePagePermission()` (`src/lib/page-auth.ts`) for
   the superadmin config pages; the admin layout separately checks the DB
   role. This is defense in depth for page-level rendering, distinct from
   the API check on the mutations those pages trigger.

None of these three is redundant with another: middleware is cheap and
coarse, the API layer is authoritative and fresh, the page layer prevents a
stale-but-not-yet-mutating page render.

## Session & ban interaction

Sessions are NextAuth JWT, 7-day expiration. `jwt()` callback checks ban
status on every session refresh and populates `session.role` from
`RegisteredUser.role`. If a user is banned **mid-session**, the ban's
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
