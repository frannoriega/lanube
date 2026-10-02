# Milestone 11 — UI navigation & consistency

**Status:** Implemented on branch `preview` (2026-09-24).
**Kind:** Quality milestone, like milestone 10 — no new domain capability, no schema
change. It closes a set of "the app doesn't behave the way a web app is supposed to"
gaps reported directly from walking the UI.

## Use case

Two classes of problem, both reported by the operator from the running app:

1. **You can get stuck.** A management page reached by drilling in (edit a Noticia, see an
   event's participants) offered no way back to the list it came from; the sidebar doesn't
   highlight on a detail page, so there was also no "where am I". Signing out dropped you
   on the public landing with no obvious route back in. The sign-in page — which is
   directly linkable and is where a confirmation email sends you — had no way out to the
   site at all, and its logo wasn't clickable.
2. **Visible inconsistency.** Landing event cards in the same row rendered at different
   heights; a news article was a single lonely column with no path to any other article;
   the focus ring on every input read as a thick solid border rather than a focus halo;
   cover images were optional, so cards fell back to a placeholder whenever an author
   skipped one.

## What was built

### 1. Equal-height landing cards

`LandingCard` was `flex w-full flex-col` with **no height**, so inside the events rail
(a flex track whose cells already stretch) each card sized to its own content and the
CTAs didn't line up.

- `h-full` on the `LandingCard` article + explicit `items-stretch` on the rail track.
- The card body already had `flex-1` and `mt-auto` on the CTA block, so the extra height
  becomes whitespace above the button and every CTA sits on the same baseline.
- Because the fix is in the shared `LandingCard`, it also corrects the spaces, news and
  about grids. **Dismissed:** giving the rail a fixed `h-[420px]`. It matches the
  screenshot but breaks the moment a summary wraps to a third line or a translation gets
  longer — "height of the biggest one, dynamic" is what flex stretch already does for
  free, once the child stops opting out of it.

### 2. Noticia detail layout

> **Nota (milestone 15, 2026-10-02):** el layout de dos columnas se mantiene, pero la
> tira de autor separada y las `NewsCard` completas del riel fueron reemplazadas: el byline
> ahora vive dentro del encabezado del artículo y el riel usa filas compactas
> (`NewsRailItem`). Ver [`milestones-15-news-redesign.md`](./milestones-15-news-redesign.md).

`/news/[yyyy]/[mm]/[dd]/[slug]` went from a single centered article to the requested
two-column layout:

- Left: an **author strip** (initials chip + byline + publish date) above the article card
  (cover, title, markdown body).
- Right: a sticky **"Otras noticias"** aside stacking up to four `NewsCard`s.
- New query `getOtherPublishedNews(excludeSlug, limit)` — featured first, then
  newest-published, i.e. the same ordering as the index, so the sidebar never contradicts
  the list.
- **When there is nothing else published the whole second column disappears** (the grid
  drops to one column and the article runs full width), as specified — rather than
  rendering an empty rail or a "no hay más noticias" placeholder.

`max-w-prose` was dropped from the body wrapper: the grid column is now the measure, and
keeping both made the text column absurdly narrow beside the sidebar.

### 3. Cover images are required

`coverImageUrl` (`newsPostInputSchema`) and `imageUrl` (`eventInputSchema`) are now
non-empty required strings with Spanish messages; form defaults moved from `null` to `""`,
`ImageUpload`'s `onChange` maps its `null` back to `""`, and the event field lost its
"(opcional)" label.

**Decision: validate at the schema, not in the database.** The DB columns stay nullable
and the cover-less fallbacks in `EventCover` / `NewsCard` stay in place, because rows
created before this change legitimately have no image. A `NOT NULL` migration would need a
backfill with some invented placeholder image, which is worse than letting old rows keep
rendering their icon fallback. `eventToFormDefaults` maps a null column to `""`, so
**editing a legacy row surfaces the validation error** instead of silently re-saving
without a cover — the rule applies on the next write, which is the point.

### 4. Focus rings

Every component in `src/components/ui/` paired `focus-visible:border-ring` with
`focus-visible:ring-ring` at **full opacity**. The 3px ring and the border then merge into
one solid navy band that reads as a heavy border, not a focus indicator — most obvious on
the auth inputs, which sit on a light background with a `bg-slate-200` fill.

Swept all 14 affected components to shadcn's own `ring-ring/50` convention: input,
textarea, select, checkbox, radio-group, switch, button, badge, toggle, tabs, accordion,
calendar, dialog, sheet.

The `--ring` **token is unchanged**, so `src/lib/contrast.test.ts` still passes. Opacity
was the bug, not the colour — lightening the token would have weakened the contrast
assertion for no reason.

### 5. `/noticias` → `/news`

Public URLs are English (`/spaces`, `/events`, `/forms`); Noticias was the odd one out.
The route folder moved and every internal reference followed (`nav.ts`, `newsDetailPath`,
the news filters' `router.push`, the admin form's slug preview, the landing section link).

**Two permanent redirects** were added in `next.config.ts` — `/noticias` and
`/noticias/:path*` — alongside the existing `/services` → `/spaces`. Article URLs carry a
dated sub-path and are meant to be shared, so they have to keep resolving. UI copy stays
Spanish: the nav item is still "Noticias".

### 6. Management navigation — breadcrumbs

**The decision the operator asked for: breadcrumbs, not a back button.** Reasons:

- The section reaches four levels (`/admin/events/[id]/participants`), where "back" is
  genuinely ambiguous — from Participantes you might want the event or the events list.
- No sidebar item highlights on a detail page, so there was no "where am I" either; a
  trail answers both questions with one element.
- A back button has to be placed by each page, which is exactly the per-page opt-in that
  let these pages ship without navigation in the first place.

Implementation deliberately puts **zero burden on the page**:

- `managementCrumbs(pathname, userType, spaceNav)` in
  `src/lib/constants/management-crumbs.ts` is a pure function — trivially unit-tested
  (`management-crumbs.test.ts`, 7 cases).
- `ManagementBreadcrumbs` (molecule) calls it with `usePathname()`; `ManagementLayout`
  renders it above `{children}`, so **every current and future management page is
  covered** without touching the page.
- Dynamic segments are never shown raw. A segment with no entry in `SEGMENT_LABELS` is
  treated as an id and labelled with the action ("Editar"); a test asserts the cuid2
  doesn't appear in the output. The one exception is `/user/spaces/[slug]`, where
  `spaceNav` already carries the space's real display name.
- `SECTION_LEAF_LABELS` handles Spanish gender — "Nueva" under Noticias, "Nuevo" under
  Eventos.
- `NON_NAVIGABLE` marks a path that is a real URL segment but has no page (`/user/spaces`
  is a grouping prefix only), so its crumb renders as text instead of a dead link.
- `/admin/spaces/[id]/edit` would read "… / Editar / Editar"; the duplicate-name collapse
  handles it.
- On the dashboards themselves the component returns `null` — a one-item trail is noise.
- Below `sm` the trail is replaced by a single explicit back arrow to the nearest linked
  ancestor, where a full trail wouldn't fit.

**Three ad-hoc back controls were removed** now that they'd be duplicates: "Volver a
espacios" on both spaces pages, and the "Volver" button sitting in the participants page's
action bar next to "Descargar CSV".

### 7. Logo links & sign-out destination

- The logo now links to `/` in the public header (desktop and mobile drawer) and in both
  management sidebars. It already did in the `/forms` shell — that was the convention the
  rest of the app wasn't following.
- The sign-in card's logo links home too, plus an explicit **"Volver al inicio"** above
  the card. Explicit _and_ logo because this page is reachable directly (confirmation
  emails, a shared link, signing out) so `history.back()` isn't reliably available.
- `signOut({ callbackUrl: "/auth/signin" })` instead of `"/"`. Signing out is nearly
  always "I'm done" or "wrong account", and both want the login form next.

The auth pages keep **no dark-mode variants**, per the operator's instruction — the
milestone-10 item "auth pages have no `dark:` classes" is therefore **closed as
won't-fix**, not deferred. New auth markup in this milestone is light-only on purpose and
matches the page's existing hardcoded palette (`text-blue-900`, `bg-slate-200`).

## Files touched

| Area            | File                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card height     | `templates/landing/shared/landing-card.tsx`, `templates/landing/events/events-rail.tsx`                                                                 |
| Noticia layout  | `app/(public)/news/[yyyy]/[mm]/[dd]/[slug]/page.tsx`, `lib/db/news.ts`                                                                                  |
| Required cover  | `lib/schemas/news.ts`, `lib/schemas/events.ts`, `organisms/admin/{news,event}-form.tsx`, `lib/db/events.ts`                                             |
| Focus rings     | `components/ui/*.tsx` (14 files)                                                                                                                        |
| Route rename    | `app/(public)/news/**`, `next.config.ts`, `lib/constants/nav.ts`, `lib/news/url.ts`, `templates/landing/news/*`                                         |
| Breadcrumbs     | `lib/constants/management-crumbs.ts` (+ test), `molecules/management-breadcrumbs.tsx`, `components/ui/breadcrumb.tsx`, `templates/management/index.tsx` |
| Logo / sign-out | `layouts/public-layout/header/{index,mobile/index}.tsx`, `app/(management)/auth/signin/page.tsx`, `molecules/user-profile/index.tsx`                    |

## Verification

`npx tsc --noEmit`, `npx eslint src`, `npm run format:check`, `npm test` (232 tests,
7 of them new) and `npm run build:next` all pass. The redirect was checked live against
the dev server: `/noticias` → 308 → `/news`, `/news` → 200.

Browser verification via the Chrome extension was **not** performed — the extension is
turned off in this environment. The layout changes are therefore verified by build and
static reading, not by screenshot.

## Not done / follow-ups

- **The sign-in page still has no dark mode** — closed as won't-fix by instruction, see
  above. `docs/OPEN_QUESTIONS.md` should no longer list it as pending design work.
- **Breadcrumbs show a generic "Editar" rather than the entity's name.** Showing
  "Editar · Charla de blockchain" would need each server page to pass its title down
  through a context. Worth doing if the generic label proves ambiguous in use; it is
  deliberately not speculative work now.
- **`NewsPost` has no `NOT NULL` on `coverImageUrl`** (see decision above). If every
  legacy row ever gets a cover backfilled, the migration becomes safe and worth adding.
