# Events Landing Rework & Event Detail Page

**Date:** 2026-07-03  
**Branch:** GITHUB-33  
**Scope:** Replace the landing events carousel with a paginated responsive grid, add an `/events/[id]` public detail page with a full session agenda.

---

## Goals

1. Give every event a permanent public URL (`/events/[id]`) showing full info + agenda, always accessible regardless of registration state.
2. Replace the landing carousel with a paginated grid that adapts to viewport width (max 2 rows) and signals events with modified sessions via an asterisk.

---

## 1. Data Layer (`src/lib/db/events.ts`)

### `getUpcomingPublicEventsPage(page, pageSize)`

Paginated replacement for `getUpcomingPublicEvents`. Same filter (PUBLISHED, not deleted, last occurrence in the future), same ordering (newest `startTime` first). Returns:

```ts
{ events: UpcomingEventCard[], total: number, page: number, pageSize: number }
```

Each `UpcomingEventCard` gains one new field:

```ts
hasExceptions: boolean; // true if any ReservationException exists on the event's reservations
```

Derived via a sub-count on `reservation_exceptions` joined through `reservations` where `reservable_type = 'EVENT' AND reservable_id = event.id`. Any exception (cancelled or rescheduled, any date) qualifies.

### `getPublicEventDetail(id)`

Fetches a single event for the public detail page. Returns `null` when the event does not exist, is not PUBLISHED, or has `deletedAt` set.

Includes:

- All scalar event fields
- `resource { name, type }`
- `form { slug, isPublished, opensAt, closesAt }` (for registration CTA)
- All `reservations` with their `exceptions` (for agenda expansion)
- Participant count for capacity/full check (same as `getUpcomingPublicEvents`)

### `expandAllEventOccurrences(reservations)`

Thin wrapper around the existing `expandEventOccurrences` in `src/lib/events/occurrences.ts` that drops the `nowMs` future-only filter — returning every occurrence from `startMs` through `recurrenceEndMs`, past and future. The return type is the same `EventOccurrence[]`.

---

## 2. Public API Route

**`GET /api/events`** — new file at `src/app/api/events/route.ts`.

- No authentication required.
- Query params: `page` (integer ≥ 1, default 1), `pageSize` (integer 1–16, default 6).
- Calls `getUpcomingPublicEventsPage(page, pageSize)`.
- Returns `{ events, total, page, pageSize }` as JSON.
- Invalid params fall back to defaults (no 400 error).

Follows the same no-auth pattern as `/api/forms/[slug]` and `/api/resources/[type]`.

---

## 3. Landing Grid (replaces carousel)

### `EventsSection` (server component — `src/components/templates/landing/events/index.tsx`)

Fetches the first page with SSR default `pageSize = 6` and passes `{ initialEvents, initialTotal }` to `EventsGrid`. The section still returns `null` when `initialTotal === 0`.

### `EventsGrid` (new client component — `src/components/templates/landing/events/events-grid.tsx`)

Replaces `EventsCarousel` (which is deleted).

**Responsive grid layout:**

```
grid-cols-1          (< 640px  → 1 col → pageSize 2)
sm:grid-cols-2       (640–1023px → 2 cols → pageSize 4)
lg:grid-cols-3       (1024–1279px → 3 cols → pageSize 6)
xl:grid-cols-4       (≥ 1280px → 4 cols → pageSize 8)
```

Gap: `gap-6`. No row-count CSS enforcement — page size naturally fills 2 rows.

**Page size detection on mount:**
Reads `window.innerWidth` and maps to column count using the breakpoints above. Computes `pageSize = cols × 2`. If this differs from the SSR default (6), refetches page 1 with the correct size before rendering.

**Pagination:**
Prev / Next buttons below the grid. Prev hidden on page 1; Next hidden when `page * pageSize >= total`. Fetches from `/api/events?page=N&pageSize=M`.

**Asterisk badge:**
Cards with `hasExceptions: true` get a small `*` chip on their cover image (top-right corner), styled consistently with the existing event-type chip (top-left).

**Footnote:**
A single line below the grid, shown only when at least one visible card has `hasExceptions: true`:

> `* Este evento tiene sesiones reprogramadas o canceladas.`

### `EventCard` updates (`src/components/templates/landing/events/event-card.tsx`)

- The entire `<article>` becomes a `<Link href="/events/[id]">` wrapper (whole card clickable → detail page).
- The inner "Inscribirme" `<Button asChild>` retains its `href="/forms/[slug]"` and uses `onClick={e => e.stopPropagation()}` (or the existing `asChild` Link pattern) so it navigates directly to the form without triggering the card link.
- Accepts the new `hasExceptions` prop to conditionally render the asterisk badge.

---

## 4. Event Detail Page

**Route:** `src/app/(public)/events/[id]/page.tsx`

Server component. Calls `getPublicEventDetail(id)`. If `null`, calls `notFound()` (standard Next.js 404 page).

### Layout (single column, `max-w-2xl` centered, within the existing `(public)` layout)

1. **`EventHero`** — reuses existing component: optional cover image, event name (h1), markdown description.

2. **Meta row** — event type chip + `MapPin` resource name + weekday badges. Pulled from existing `eventTypeLabel` / `WEEKDAY_SHORT_LABELS` constants.

3. **Registration CTA** — reuses `RegistrationCta` logic (currently in `event-card.tsx`, to be extracted to a shared molecule so both the card and detail page use it):
   - `open`: "Inscribirme" button → `/forms/[slug]` + closes-on date
   - `upcoming`: disabled + opens-on date
   - `closed` / `none`: quiet note

4. **Agenda section** — heading "Sesiones". Calls `expandAllEventOccurrences()` with the event's reservations. Renders a chronological list:

   | State             | Visual treatment                                                                  |
   | ----------------- | --------------------------------------------------------------------------------- |
   | Scheduled, future | Normal text                                                                       |
   | Scheduled, past   | `text-muted-foreground opacity-60`                                                |
   | Next upcoming     | Subtle left-border accent (highlight so users can find "what's next")             |
   | Cancelled         | Strikethrough date/time + red "Cancelada" badge + reason (if present)             |
   | Rescheduled       | New date/time + amber "Reprogramada" badge + reason; original time struck through |

   Date/time formatting: client-side via a `LocalDateTime` component (analogous to the existing `LocalDate` / `LocalDateRange` molecules), formatting `startMs`/`endMs` in the viewer's locale.

---

## 5. New `LocalDateTime` molecule

`src/components/molecules/local-date.tsx` gains a `LocalDateTime` export that formats a single `ms` timestamp as a full date + time string in the viewer's locale (e.g., `"lun. 7 jul. 2026, 18:00"`). Follows the same `"use client"` + `useMemo` pattern as `LocalDate`.

---

## Files Changed / Created

| Action    | Path                                                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Modified  | `src/lib/db/events.ts` — add `getUpcomingPublicEventsPage`, `getPublicEventDetail`; extend `UpcomingEventCard` with `hasExceptions` |
| Modified  | `src/lib/events/occurrences.ts` — add `expandAllEventOccurrences`                                                                   |
| Created   | `src/app/api/events/route.ts`                                                                                                       |
| Created   | `src/app/(public)/events/[id]/page.tsx`                                                                                             |
| Modified  | `src/components/templates/landing/events/index.tsx`                                                                                 |
| Created   | `src/components/templates/landing/events/events-grid.tsx`                                                                           |
| Deleted   | `src/components/templates/landing/events/events-carousel.tsx`                                                                       |
| Modified  | `src/components/templates/landing/events/event-card.tsx`                                                                            |
| Modified  | `src/components/molecules/local-date.tsx` — add `LocalDateTime`                                                                     |
| Modified  | `src/components/organisms/forms/event-hero.tsx` — no change needed (already shared)                                                 |
| Extracted | `RegistrationCta` from `event-card.tsx` → `src/components/molecules/registration-cta.tsx`                                           |

---

## Out of Scope

- No changes to admin event management pages.
- No changes to `/forms/[slug]` or form submission flow.
- No SEO metadata (og:image, etc.) for the detail page in this iteration.
- No deep-link from the agenda row to the edit form.
