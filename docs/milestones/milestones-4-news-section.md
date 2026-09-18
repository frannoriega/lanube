# Milestone 4 — "Noticias" news section + Comunicador role

## Use case

La Nube wants a public news/blog section on the landing — announcements, community
updates, event recaps — authored by staff without needing a developer to hardcode
anything. Today there's no way to publish this kind of content at all. The ask adds:

- A public **Noticias** section: a landing preview **and** a full
  `/noticias/[slug]` detail page to read the complete post (confirmed
  2026-09-18 — see "Resolved" below).
- A new **Comunicador** role, alongside Admin and Superadmin, that can author
  news entries. Comunicador-authored posts require **Admin/Superadmin approval**
  before going live (confirmed 2026-09-18); Admin/Superadmin publish directly.
- A **featured** flag so certain posts get visual priority.

## Current state

- There's already a **dead, unwired stub**: `src/components/templates/landing/news/index.tsx`
  renders a bare "Noticias" heading on a flat background, matching none of the
  design system (no card structure, no `Breakout`/`Container`, no alternating
  section background per `LANDING_SECTION_BG`). It is **not imported anywhere** —
  not in `src/app/(public)/page.tsx`'s section list. This milestone replaces it
  entirely rather than building on it.
- No `News`/`Post` model exists in Prisma. No `COMUNICADOR` (or similar) role exists
  — `UserRole` is `USER | ADMIN | SUPERADMIN` (`prisma/models/enums.prisma`), and
  `ROLE_PERMISSIONS` in `src/lib/rbac.ts` only defines permissions for those three.
- **Direct precedent to mirror**, already built and battle-tested in this codebase
  for almost exactly this shape (an admin-authored, publishable, optionally
  featured public content type):
  - `Event` has `status` (`DRAFT`/`PUBLISHED`/`PAUSED`, `EventStatus` enum),
    `summary` (≤200 char plain-text card blurb, separate from the full
    markdown `description`), `imageUrl`, `isFeatured` + `featuredOrder`.
  - Description authoring uses `MarkdownEditor`
    (`src/components/molecules/markdown-editor.tsx`) and renders via `Markdown`
    (`src/components/molecules/markdown.tsx`, react-markdown + remark-gfm, HTML
    stripped — safe for admin-authored public content).
  - Image upload uses the existing storage abstraction
    (`getStorage().upload()`, `src/lib/storage/`) via the reusable `ImageUpload`
    molecule, same as `Event.imageUrl`.
  - Landing "featured leads, rest follows" pattern:
    `src/components/templates/landing/events/index.tsx` splits featured vs. rest,
    featured render with a ring + "Destacado" badge
    (`src/components/templates/landing/events/featured-event-card.tsx` /
    `featured-carousel.tsx`), sorted `isFeatured desc, featuredOrder asc, <date> desc`.
  - Admin list pattern: paginated, newest-first
    (`listEvents`/`listFormTemplatesPage` plus the `Pagination` molecule).

  All of the above are directly reusable patterns for `NewsPost` — this is
  substantially "do what Events already does, for a simpler content type."

## What needs building

### Data model

A `NewsPost` model: `id`, `title`, `slug` (unique, for the detail URL), `summary`
(short, plain text, for cards — same role as `Event.summary`), `body` (markdown,
same role as `Event.description`), `coverImageUrl` (optional), `authorId` (FK to
`RegisteredUser` — whoever wrote it, shown as a byline), `publishedAt` (BigInt
ms, set the moment status becomes `PUBLISHED` — drives "newest first" ordering
independent of `createdAt`), `isFeatured` + `featuredOrder`,
`createdAt`/`updatedAt`.

**Status is a small approval state machine**, not the two-state `DRAFT`/`PUBLISHED`
originally sketched — the approval requirement (confirmed 2026-09-18) needs a
"submitted, awaiting a decision" state distinct from "still being written." A
`NewsPostStatus` enum:

- `DRAFT` — being written, not visible anywhere but the author's own admin list.
- `PENDING_REVIEW` — a Comunicador has submitted it; visible to Admin/Superadmin
  in a review queue, not public.
- `PUBLISHED` — live. Reachable directly from `DRAFT` for Admin/Superadmin (they
  don't review their own work — see "Comunicador role" below); reachable from
  `PENDING_REVIEW` only via an Admin/Superadmin approval.
- `REJECTED` — an Admin/Superadmin sent it back, with a `decisionReason` (mirrors
  `EventParticipant.decisionReason`/`decidedAt` — the existing approval-decision
  precedent in this codebase). Editable by the author, who can resubmit
  (`REJECTED` → `PENDING_REVIEW`), same reactivation shape as
  `EventParticipant`'s re-registration flow.
- `PAUSED` (optional, mirrors `EventStatus`) — was live, taken down without
  deleting. Worth including for parity with Events unless there's a reason not to.

`decidedBy` (FK to the deciding admin) + `decidedAt` + `decisionReason` round out
the audit surface for the approval step itself (separate from, but a natural
future candidate for, milestone 2's audit trail).

### Comunicador role

- Add `COMUNICADOR` to the `UserRole` enum (migration).
- Add a `news:manage` permission in `rbac.ts`. `ROLE_PERMISSIONS[COMUNICADOR] =
["admin:access", "news:manage"]` — needs `admin:access` to reach the `/admin`
  shell at all, per the existing middleware gate (`isAdminRole` checks exactly
  that permission). `ADMIN_PERMISSIONS` and `SUPERADMIN_PERMISSIONS` both gain
  `news:manage` too, since the ask is "Comunicador **+ admin and superadmin**"
  can author entries — not a Comunicador-exclusive capability.
- **Nav scoping is the interesting part**: unlike the superadmin-only
  `configNavigation` (shown in full or not at all), a Comunicador should see a
  _reduced_ admin shell — realistically just "Noticias" (and maybe their own
  profile/settings), not the full admin nav (Reservas, Usuarios, Checkin, etc.,
  none of which they have permission for). Two ways to do this in
  `src/components/templates/management/index.tsx`'s existing `navItems` `useMemo`:
  (a) filter `navigation.admin` down to items the role has permission for, and add
  "Noticias" unconditionally when `news:manage` is granted, or (b) branch
  `userType === "admin"` on role and give Comunicador its own short nav array.
  (a) is more consistent with how permissions already gate the config section and
  scales better if more roles show up later.
- `ROLE_LABELS` needs a `COMUNICADOR: "Comunicador"` entry (`src/lib/rbac.ts`), and
  the admin Users page's role-change UI (`src/app/(management)/admin/users/columns.tsx`
  and whatever renders the role `Select`) needs the new option.
- Every other permission check (`reservations:manage`, `checkin:manage`, etc.)
  naturally excludes Comunicador already, since `ROLE_PERMISSIONS` is additive per
  role — no negative-permission logic needed.
- **Approval needs its own permission**: add `news:approve` alongside
  `news:manage`. Comunicador gets only `news:manage` (create/edit their own
  posts, submit for review); Admin and Superadmin get both. The API route
  enforces this — a `PATCH` transitioning a post to `PUBLISHED` or `REJECTED`
  from `PENDING_REVIEW` requires `news:approve`; a Comunicador hitting that
  transition gets a 403, same shape as the existing `requirePermission` pattern.

### Admin authoring UI

- `/admin/news` — paginated list (mirrors `/admin/events`): title, status badge,
  featured indicator, published date, author. Gate on `news:manage` via
  `requirePagePermission`. A Comunicador sees only their own posts; Admin/
  Superadmin see everyone's (mirrors how `/admin/events` is superadmin/admin-wide
  but scoped by author for Comunicador — filter server-side, not client-side, so
  it can't be bypassed).
- `/admin/news/new` and `/admin/news/[id]` — form mirroring `event-form.tsx`
  (minus everything reservation/scheduling-specific): title, slug (auto-derived
  from title, editable), summary, `MarkdownEditor` for body, `ImageUpload` for
  cover, "Destacar" switch + order. The status control differs by permission:
  a Comunicador gets a "Guardar borrador" / "Enviar a revisión" pair (→ `DRAFT` /
  `PENDING_REVIEW`); Admin/Superadmin get the full `Select` including direct
  `PUBLISHED`.
- **Review queue**: `/admin/news?status=PENDING_REVIEW` (or a dedicated
  `/admin/news/review`) for Admin/Superadmin — list of pending posts with an
  approve/reject action, mirroring the existing event-participant decision UI
  (`participants-table.tsx`'s bulk approve/reject bar + confirm dialog, reason
  optional on approve, effectively required on reject).
- `POST/GET/PUT/DELETE /api/admin/news[...]` following the existing
  `requirePermission` + `apiSuccess`/`apiCatch` conventions
  ([[api-error-logging-conventions]]); a separate
  `POST /api/admin/news/[id]/decision` (approve/reject) gated on `news:approve`,
  mirroring `POST /api/admin/events/[id]/participants/decision`.
- Slug uniqueness validation (Zod + a DB uniqueness check, same shape as
  `EventForm.slug`).
- Notification: the author gets an email/notice on approval or rejection (with
  the reason), mirroring `event-decision.ts`'s participant-decision emails —
  worth including for parity, confirm as part of build.

### Public surface

- Rebuild `src/components/templates/landing/news/index.tsx` from scratch as a
  server component: `Breakout` + `Container` + `LANDING_SECTION_BG` striping (matching
  every other landing section — the current stub does none of this), a "featured
  leads, rest follows" grid mirroring `EventsSection`'s pattern, mono kicker
  (`~/ noticias`) per the design system's one-kicker-per-section convention, cards
  using the existing `Card` component (14px radius, hairline border, Observatory
  Blue-tinted hover lift) — not a new card style. Returns `null` when there are no
  published posts, same convention as `EventsSection`.
- Wire it into `src/app/(public)/page.tsx`'s section list (currently missing
  entirely).
- A detail page — `/noticias/[slug]` (confirmed in scope) — for reading the full
  body. This is a **Read**-mode surface (per the design system's mode taxonomy),
  not Persuade: it should prioritize legible long-form typography (`max-w-prose`,
  the existing `body` type scale) over landing-style visual flourish. Reuses
  `Markdown` for rendering. 404s (or redirects) for anything not `PUBLISHED` —
  a `PENDING_REVIEW`/`DRAFT`/`REJECTED` post is never publicly reachable by slug.
- `getPublishedNews()` / `getFeaturedNews()`-style public, auth-free read
  functions (`src/lib/db/news.ts`), same shape as `getUpcomingPublicEvents`.

## Implementation plan

1. Schema + migration: `NewsPost` model (with the `NewsPostStatus` approval state
   machine above), `COMUNICADOR` enum value.
2. `rbac.ts`: `news:manage` + `news:approve` permissions, role wiring,
   `ROLE_LABELS` entry.
3. Nav scoping in `ManagementLayout` for Comunicador (and confirm Admin/Superadmin
   both pick up "Noticias" too).
4. `src/lib/db/news.ts`: admin CRUD queries (paginated list scoped by author for
   Comunicador, get, create, update, delete, decide) + public read queries
   (published, featured-first ordering).
5. `/api/admin/news` routes + `/api/admin/news/[id]/decision`; admin list, form,
   and review-queue pages.
6. Public `NewsSection` rebuild + `/noticias/[slug]` detail page; wire into the
   landing.
7. Role-change UI: add Comunicador to the admin Users role picker.
8. Decision notification email (approve/reject), mirroring `event-decision.ts`.
9. Tests: slug generation/uniqueness, featured-sort ordering (mirror
   `occurrences.test.ts`-style pure-function tests where logic is extractable),
   `rbac.test.ts` additions for the new role/permissions, status-transition
   guards (Comunicador can't self-publish; can't approve their own post even if
   somehow granted `news:approve` — worth an explicit guard, not just relying on
   role separation).
10. Audit trail follow-up: once milestone 2's audit trail expands past its current
    two reference routes, news create/update/decision belongs on that list — not
    blocking this milestone, just noting the connection.

## Resolved (2026-09-18)

- **Detail page**: confirmed in scope — full `/noticias/[slug]`.
- **Comunicador's blast radius**: confirmed — Comunicador-authored posts require
  Admin/Superadmin approval before publishing (`PENDING_REVIEW` → `PUBLISHED`/
  `REJECTED`); Admin/Superadmin publish their own posts directly.

## Open questions (needs a product decision before/while building)

- **Is there a `/noticias` index page** (all published posts, paginated) separate
  from the landing preview section, the way `/admin/events` lists everything
  while the landing only teases upcoming ones? Recommend yes, for the same
  reason a summary-only landing card isn't a dead end. Tracked in
  `docs/OPEN_QUESTIONS.md`.
- **Comments/reactions**: out of scope unless raised — flagging only so it's an
  explicit "not now" rather than an oversight.
- **Can Admin (not just Superadmin) approve Comunicador posts**, or is approval
  Superadmin-only? "Admin/Superadmin" is used above assuming both can approve —
  worth confirming, since it's a one-line permission-grant change either way.
  Tracked in `docs/OPEN_QUESTIONS.md`.
