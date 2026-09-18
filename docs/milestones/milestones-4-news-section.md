# Milestone 4 — "Noticias" news section + Comunicador role

## Use case

La Nube wants a public news/blog section on the landing — announcements, community
updates, event recaps — authored by staff without needing a developer to hardcode
anything. Today there's no way to publish this kind of content at all. The ask adds:

- A public **Noticias** section (landing preview + presumably a place to read a full
  post — see Open Questions on scope).
- A new **Comunicador** role, alongside Admin and Superadmin, that can author and
  manage news entries — a narrower role than Admin, scoped to just this capability.
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
  - Admin list pattern: paginated, newest-first (`listEvents`/`listFormTemplatesPage`
    - the `Pagination` molecule).
      All of the above are directly reusable patterns for `NewsPost` — this is
      substantially "do what Events already does, for a simpler content type."

## What needs building

### Data model

A `NewsPost` model: `id`, `title`, `slug` (unique, for the detail URL), `summary`
(short, plain text, for cards — same role as `Event.summary`), `body` (markdown,
same role as `Event.description`), `coverImageUrl` (optional), `authorId` (FK to
`RegisteredUser` — whoever wrote it, shown as a byline), `status`
(`DRAFT`/`PUBLISHED`, mirroring `EventStatus` minus the states that don't apply
here), `publishedAt` (BigInt ms, set the first time status becomes `PUBLISHED` —
drives "newest first" ordering independent of `createdAt`), `isFeatured` +
`featuredOrder`, `createdAt`/`updatedAt`.

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

### Admin authoring UI

- `/admin/news` — paginated list (mirrors `/admin/events`): title, status badge,
  featured indicator, published date, author. Gate on `news:manage` via
  `requirePagePermission`.
- `/admin/news/new` and `/admin/news/[id]` — form mirroring `event-form.tsx`
  (minus everything reservation/scheduling-specific): title, slug (auto-derived
  from title, editable), summary, `MarkdownEditor` for body, `ImageUpload` for
  cover, status `Select`, "Destacar" switch + order.
- `POST/GET/PUT/DELETE /api/admin/news[...]` following the existing
  `requirePermission` + `apiSuccess`/`apiCatch` conventions
  ([[api-error-logging-conventions]]).
- Slug uniqueness validation (Zod + a DB uniqueness check, same shape as
  `EventForm.slug`).

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
- A detail page — `/noticias/[slug]` — for reading the full body. This is a
  **Read**-mode surface (per the design system's mode taxonomy), not Persuade: it
  should prioritize legible long-form typography (`max-w-prose`, the existing
  `body` type scale) over landing-style visual flourish. Reuses `Markdown` for
  rendering.
- `getPublishedNews()` / `getFeaturedNews()`-style public, auth-free read
  functions (`src/lib/db/news.ts`), same shape as `getUpcomingPublicEvents`.

## Implementation plan

1. Schema + migration: `NewsPost` model, `COMUNICADOR` enum value.
2. `rbac.ts`: `news:manage` permission, role wiring, `ROLE_LABELS` entry.
3. Nav scoping in `ManagementLayout` for Comunicador (and confirm Admin/Superadmin
   both pick up "Noticias" too).
4. `src/lib/db/news.ts`: admin CRUD queries (paginated list, get, create, update,
   delete) + public read queries (published, featured-first ordering).
5. `/api/admin/news` routes; admin list + form pages.
6. Public `NewsSection` rebuild + `/noticias/[slug]` detail page; wire into the
   landing.
7. Role-change UI: add Comunicador to the admin Users role picker.
8. Tests: slug generation/uniqueness, featured-sort ordering (mirror
   `occurrences.test.ts`-style pure-function tests where logic is extractable),
   `rbac.test.ts` additions for the new role/permission.
9. Audit trail follow-up: once milestone 2's audit trail expands past its current
   two reference routes, news create/update/delete/publish belongs on that list —
   not blocking this milestone, just noting the connection.

## Open questions (needs a product decision before/while building)

- **Detail page vs. landing-only**: is a full `/noticias/[slug]` read page wanted,
  or is the ask just "show news cards/blurbs in a landing section" with no deeper
  page (e.g. summary only, or the card links out to an external post)? The message
  says entries should be "shown in that section," which reads as landing-only, but
  a `summary`-only post with no way to read the full `body` feels like a dead end —
  recommend including the detail page unless there's a reason not to.
- **Is there a `/noticias` index page** (all posts, paginated) separate from the
  landing preview section, the way `/admin/events` lists everything while the
  landing only teases upcoming ones? Recommend yes, for the same reason.
- **Comunicador's blast radius**: confirm the role should be able to
  publish/unpublish and feature posts unilaterally (no approval step), or whether
  Comunicador drafts and Admin/Superadmin approves-to-publish (mirroring the
  `Event.requiresApproval` participant pattern). The message doesn't ask for an
  approval step, so I'd default to no-approval-needed, but worth confirming since
  it changes the state machine.
- **Comments/reactions**: out of scope unless raised — flagging only so it's an
  explicit "not now" rather than an oversight.
