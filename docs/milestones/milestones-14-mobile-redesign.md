# Milestone 14 — Mobile redesign

> **Status (2026-10-02): design agreed, ready to implement** — baseline screenshots
> reviewed, per-form proposals decided; implementation tracked in the "Implementation
> hand-off" checklist at the end of this doc. Nothing implemented yet.
>
> **Status (2026-10-01, later): design decisions agreed, scope extended to forms (Part
> B)** — see "Design decisions". Original audit status follows.
>
> **Status (2026-10-01): audit only, nothing implemented.** This doc records findings
> from a mobile walkthrough of the `preview` branch, done at the user's request after
> reporting "can't scroll" on mobile. The real issue, per the user's own diagnosis after
> watching the recording themselves, is **not** a vertical-scroll bug — it's that several
> screens are desktop components squeezed into a narrow viewport, forcing **horizontal**
> scroll (of the whole page, or of a component) on screens that were never laid out for
> that width. Fixing this is a design pass, not a mechanical sweep, so the user
> deliberately asked for it to be picked up by a different model (Opus 5.5, "better at
> design") in a fresh session — **this doc is that session's starting point.** Read it
> fully before touching any of the referenced files; do not assume the fix is obvious
> from the finding alone, several of these have real layout trade-offs (see "Open
> questions for the redesign" at the end).

## Use case

La Nube's management area (booking calendar, admin config tables, admin reservations
timeline) and parts of the public landing need to be usable on a phone. Today they
render, but several widgets were built against implicit desktop assumptions (fixed pixel
widths, a 5-day-wide grid, multi-column tables) and only _partially_ adapt down to phone
width — the breakpoint classes exist in some places, but the components that actually
carry content width don't shrink with them.

## Methodology

- The user recorded their own phone (iOS Safari, a ~390–430pt-wide device judging by the
  video) walking the signed-in app: landing → sign-in → user dashboard → booking
  calendar (Coworking) → admin dashboard → every admin nav section → a markdown editor →
  an event form → back out.
- The recording (`ScreenRecording_10-01-2026 18-43-41_1.MP4`, 1284×2778, ~189s) was not
  watchable directly by this session, so `ffmpeg` (installed via `brew install ffmpeg`
  for this purpose — not previously on the box) was used to extract ~42 scene-change
  frames (`select='gt(scene,0.25)'`), which were then read as images. This gets full
  timeline coverage without hand-scrubbing a 3-minute video, but it's frame sampling, not
  frame-by-frame — a very brief glitch between two sampled frames could be missed.
- **A live mobile viewport test was attempted first and abandoned.** The `claude-in-chrome`
  browser tool in this environment cannot actually produce a narrow viewport: `resize_window`
  reports success but `window.innerWidth` never changes from the desktop window's actual
  width (confirmed by re-reading `window.innerWidth` after the call), and `F12` /
  `Cmd+Shift+M` keystrokes sent through the tool don't reach Chrome's own UI chrome (devtools
  never opened — same confirmation). So every finding below comes from the user's real-device
  recording, not from this session's own interaction with the app. If the next session wants
  to iterate live rather than from static frames, it needs either a real device or a
  differently-configured browser automation setup.
- Every finding below is cross-checked against the actual source (file + line), not just
  inferred from the screenshot, so the next session can jump straight to the code.

## Findings

### 1. Critical — the booking calendar is unusable on mobile (3 of 5 weekdays unreachable)

**`src/components/organisms/calendar/WeekCalendar.tsx:668-669`**

```tsx
<div className="overflow-hidden">
  <div className="min-w-[800px]">
```

The week grid is hard-coded to a 5-weekday-wide, `min-w-[800px]` layout, and the
wrapper clips overflow instead of scrolling it. On a ~420px-wide phone this means **only
the first ~2 weekdays are ever visible or reachable** — Wednesday through Friday are
rendered off-screen and there is no way to pan, swipe, or scroll to them. Confirmed in
the recording at both the user-facing `/user/spaces/coworking` calendar (t≈69–78s, t≈78s)
and it's the same component everywhere it's reused.

This is strictly worse than "unintuitive" — it's a missing feature on mobile: a user
cannot book Wed/Thu/Fri from a phone at all, only Mon/Tue (and whichever two days a
week-nav click happens to land on).

This is also the component this session already touched this conversation (added the
24h minimum-notice rule — `hasMinimumNotice`, `isDayFullyBlocked`, etc.). Any mobile
redesign of this file needs to preserve that logic; it's in the same file, not isolated.

Also note: this component is 1300+ lines, drag-select based, with separate code paths for
mouse (`handleMouseDown`/`handleMouseMove`/`handleMouseUp`), keyboard/touch (the
"Reservar" button per day, added for F2.5a — see milestone-10), and now the minimum-notice
gating. A mobile layout change has to account for all three interaction paths, not just
the visual grid.

### 2. High — admin config tables overflow the viewport; only one of six follows the correct pattern

Six admin list screens render a raw shadcn `<Table>` with 4-6 columns and **no
horizontal-scroll wrapper**, so on mobile the table overflows its card and forces the
**whole page** to scroll sideways to reach the later columns (Acciones, Capacidad,
Prioridad, etc. get clipped at the viewport edge). Confirmed in the recording:

- **Espacios** (`/admin/spaces`) — t≈148s: `CAPAC[idad]` column header clipped at the
  edge; a faint page-level horizontal scrollbar is visible just above the browser chrome.
- **Tipos de reserva** (`/admin/reservation-types`) — t≈159s: `ACCIONES` column clipped,
  same scrollbar.
- **Temas del landing** (`/admin/themes`) — t≈179s: `PRIORI[dad]` column clipped, same
  scrollbar.
- **Recursos** (`/admin/resources`) — t≈151s: `ACCIONES` column sits right at the edge
  (less visible here only because the table was empty).

Source confirms the pattern — grep for `<Table>` across the admin surfaces:

| File                                                                      | Wrapped in `overflow-x-auto`?                        |
| ------------------------------------------------------------------------- | ---------------------------------------------------- |
| `src/components/organisms/admin/config/spaces-manager.tsx:123`            | **No**                                               |
| `src/components/organisms/admin/config/resources-manager.tsx:147`         | **No**                                               |
| `src/components/organisms/admin/config/reservation-types-manager.tsx:149` | **No**                                               |
| `src/components/organisms/admin/config/landing-themes-manager.tsx:208`    | **No**                                               |
| `src/components/organisms/admin/audit-log-table.tsx:43`                   | **No**                                               |
| `src/app/(management)/admin/news/page.tsx:185`                            | **No**                                               |
| `src/components/organisms/admin/config/roles-manager.tsx:168-169`         | **Yes** — `<div className="overflow-x-auto"><Table>` |

`roles-manager.tsx` already does this correctly and is the obvious reference for the
mechanical half of the fix (wrap each in `overflow-x-auto`, matching what `DataTable`
(`src/components/ui/data-table.tsx:33`) already does for Users/Reservations — those two
_are_ horizontally scrollable today, just not very discoverable, see finding 4). But a
wrapper alone only stops the page-level scroll; it doesn't make a 6-column table good on
a phone screen — the Opus session should decide whether these become card lists (like
the Users table arguably should too), priority-column layouts, or stay scrollable tables
with a visible affordance. That's a design call, not made here.

### 3. Medium — admin reservations day-timeline is scrollable but not discoverable

**`src/components/organisms/admin/admin-service-day-timeline.tsx:250`**

```tsx
<div className="w-full min-w-0 overflow-x-auto rounded-md border ...">
  <div className="flex w-max min-w-full flex-col">
```

Unlike finding 1, this one _does_ scroll (`overflow-x-auto` is present) — but it's a
pixel-exact grid (`SLOT_WIDTH_PX` constants) built for a mouse-and-wide-screen timeline,
and on mobile only shows ~3 business hours before the content runs off-screen with **no
visual cue that more exists** (no scrollbar, no fade, no arrow). Confirmed at t≈107s:
the "Coworking" occupancy row shows 08:00–11:00 and nothing hints there's 09:00–18:00 of
real content to the right. A user has to already know to swipe sideways on a chart to
find it.

### 4. Low — Users/Reservations admin lists scroll correctly but are not discoverable either

`src/components/ui/data-table.tsx:33` already wraps in `overflow-x-auto`, so these don't
force page-level scroll — but same discoverability gap as finding 3: no affordance
telling a mobile user the table has more columns than fit. Not confirmed broken in the
recording (the Users list rendered without visibly clipping at t≈98s), but worth the
same design treatment as finding 2 for consistency, since it's the same underlying
"wide desktop table, narrow phone" shape.

### 5. Cosmetic — the mobile nav drawer itself has a persistent horizontal scrollbar

In the `ManagementLayout` mobile sidebar (`src/components/templates/management/index.tsx`,
the `fixed inset-0 z-50 lg:hidden` block around line 314), a thin horizontal scrollbar is
visible at the very bottom of the drawer panel in multiple frames (t≈147s, t≈178s) even
though the drawer is a fixed `w-64` column with no reason to overflow sideways. Something
inside it (likely the "Configuración" submenu's icon+label row, or an SVG with an
explicit width) is a few pixels wider than its container. Low severity — doesn't block
anything — but it's a tell that the redesign pass should check the drawer itself too, not
just the page content.

### Not bugs — confirmed intentional, don't "fix" these

- **Landing "Nuestros miembros" / "Nuestros socios" / "Aliados estratégicos" sections**
  (`src/components/templates/landing/members/index.tsx`,
  `.../partners/index.tsx`, `.../allies/index.tsx`) use the `Marquee` molecule
  (`src/components/molecules/marquee.tsx`) — an auto-scrolling, pause-on-hover logo
  ticker with a fade mask at both edges. What looks in the recording like "cards cut off
  mid-logo" (t≈13s, t≈25-27s) is the marquee's own edge fade + its continuous scroll
  animation caught mid-frame, not a layout bug. It already branches its gradient width by
  `useViewportWidth() < 768`. Leave this alone unless the user specifically asks for the
  marquee treatment itself to change.
- **Markdown editor toolbar** (event/news body editor, t≈112s) wraps its icon buttons
  onto a second row on narrow screens and stays usable — flagged during the audit, not a
  finding.
- **Event form fields, weekday pills, Contacto settings form** — all reflow to
  single-column correctly; nothing to fix there.

## Suggested scope for the redesign session (not a commitment — Opus's call)

Roughly in descending severity/impact, for reference only:

1. **Finding 1 (booking calendar)** is the one real "can't complete a task on mobile"
   bug and probably deserves its own slice given the file's size and three interaction
   paths. Worth deciding up front: does mobile get a fundamentally different view (e.g. a
   single-day-at-a-time view with swipe/tabs between weekdays, or an agenda/list view)
   rather than a shrunk version of the 5-column grid? A shrunk grid at 5 columns on a
   360-420px screen leaves ~70-84px per day column, likely too narrow for the existing
   drag-select interaction regardless of the overflow fix.
2. **Finding 2 (admin tables)** affects 6 screens with the same shape — likely one
   reusable pattern (e.g. a responsive table molecule, or a card-list alternative) applied
   six times, rather than six bespoke fixes.
3. **Findings 3 & 4 (discoverability)** can probably piggyback on whatever visual
   affordance pattern gets picked for finding 2 (e.g. a fade/shadow hint or an explicit
   "scroll for more" cue), rather than being solved separately.
4. **Finding 5 (drawer scrollbar)** is a quick isolated fix, independent of the above.

## Open questions for the redesign

> **Resolved 2026-10-01** — see "Design decisions" below. Kept verbatim for the record.

These are genuine product/design decisions, not implementation details — flagging them
explicitly rather than making the call here, per how this audit was scoped (document
only, no implementation):

- **Booking calendar**: shrink the existing 5-column grid, or replace the mobile view
  with a different interaction model (day-at-a-time, agenda list, etc.)? This changes
  how much of `WeekCalendar.tsx` gets touched — a shrink is additive CSS, a different
  model is close to a parallel implementation sharing the data-fetching/submit logic.
- **Admin tables**: card-list layout (like a lot of the rest of the admin area already
  uses for empty/loading states), a priority-columns pattern (hide less-important columns
  under a breakpoint), or keep scrollable tables and just fix discoverability + the
  page-level overflow? Six screens, so whatever's picked should be one reusable answer.
- **Scroll affordance convention**: if horizontal scroll stays (tables, the admin
  timeline), what's the project's visual language for "there's more this way" — a
  trailing gradient fade (already used by `Marquee`), a shadow, explicit arrow controls?
  Should become a shared pattern rather than one-off per component.

## Additional findings (design session, 2026-10-01)

Found while cross-checking the audit against source, before any implementation:

- **A. Drag-select never worked on touch.** `WeekCalendar` only wires `onMouseDown` /
  `onMouseMove` / `onMouseUp` (~line 818). A touch only synthesizes mouse events on _tap_,
  never a drag — so on a phone the only booking path has always been the per-day
  "Reservar" button. The mobile design is built around **tap**, not drag.
- **B. `min-w-[800px]` also clips on tablets/laptops.** At `lg` (1024px) the desktop
  sidebar takes 256px, leaving ~700px of content — so the week grid clips Friday on an
  iPad landscape too, not only on phones.
- **C. The mobile nav drawer cannot scroll vertically.** Its `<nav>`
  (`templates/management/index.tsx` ~line 336) is `flex-1` with no `overflow-y-auto`; with
  "Configuración" expanded on a short phone, the last items are unreachable. Plausibly part
  of the user's original "can't scroll" report. Also to verify: the sticky header is
  `z-100` while the drawer is `z-50`, so the header may cover the drawer's logo/close row.
- **D. `participants-table.tsx` was missing from the audit's table list** — it uses
  `DataTable`, so it already scrolls (same class as finding 4).

## Design decisions (agreed with the user, 2026-10-01)

### Part A — mobile / tablet

1. **Booking calendar — visible-day count by width:** 1 day `< 640px`, 3 days
   `640–767px`, 5 days `≥ 768px`. Remove `min-w-[800px]` + `overflow-hidden` so the 5-day
   grid fits its container. Extract the day-column body into a `DayColumn` component
   rendered N times; data fetching, submit, the 24h minimum-notice gating and the detail
   dialog stay single-sourced in `WeekCalendar`.
   - Narrow views get a **day strip** (weekday chips; fully-blocked days disabled; a dot on
     days with an own reservation), compact icon-only week nav, default day = today or the
     next bookable day. No swipe gestures (conflict with vertical scroll).
   - **Tap an empty slot → booking form prefilled** with that start time (+1h). Drag stays
     for fine pointers. "Reservar este día" remains for the whole-day case.
   - **The booking form opens as a bottom drawer on mobile** (`ui/drawer.tsx`, vaul) — the
     user preferred drawer over dialog.
   - Agenda/list view was considered and rejected: booking is "find a free slot", which
     needs the time axis.
2. **Admin tables — table ≥ `md`, card list below.** One column-driven component, built
   into `DataTable` via TanStack column `meta` (`mobile: "title" | "meta" | "badge" |
"actions" | "hidden"`). The six hand-rolled tables (spaces, resources, reservation types,
   themes, audit, news) migrate onto `DataTable`. Priority-columns was rejected: the
   "secondary" columns (capacity, priority, state) are often what the admin came to check.
   Admins _will_ use these on phones (user confirmed).
3. **The admin reservations Gantt timeline (`admin-service-day-timeline.tsx`) is out of
   scope — do not touch it.** User's call: it works today for approve/reject, and changing
   it needs its own careful design. Findings 3's affordance/scroll-to-now ideas are dropped.
4. **Nav drawer:** rebuild on `ui/sheet.tsx` (focus trap, Esc, body scroll lock), nav gets
   `overflow-y-auto overflow-x-hidden` (fixes finding 5 + finding C).
5. **Verification:** a Playwright script (repo's own `playwright` + cached Chromium) signs
   in as seed users and captures every route at phone 390px / tablet 820px / desktop
   1440px, light + dark on phone, and flags page-level horizontal overflow automatically
   (elements whose right edge passes the viewport, outside any scrolling ancestor). Used for
   a baseline and for before/after on every slice — the browser-extension viewport problem
   from the audit doesn't apply to headless Playwright.

### Part B — forms (all viewports)

Added to this milestone at the user's request: forms (HTML forms, not the Forms feature)
should not be crammed into modals, and their layout should be reorganized for UX.

1. **Dialog vs page rule:** a form stays in a dialog only if it has **≤ ~4 simple fields,
   fits a phone screen without scrolling, and has no rich editors / nested pickers**;
   otherwise it gets its own page. (The user confirmed this is what they meant.) Any dialog
   that remains renders as a **bottom drawer below `md`** via one shared responsive-dialog
   component.
   - → page: **landing theme** (`/admin/themes/new`, `/[id]/edit`), **role**
     (`/admin/roles/new`, `/[id]/edit`, permissions grouped by area).
   - stays dialog/drawer: resource, reservation type, booking, reject reason, decision
     confirm, deletes.
2. **Event sessions:** an event can have a very large number of sessions (e.g. every
   weekday for 6 months), so the sessions list gets **pagination (preferred)** and may also
   get its own screen — the two are not exclusive. Exact shape TBD after the form
   screenshot review; the staging model (actions committed with the event save, keyed by
   weekday + nominal date) must be preserved.
3. **Ordering:** remove numeric "Orden" / "Prioridad" / "Orden entre destacados" fields
   from forms (too technical, confusing). Ordering moves to the **list**, as
   **drag-and-drop behind an explicit "Reordenar" mode** (to avoid accidental drags): in
   reorder mode each row shows a **grip handle (dots) at the end of the row** used to drag
   (Spotify-playlist style); outside it, rows are static. Replaces the up/down arrows in
   Espacios. Needs keyboard support (a DnD lib with a keyboard sensor, e.g. `@dnd-kit`) —
   not yet a dependency.
4. **Form conventions** (to apply to every page form):
   - Titled **sections** with a one-line description (e.g. event: Información / Agenda /
     Inscripción / Publicación).
   - Content entities (event, news, space) use **main column + aside** on desktop (the news
     form already does this); the aside stacks below on mobile.
   - **Sticky save bar** (Guardar / Cancelar) on long forms + an **unsaved-changes guard**
     — neither exists anywhere today.
   - **Right control per data type.** Known mismatches: themes' "Desde/Hasta (MM-DD)" typed
     as text (→ month+day picker); public form's native `type="time"` (→ the shared 15-min
     time select); numeric order fields (→ point 3).
   - Pair fields side-by-side only when semantically paired (start/end, first/last name);
     width proportional to content; "(opcional)" as the single optional-field marker.
   - **No multi-step wizards** — admins edit back and forth; sections + a jump index on
     desktop instead.
   - Not an issue (checked): inputs are already 16px on mobile (`text-base md:text-sm`), so
     iOS Safari doesn't zoom on focus.
5. **Per-form proposals** (field order, grouping, controls) are written after the baseline
   screenshot review and reviewed with the user before implementation.

### Slice order

1. Screenshot script + baseline (forms + tables, all viewports).
2. Quick wins: nav drawer (Sheet + scroll + z-index/contrast, H), drop the calendar's
   `min-w-[800px]`, shared responsive dialog/drawer, hide the WhatsApp button in management
   (I), KPI 2×2 grid (J), audit chip labels (L), dashboard time format (N), `Markdown`
   word-break (O).
3. Calendar 1/3/5-day views + tap-to-book + drawer booking form + open on the first
   bookable week/day (F) + touch-aware hint copy (G).
4. Responsive `DataTable` (cards on mobile) + migrate the six tables + reorder mode.
5. Form conventions applied to existing page forms.
6. Theme + role forms → pages; event sessions pagination / screen.

## Baseline screenshot review (2026-10-01)

Captured with the Playwright script (36 screens × phone-light / phone-dark / tablet /
desktop; script + PNGs live in the session scratchpad, not the repo). Seed users `u1` /
`sa1`. The dev server in Docker needed a warm-up pass (first compile of a route took
10–60s and the container restarted once mid-run), so the script warms every route first
and waits for skeletons/spinners to disappear before capturing.

### Automatic overflow check (phone, 390px) — page-level horizontal scroll confirmed on

| Screen                                    | Page width | Notes                                               |
| ----------------------------------------- | ---------- | --------------------------------------------------- |
| `/admin/spaces`                           | 648px      | finding 2                                           |
| `/admin/themes`                           | 642px      | finding 2                                           |
| `/admin/news`                             | 635px      | finding 2                                           |
| `/admin/reports`                          | 628px      | **new** — the reports table, missing from the audit |
| `/admin/reservation-types`                | 436px      | finding 2                                           |
| booking dialog (`/user/spaces/coworking`) | 768px      | **new** — the dialog itself is wider than the phone |

`/admin/resources` didn't trip it only because its table was empty. A side effect worth
knowing: when the page is wider than the viewport, **dialogs center on the wider page and
render cut off on the right** (theme + reservation-type dialogs) — fixing the tables also
fixes those dialogs.

### New findings from the screenshots

- **E. Booking calendar on a phone, confirmed:** only Mon/Tue visible **and the week nav
  (Anterior/Hoy/Siguiente) is clipped too**, so the user can't even move to another week.
  On tablet (820px) Friday and "Siguiente" are clipped as well (finding B).
- **F. The calendar opens on a fully blocked week from Thursday afternoon on.** With the 24h
  minimum notice, on Thursday evening every remaining weekday is blocked, so the default
  week is entirely hatched with no "Reservar" button anywhere. → Open on the **first week
  that has a bookable day** (and, in the narrow views, on the first bookable day).
- **G. Copy:** "Haz clic y arrastra para reservar" is wrong on touch → adapt per pointer
  type ("Tocá un horario libre para reservar").
- **H. Nav drawer, confirmed broken:** the sticky header (`z-100`) paints over the drawer
  (`z-50`) — the drawer's logo + close button are hidden, the hamburger stays on top — and
  the translucent `glass-sidebar` panel over the gray overlay makes inactive items
  gray-on-gray (near-unreadable).
- **I. WhatsApp floating button on management pages** covers form fields (event
  "Resumen" editor, settings inputs) and table rows on phones. It's a public-site contact
  affordance; hide it inside the management area (or at least on form pages).
- **J. KPI stat cards stack full-width on phones** — user dashboard, admin dashboard,
  check-in and users each spend the entire first screen on 4 numbers. → One shared stat-grid
  pattern: 2×2 compact tiles below `md`.
- **K. Admin events list on phones:** every card leads with a tall cover image (mostly the
  gradient placeholder), so each event is ~one full screen; the card footer actions are
  unlabeled icons. → compact row/card with a small thumbnail on phones, labeled actions (or
  an overflow menu).
- **L. Audit log filter chips show raw entity names in English** ("NewsPost",
  "RegisteredUser", "Reservation", "Space") — need Spanish labels. On phones only
  Fecha/Tags are visible; Autor/Resumen (the useful part) are off-screen → card layout.
- **M. Roles table** already has `overflow-x-auto` and still clips mid-word ("PERMISO…")
  — confirms a wrapper alone isn't enough; cards on phones.
- **N. User dashboard "Reservas recientes" time format bug**
  (`user/dashboard/page.tsx:127-130`): renders "13/10/2026 -10:00:00 a01:00:00" —
  JSX whitespace glues "-"/"a" to the values, and `toLocaleTimeString()` adds seconds and
  follows the browser's 12/24h convention. Should use the project's date formatting
  (`HH:mm`, "10:00 a 13:00").
- **O. `Markdown` doesn't break long words** — an unbroken string in an event description
  runs past the public form card. Add `break-words` (`overflow-wrap: anywhere`) to the
  `Markdown` molecule; real long URLs would do the same.
- **P. Reservation-types list shows the internal `code`** ("CONFERENCE") — same "too
  technical" category as the order fields; hide it from the list.

### Fine as-is (checked, don't redesign)

- Contacto (`/admin/site`) — already sectioned with sub-headings; the reference for others.
- User settings, sign-in, sign-up — reflow correctly (sign-up's DNI/Institución pair is a
  little tight at 390px; stack below `sm`).
- Admin dashboard "Reservas recientes" accordion — works on phones (just the KPI issue J).

## Per-form proposals (for review — not yet agreed)

Conventions from "Part B" apply to all (sections, sticky save bar, unsaved-changes guard,
no numeric order fields, drawer below `md` for any remaining dialog).

1. **Event form** (`event-form.tsx`, page). Today: ~20 fields in one flat column; widths
   are arbitrary (capacity "200" spans ~1100px on desktop while Tipo/Recurso are tiny);
   publication controls are interleaved with scheduling ones; the action buttons only exist
   at the very bottom.
   - **Main column:**
     - _Información_ — Nombre; Resumen (short, card blurb) **before** Descripción (long);
       Descripción; Imagen.
     - _Agenda_ — Tipo de evento + Recurso (paired, equal width); Fechas (range picker,
       content-width); Días de la semana; Horario as one row "10:00 → 13:00" (two narrow
       selects); **Sesiones** inline summary ("24 sesiones · 2 canceladas · 1
       reprogramada") + "Gestionar sesiones" → paginated list (decision Part B.2).
     - _Inscripción_ — Formulario; ventana de inscripción (the two date-time pickers,
       paired); Cupo (narrow number); Requiere aprobación.
   - **Aside (sticky on `lg`):** _Publicación_ — Estado, Destacar, link de inscripción
     (copy), Participantes (n); at the bottom, a separated _Zona de peligro_ with
     "Cancelar evento".
   - On phones the aside stacks **last** (user's call, 2026-10-02).
2. **News form** (`news-form.tsx`, page). Already main + "Publicación" card. Changes: the
   Publicación card becomes a sticky aside on `lg`; Slug auto-derived from the title with
   an "Editar" affordance (it's technical; most authors never need to touch it); remove
   "Orden entre destacadas" (→ reorder); sticky save bar (today Cancelar/Guardar/Despublicar
   are only at the very end).
3. **Space form** (`space-form.tsx`, page). Already sectioned into cards; good base.
   Changes: the Reservable/Exclusivo/Destacado switches move to an aside ("Comportamiento");
   Slug moves under a collapsed "Avanzado"; FAQ items collapse to their question (expand to
   edit) and reorder with the shared reorder mode; list order via reorder mode (replaces the
   up/down arrows).
4. **Landing theme** → **page** (`/admin/themes/new`, `/[id]/edit`). Sections: _Básico_
   (Nombre, Habilitado) · _Cuándo_ ("Se repite todos los años" → **month + day range
   picker** instead of typed "MM-DD" text; otherwise the date-range picker) · _Efecto_
   (effect, emojis + cantidad shown only when relevant) · _Texto_ (línea sobre el título,
   palabras). **Prioridad** disappears: list order = priority (top wins), via reorder mode
   — the list header should say so in one line.
5. **Role** → **page** (`/admin/roles/new`, `/[id]/edit`). Nombre + Descripción, then
   Permisos grouped by area (the groups already exist) in two columns on desktop, then
   "Puede otorgar estos roles". The list becomes cards on phones (M).
6. **Reservation type** — stays a dialog/drawer; only "Nombre" remains (Orden → reorder
   mode; code hidden, P).
7. **Resource** — stays a dialog/drawer (Nombre, Nº de serie). No change beyond the drawer.
8. **Booking** — drawer on phones (decided). Inside: Horario as one row "09:00 → 10:00"
   with a duration hint ("1 h"), Tipo, Motivo. Prefilled from the tapped slot.
9. **Form template builder** (`form-template-builder.tsx`, `/admin/forms/[id]`). Each field
   is a tall always-expanded card (3 fields ≈ 2 phone screens). → Fields render
   **collapsed** (label + type chip + "Obligatorio" badge) and expand one at a time to edit;
   the per-field up/down arrows are replaced by the shared reorder mode.
10. **Public registration form** — native `type="time"` → the shared 15-min time select;
    `Markdown` word-breaking (O).
11. **User settings / Contacto / auth** — no structural change (see "fine as-is").

### Open questions for the user

> **Answered 2026-10-02** — see "Decisions on the per-form proposals" below.

- Event form on phones: Publicación block first or last?
- Featured ordering (events/news): with the numeric "orden entre destacados" removed,
  where does the user reorder featured items? Proposal: a "Reordenar destacados" action on
  the Events / News lists that opens the reorder mode filtered to featured items.
- Slug fields (news, space): OK to auto-derive + tuck behind "Editar"/"Avanzado"?

### Decisions on the per-form proposals (user, 2026-10-02)

- **Event form on phones:** the Publicación aside stacks **last**.
- **Featured ordering:** "Reordenar destacados" on the Events and News lists, opening the
  same drag-and-drop reorder mode (filtered to featured items). This _is_ the drag-and-drop
  idea from Part B.3 — one reorder mechanism for every ordered list.
- **Slugs (news, space): auto-derived, never typed.** The user doesn't see value in
  hand-written slugs. Design note (Claude): keep them **human-readable** (slugified from the
  title/name), not UUIDs — they're in public URLs (`/news/yyyy/mm/dd/<slug>`,
  `/user/spaces/<slug>`) where readable links help sharing/SEO. Derive on **create** and
  keep them **stable afterwards** (renaming must not silently break shared links); the
  field moves behind "Avanzado" (space) / "Editar" (news) for the rare manual fix.
  Collisions get a numeric suffix (`-2`).
- **First implementation slice:** the quick wins (slice 2) — approved.

## Implementation hand-off (2026-10-02)

The design is **agreed**; implementation runs in a fresh session driven by `/loop`
(the user is away, so the session works autonomously). Ground rules for that session:

- **Commits (changed by the user when launching the run):** commit per item, **unsigned**
  (`git -c commit.gpgsign=false`), never push; the user rebases + signs after review. The
  unrelated pre-existing uncommitted work was committed first on its own
  (`chore: trabajo previo sin commitear …`) so every milestone-14 commit holds only its item.
- **Tracking:** the checklist below is the source of truth. Tick items as they land
  (`[x]`) and add a one-line note (files touched, anything deferred). Keep every other doc
  this touches in sync in the same pass (CLAUDE.md conventions, README index).
- **Blockers:** anything that needs a user decision or can't be done goes to
  `docs/milestones/milestones-14-BLOCKERS.md` (create on first blocker; one entry per
  blocker: what, why, what was tried, what's needed). When a blocker is resolved its
  entry is removed; the file is deleted once empty. Never stop the whole run for one
  blocker — skip that item and continue with the next independent one.
- **Verification per slice:** `npm test`, `npx tsc --noEmit`, `npm run lint`,
  `npm run format:check`, plus before/after screenshots with
  `node scripts/mobile-shots.mjs <slice-name> [filter]` (output in gitignored
  `.mobile-shots/`; the agreed baseline is `.mobile-shots/baseline/`). A slice is done
  only when the overflow report is clean for the screens it touches.
- **Don't:** touch the admin reservations Gantt (`admin-service-day-timeline.tsx`); touch
  non-`lanube-*` Docker containers; change the DB schema (no slice needs it:
  order/priority columns stay and are written by the reorder UI).
- **Conventions that apply:** shadcn Form + RHF + Zod for every form; code comments/JSDoc
  in Spanish and generous; design tokens (no raw palette classes without `dark:`); every
  new admin mutating route calls `recordAudit` with a registered `AUDIT_ACTIONS` id
  (enforced by `src/lib/audit/actions.test.ts`) and `requirePermission`; new routes get
  breadcrumb labels in `management-crumbs.ts`; `graphify update .` after code changes.
- **New dependency:** `@dnd-kit/core` + `@dnd-kit/sortable` (approved: drag-and-drop
  reorder). `node_modules` is a Docker volume, so after `npm install` on the host also run
  `docker exec lanube-app npm install` and `docker restart lanube-app`.
- **Dev server is slow on first compile** (10–60s per route in Docker); the screenshot
  script warms routes first. If the container stops responding, `docker restart
lanube-app` (this repo's container only).

### Checklist

**Slice 2 — quick wins**

- [x] Nav drawer rebuilt on `ui/sheet.tsx`: header no longer covers it, readable contrast,
      `overflow-y-auto overflow-x-hidden` nav (findings 5, C, H).
      — `templates/management/index.tsx` (Sheet at `z-[120]`, solid `bg-background`),
      `ui/sheet.tsx` (new `overlayClassName` prop), `scripts/mobile-shots.mjs` (new
      `admin-drawer` shot with Configuración expanded).
- [x] Shared responsive dialog: Dialog ≥ `md`, bottom Drawer below; migrate every
      remaining form dialog (resource, reservation type, reject reason, decision confirm,
      deletes, booking).
      — new `molecules/responsive-dialog.tsx` (same API as `ui/dialog`, `ResponsiveDialog*`;
      drawer body scrolls, footer sticky) + `hooks/use-media-query.ts`. Migrated every dialog
      in: admin dashboard + reservations approve confirm, participants decision, news
      row-actions + news form (reject/delete), event form (drop-warning confirms), resources,
      reservation types, spaces, themes, roles managers, `WeekCalendar` (booking + detail).
      Left as `Dialog` on purpose: `event-sessions.tsx` (replaced in slice 5),
      `form-picker.tsx` (searchable picker), `ui/command.tsx`, the non-functional incidents
      page. The booking drawer is only verifiable on a phone after slice 3 (the calendar's
      `min-w-[800px]` still widens the page).
- [x] WhatsApp floating button hidden inside the management area (I).
      — `molecules/whatsapp-float-button.tsx` is now a client component that returns `null`
      under `/admin` and `/user` (verified: present on `/`, absent on `/user/dashboard` and
      `/admin/site`). Still shown on public pages, auth pages and `/forms`.
- [x] Shared KPI stat grid, 2×2 compact below `md` (user/admin dashboard, check-in, users) (J).
      — new `molecules/stat-grid.tsx` (`StatGrid`, `StatTile` with tones that carry their
      own `dark:` variants, `StatGridSkeleton`); applied to `user/dashboard`,
      `admin/dashboard`, `admin/checkin` (its "Actualizado" tile now `HH:mm`, 24h), `admin/users`
      (descriptions only from `md`).
- [x] Audit filter chips + entity names in Spanish (L).
      — `admin/audit/page.tsx`: chips use `entityTypeLabel()` (same Spanish label as each
      row's tag), sorted by label; the URL filter keeps the internal model name. Row tags
      were already Spanish; the raw names only remain in the row's "Información del sistema"
      (intentionally technical). The phone card layout for the audit table is slice 4.
- [x] User dashboard "Reservas recientes" time format `dd/MM/yyyy · HH:mm a HH:mm` (N).
      — `user/dashboard/page.tsx`: `formatReservationWhen()` (24h via `formatTimeShort`);
      the hand-rolled status switch replaced by the shared `StatusBadge` (also fixes
      CANCELLED rendering as "Rechazada").
- [x] `Markdown` molecule breaks long words (O).
      — `molecules/markdown.tsx`: `[overflow-wrap:anywhere]` (only breaks inside a word when
      it doesn't fit) + GFM tables scroll inside their own block. Verified on the public form
      (the long test word now wraps inside the card).

**Slice 3 — booking calendar**

- [x] Extract `DayColumn`; visible days 1 (`<640`) / 3 (`640–767`) / 5 (`≥768`); remove
      `min-w-[800px]` + `overflow-hidden` (findings 1, B, E).
      — new `calendar/calendar-utils.ts` (+ `.test.ts`: `visibleDayIndices`,
      `firstBookableDayIndex`, …) and `calendar/DayColumn.tsx` (`DayColumn`,
      `DayHeaderCell`, `OccurrenceBlock`); `WeekCalendar` keeps data/submit/24h gating/detail
      dialog. Grid columns = visible days (`repeat(n, minmax(0,1fr))`). Drag now listens to
      pointer events but only acts on `pointerType === "mouse"`. Verified phone (1 day),
      tablet (5 days, Friday + "Siguiente" no longer clipped), and the phone booking drawer
      deferred from slice 2.
- [x] Narrow views: day strip (chips, blocked days disabled, dot for own reservations),
      compact icon nav; no swipe.
      — `DayStrip` in `DayColumn.tsx`; icon-only prev/next with aria-labels + short range
      ("5 – 9 oct 2026"). The focused day starts on the week's first bookable day (part of F).
- [x] Tap empty slot → booking drawer prefilled (start = slot, +1h); drag kept for fine
      pointers (finding A); "Reservar este día" kept.
      — `WeekCalendar` tap handlers (pointerdown/up with a 10px slop so a scroll isn't a tap;
      start = tapped 15-min slot rounded down; end = +1h capped at closing and at the next
      busy block; busy / <24h taps toast instead). New `calendar/BookingForm.tsx` (+ test):
      shadcn Form + RHF + Zod, one "Horario 14:15 → 15:15 · 1 h" row, Tipo, Motivo, sticky
      `ResponsiveDialogFooter` (proposal 8); the dead `isWholeDay` state was dropped.
      Verified with Playwright: touch tap at 14:20 opens the drawer with 14:15 → 15:15, and a
      desktop mouse drag 10:00→11:00 still opens the dialog with 10:00 → 11:00
      (`.mobile-shots/s3-tap/tap-drawer.png`).
- [x] Open on the first week / day with a bookable slot (F); touch-aware hint copy (G).
      — `calendar-utils.ts`: `getCurrentWorkWeekStart` (moved out of `WeekCalendar`) +
      `firstBookableWeekStart` (next week when every day of the current one is <24h away;
      tested). Opens there and "Hoy" goes there; the forward limit stays anchored to the
      current work week + 1, so skipping a blocked week doesn't extend the booking horizon.
      The focused day was already the first bookable one (previous item).
      `templates/user/calendar-template-client.tsx`: hint is "Tocá un horario libre para
      reservar" under `(pointer: coarse)`, else the old drag copy (verified in Playwright with
      a touch context; SSR renders the desktop copy and it swaps after hydration).
- [x] 24h minimum-notice gating and the detail dialog unchanged (regression-check).
      — Playwright with `serverNowMs` rewritten to Sun 4 Oct 20:00 ART: Monday's chip is
      disabled ("sin turnos disponibles") and the view opens on Tuesday; next week, tapping
      own reservation (Tue 13) opens "Detalle de la reserva" (Horario / Motivo / Estado /
      Eliminar) as a drawer (`.mobile-shots/s3-regression/`). The logic itself is unit-tested
      in `calendar-utils.test.ts`; `hasMinimumNotice` still guards drag-start, tap and submit.
      Not touched (pre-existing): the detail shows the raw status ("PENDING").

**Slice 4 — tables + reorder**

- [x] `DataTable` renders cards below `md` from column `meta` (`title|meta|badge|actions|hidden`).
      — `ui/data-table.tsx`: `ColumnMeta` augmented with `mobile` (+ `leading` for selection
      checkboxes) and `label` (card "Etiqueta: valor" text; participants already used it);
      `DataTableCards` chosen via `useMediaQuery` so row controls aren't duplicated in the DOM.
      Annotated `admin/users/columns.tsx` (Nombre+Apellido title, Estado badge) and
      `participants-table.tsx` (checkbox leading, Email title, Estado badge). Users verified on
      phone (`.mobile-shots/s4-cards/`); the participants sample event has no registrations.
- [x] Migrate spaces, resources, reservation types, themes, audit, news, roles, reports
      table(s) onto it; hide reservation-type `code` (P). Overflow report clean on all.
      — `useStaticTable()` helper + `onRowClick` (keyboard-operable rows/cards) in
      `ui/data-table.tsx`. Migrated: spaces/resources/reservation-types/landing-themes/roles
      managers (card headers also stack below `sm`), `audit-log-table.tsx` (summary as card
      title, clamped to 3 lines; row opens the detail sheet), news (new client
      `organisms/admin/news-admin-table.tsx`; the page passes serializable rows), reports
      (`PerResourceTable` + `DurationTable` in `templates/admin/report`). Spaces' slug and
      order arrows are hidden on cards (order moves to reorder mode next). Overflow report
      clean on all 8 screens × 4 viewports (`.mobile-shots/s4-tables/`).
- [x] Shared reorder mode: "Reordenar" button → grip handle at row end, drag-and-drop
      (`@dnd-kit`, keyboard sensor), Guardar/Cancelar; persists via an audited bulk-reorder
      endpoint per entity. Applies to spaces, reservation types, themes (order = priority,
      one-line note in the list header), featured events, featured news.
      — deps `@dnd-kit/core|sortable|utilities`; `molecules/reorder-list.tsx` (mouse, touch
      with 150ms hold, keyboard + Spanish screen-reader announcements; save disabled until
      dirty). Endpoints (all `requirePermission` + `recordAudit`, `entityId: "*"`):
      existing `spaces/reorder`, new `reservation-types/reorder`, `themes/reorder`
      (priority = n-1-index; `listLandingThemes` now sorts by priority so the list IS the
      priority), `events/featured-order` + `news/featured-order` (GET + POST; news needs
      `news:approve`). New audit actions `reservationType.reorder`, `landingTheme.reorder`,
      `event.featuredReorder`, `news.featuredReorder`; schema `lib/schemas/reorder.ts` (+test).
      UI: "Reordenar" in the spaces / reservation-types / themes managers (spaces' up/down
      arrows and the Orden/Prioridad columns removed), `FeaturedReorderButton` on the Events
      and News lists. Verified: keyboard reorder of spaces persisted + audited, then
      restored; featured dialogs load (seed has <2 featured items, so they show the empty
      message) — `.mobile-shots/s4-reorder/`.
- [x] Remove numeric Orden / Prioridad / Orden entre destacados(as) fields from all forms.
      — fields removed from the reservation-type, theme, event and news forms (and the
      space form's hidden `displayOrder`). Schemas keep them `.optional()` (old clients);
      writes ignore them on edit so a form save can never clobber a "Reordenar" order:
      `toSpaceData` drops `displayOrder`, `updateReservationType` writes only `name` and new
      types append at the end, theme `toWriteData` only writes `priority` if sent, event/news
      updates pass `featuredOrder: undefined` (Prisma no-op), `eventToFormDefaults` no longer
      returns it. Also: `DataTable` cards with only title + actions render the actions inline.
- [ ] Admin events list compact cards on phones with labeled actions (K).

**Slice 5 — form conventions on existing page forms**

- [ ] Shared form building blocks: `FormSection` (title + description), main+aside page
      layout (aside sticky on `lg`, stacks last on phones), sticky save bar, unsaved-changes
      guard (`beforeunload` + in-app navigation).
- [ ] Event form per proposal 1 (sessions summary + paginated sessions list replacing the
      dialog — keep the staging model: actions commit with the event save).
- [ ] News form per proposal 2 (slug auto-derived on create, stable, behind "Editar").
- [ ] Space form per proposal 3 (slug auto-derived on create, stable, behind "Avanzado";
      collapsible FAQ items with reorder mode).
- [ ] Form template builder per proposal 9 (collapsed fields, reorder mode).
- [ ] Public registration form: shared 15-min time select instead of native `time`.
- [ ] Sign-up: stack DNI/Institución below `sm`.

**Slice 6 — dialogs → pages**

- [ ] Landing theme → `/admin/themes/new` + `/[id]/edit` per proposal 4 (month+day range
      picker for yearly windows); middleware/nav/breadcrumbs updated.
- [ ] Role → `/admin/roles/new` + `/[id]/edit` per proposal 5; same wiring.

**Close-out**

- [ ] Full screenshot run; compare against `.mobile-shots/baseline/`; overflow report
      clean on every screen.
- [ ] Status line + README index updated; CLAUDE.md gains the new conventions (responsive
      dialog, reorder mode, form layout, stat grid, mobile screenshot script).
- [ ] `milestones-14-BLOCKERS.md` deleted if empty; final summary lists what's done, what's
      partial, and every open blocker.
