# Milestone 1 — Admin reservations browsing: window, pagination, "All spaces" filter

## Use case

Admin staff process reservations from two places: the admin dashboard
("Reservas recientes" card) and the full admin reservations page
(`/admin/reservations`). Both currently hard-code a lookahead of **two
calendar weeks** and force the admin to pick a single space before seeing
anything.

As La Nube adds more spaces and reservation volume grows, two weeks won't be
enough to triage a backlog, and admins shouldn't have to click through every
space one at a time to get a sense of what's pending. The ask:

- Both surfaces should show **upcoming reservations for an arbitrary window**
  (configurable, not hard-coded to 14 days), rendered **paginated** instead of
  "load everything in range and hope it's small."
- Filtering by a single space should stay available, but the list should
  default to **"All"** (every space at once), with per-space as an explicit
  narrowing, not the default the admin has to change every time.

## Current state (as of this doc)

- `AdminReservationsCardsPanel` (`src/components/templates/admin/admin-reservations-cards-panel.tsx`)
  is the shared component behind both surfaces:
  - `variant="dashboard"` (used by `dashboard-recent-reservations.tsx` on
    `/admin/dashboard`): fetches `adminTwoCalendarWeeksRange(now)` — hard-coded
    two-week window, no navigation, no pagination.
  - `variant="admin"` (used by `_reservations-page-content.tsx` on
    `/admin/reservations`): fetches **one ISO week at a time**, with prev/next
    week buttons (can't go before the current week). Also not paginated —
    a week's full reservation set is fetched and grouped client-side.
  - Both variants require a single `spaceId` — there is no multi-space or
    "all" mode in the UI. `AdminResourceTypeCombobox` only lists individual
    spaces (from `useSpaceOptions()` → `GET /api/spaces`).
- **The backend already supports most of what's needed** — this is mostly a
  frontend gap:
  - `GET /api/admin/reservations` (`src/app/api/admin/reservations/route.ts`)
    already accepts:
    - `allServices=1` → `listAdminReservationsAllServicesByRange` /
      `listAllAdminReservationsAllServicesInDateRange`
      (`src/lib/db/adminReservations.ts`) instead of the single-space query.
    - `forwardWindow=<days>` (1–31, defaults to
      `ADMIN_RESERVATION_FORWARD_DAYS`) as an alternative to explicit
      `startDate`/`endDate`.
    - `page` + `pageSize` (`pageSize` capped at `MAX_PAGE_SIZE = 100`) → returns
      `{ items, total }` instead of the grouped-by-date shape.
    - `status` filter (`PENDING`/`APPROVED`/`REJECTED`).
  - None of this (`allServices`, `forwardWindow` beyond the fixed 14-day
    range, `page`/`pageSize`) is wired up from the client: `useAdminReservationsRange`
    (`src/hooks/api.ts`) only ever calls it with `service` + explicit
    `startDate`/`endDate`, no `page`/`pageSize`, no `allServices`.
  - `ADMIN_RESERVATION_FORWARD_DAYS` is only consumed server-side as a
    fallback default; the admin-facing "window size" isn't a concept in the
    UI at all today.

## What needs building

1. **"All spaces" as a first-class, default filter.**
   - `AdminResourceTypeCombobox` (or the call sites) needs an "All" option
     that isn't just "pick the first space in the list" — it's a distinct
     state that maps to `allServices=1` server-side.
   - Default state on both the dashboard card and `/admin/reservations`
     becomes "All", not `spaceOptions[0]?.id`.
   - When "All" is selected, reservation cards need to show which space each
     reservation belongs to (today the panel assumes a single known
     `spaceName` — `DayReservationCard` / `AdminReservationDetailSheet` will
     need a per-item space label instead of one shared heading).
   - The `?service=` URL param on `/admin/reservations` becomes optional;
     absent/`all` means "All spaces" (keep it linkable/bookmarkable).

2. **Replace the fixed window with a real "upcoming, paginated" view.**
   - Move off `adminTwoCalendarWeeksRange` / one-week-at-a-time browsing as
     the only modes. Both surfaces should fetch by **forward window from
     today** (reusing the existing `forwardWindow` query param) with the
     window length being an actual setting, not a hard-coded 14.
   - Switch the client to the **paginated** query shape (`page`/`pageSize`)
     instead of the grouped `itemsByDate` shape, since "days with reservations
     in range" doesn't scale as a fetch-everything-then-group strategy once
     the window grows.
   - Add pagination controls (reuse the existing `Pagination` molecule used
     by the admin Events/Forms lists — see `listEvents`/`listFormTemplatesPage`
     pattern in `CLAUDE.md`) to both the dashboard card and the admin page.
   - Decide default window length (e.g. 14 days, same as today) and whether
     it's admin-configurable per view (query param, remembered per-admin) or
     a fixed app-wide constant editable only by superadmin site-config. Needs
     a decision — see Open Questions.
   - The admin page's current "one calendar week, can't go before this week"
     browsing model and the dashboard's "this week + next" framing both go
     away in favor of one consistent "upcoming reservations, N per page"
     model. Confirm whether admins still want to jump to a specific week/date,
     or whether pagination through the upcoming list is sufficient — if date
     jump is still wanted, it can coexist as an optional `startDate` override
     on top of the same paginated endpoint.

3. **Space filter stays, narrows from "All".**
   - Keep per-space filtering as an explicit choice (existing combobox), now
     just not pre-selected.

## Implementation plan

1. **Data layer** — mostly already there:
   - Confirm `listAdminReservationsAllServicesByRange` returns enough space
     identity per row (space id + name) for "All" rendering; add the field if
     missing.
   - Decide on and, if needed, add a `windowDays` (or reuse `forwardWindow`)
     concept that's explicit end-to-end rather than an implicit fallback
     constant.
2. **API** — `src/app/api/admin/reservations/route.ts` already accepts the
   needed params; no new endpoint should be required. Audit it once the
   client shape is settled — e.g. confirm `allServices` + `page`/`pageSize`
   - `forwardWindow` all compose correctly together (today they're each
     tested more in isolation).
3. **Hooks** — extend/replace `useAdminReservationsRange` with a paginated
   variant (e.g. `useAdminReservationsPage`) that takes
   `{ spaceId: string | "all", forwardWindowDays, page, pageSize, status? }`
   and returns `{ items, total }`.
4. **Components**:
   - `AdminResourceTypeCombobox`: add an "All" entry (or a sibling toggle).
   - `AdminReservationsCardsPanel`: replace the week-grouped
     accordion-by-date rendering with a paginated list (still groupable by
     date visually if desired, but driven by page/pageSize, not "fetch whole
     week/fortnight"). Show per-space label on each card when in "All" mode.
   - `dashboard-recent-reservations.tsx` and `_reservations-page-content.tsx`:
     default to "All", pass through the new pagination state, keep the
     existing approve/reject flow (`onAction`, `reviewAdminReservation`)
     unchanged.
   - Reuse the existing `Pagination` molecule (see Events/Forms admin lists)
     for consistency rather than building a new one.
5. **Cleanup**: once nothing depends on `adminTwoCalendarWeeksRange` /
   single-week browsing helpers in `src/lib/admin/admin-timezone.ts`, remove
   the now-dead helpers (`adminTwoCalendarWeeksRange`,
   `startOfIsoWeekDateKey`/`endOfIsoWeekDateKey` if unused elsewhere — check
   first, `WeekCalendar.tsx` and other callers may still need them).
6. **Tests**: cover the "All" aggregation path and pagination edge cases
   (empty page, last page, window boundary) — likely as unit tests on the
   `adminReservations.ts` query helpers plus a light integration check on the
   route.

## Open questions (needs a product decision before/while building)

- Is the forward window a fixed app constant, a per-view query param the
  admin can change ad hoc, or a superadmin-configurable site setting?
- Does the admin page still need "jump to an arbitrary past/future week", or
  is "paginate through the upcoming list" the whole interaction now? (Note:
  today the admin page can't go before the current week at all — pagination
  should be at least as capable.)
- In "All spaces" mode, should PENDING reservations surface first regardless
  of date, or should the list stay strictly date-ordered with status as a
  filter (as it is today)?
