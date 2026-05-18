# Coworking reservation admin panel — UI/UX specification

## Overview

Admin dashboard for reviewing and managing reservation requests for a coworking space. Users create reservations on shared resources (rooms, desks, phone booths); the admin approves or rejects them based on capacity constraints.

Reservations are made in **15-minute time slots**. The admin needs to quickly identify capacity conflicts and act on pending requests.

---

## Data model (reference)

### Space (resource)

```
{
  id: string,
  name: string,
  capacity: number    // max people allowed simultaneously
}
```

### Reservation

```
{
  id: string,
  spaceId: string,
  startTime: datetime,       // aligned to 15-min intervals
  endTime: datetime,         // aligned to 15-min intervals
  userId: string,
  userName: string,
  description: string,       // reason/purpose for the reservation
  peopleCount: number,       // how many people will use the space
  status: "pending" | "approved" | "rejected",
  createdAt: datetime
}
```

---

## Capacity status system

For each 15-minute time slot within a space, calculate the **total people** across all overlapping reservations (both pending and approved). Then compare against the space's capacity:

| Status       | Condition                              | Color        | Meaning                                                  |
| ------------ | -------------------------------------- | ------------ | -------------------------------------------------------- |
| **Safe**     | `totalPeople / capacity < 0.8`         | Green        | No conflicts, can approve freely                         |
| **Caution**  | `0.8 <= totalPeople / capacity <= 1.0` | Amber/Yellow | Near capacity, approve with care                         |
| **Overload** | `totalPeople / capacity > 1.0`         | Red          | Over capacity, at least one reservation must be rejected |

A reservation's status color is determined by the **worst slot** it covers. If a 1-hour reservation spans 4 slots and 3 are green but 1 is red, the entire reservation block shows as red.

---

## Page layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [← ] Lunes 7 de abril, 2025 [ →]    [Solo pendientes] [Todas] │  ← Toolbar
├────────────┬───────────┬────────────────┬───────────────────────┤
│ Pendientes │ Aprobadas │ Espacios con   │ Pico ocupación        │  ← Metric cards
│     7      │  hoy: 3   │ conflicto: 2   │      120%             │
├────────────┴───────────┴────────────────┴───────────────────────┤
│ 🟢 Seguro   🟡 Precaución (>80%)   🔴 Sobrecarga   🔵 Aprobada │  ← Legend
│ ┈┈ Pendiente (dashed border)                                    │
├─────────────────────────────────────────────────────────────────┤
│                        TIMELINE                                 │
│                                                                 │
│              8:00    9:00    10:00   11:00   12:00   ...        │  ← Time header
│  ┌─────────┐─────────────────────────────────────────           │
│  │Ocupación│ ░░░░░░░▓▓▓▓▓▓████▓▓▓░░░░░░░░░░░░░░░░░            │  ← Heatmap row
│  ├─────────┼─────────────────────────────────────────           │
│  │ Sala A  │    [═══María═══]                                   │
│  │ Cap: 6  │        [═══Carlos═══]                              │  ← Space rows
│  ├─────────┼─────────────────────────────────────────           │
│  │ Sala B  │              [════Pedro════]                       │
│  │ Cap: 10 │                 [══Laura══]                        │
│  ├─────────┼─────────────────────────────────────────           │
│  │Hot desks│ [═══════════Equipo Frontend═══════════]            │
│  │ Cap: 15 │    [════Equipo Data════]                           │
│  └─────────┘─────────────────────────────────────────           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component specifications

### 1. Toolbar

Horizontal bar at the top with:

- **Date navigator**: Left arrow, date label (e.g., "Lunes 7 de abril, 2025"), right arrow. Arrows navigate one day at a time.
- **Filter toggle**: Two buttons — "Solo pendientes" (default active) and "Todas". "Solo pendientes" hides approved/rejected reservations from the timeline. The capacity heatmap always considers all reservations regardless of filter.

### 2. Metric cards

Row of 4 summary cards with:

| Card                   | Value                                                                   | Color                      |
| ---------------------- | ----------------------------------------------------------------------- | -------------------------- |
| Pendientes             | Count of pending reservations for the day                               | Warning/amber              |
| Aprobadas hoy          | Count of approved reservations                                          | Default                    |
| Espacios con conflicto | Count of spaces that have at least one overloaded slot                  | Danger/red                 |
| Pico ocupación         | Highest `totalPeople / capacity` percentage across all spaces and slots | Default (danger if > 100%) |

### 3. Legend

Single row showing all visual encodings:

- Green square + "Seguro"
- Amber square + "Precaución (>80%)"
- Red square + "Sobrecarga"
- Blue square + "Aprobada"
- Dashed border sample + "Pendiente"

### 4. Timeline (main view)

#### 4a. Time header

Horizontal row of hour labels from 8:00 to 20:00 (configurable). Each hour subdivides into 4 slots of 15 minutes. Only hour marks are labeled; individual 15-min slots are delimited by lighter grid lines.

#### 4b. Heatmap summary row

A single condensed row labeled "Ocupación" on the left. Each 15-minute cell is colored based on the **worst status across all spaces** for that slot:

- Transparent = no reservations
- Light green tint = safe
- Amber tint = caution
- Red tint = overload

This gives the admin an at-a-glance scan of the day's trouble spots before looking at individual spaces.

#### 4c. Space rows

One row per space. Each row has:

- **Left label**: Space name + capacity (e.g., "Sala A / Cap: 6")
- **Slots area**: Full-width area where reservation blocks are positioned

**Reservation blocks** are horizontal bars whose:

- **Horizontal position** = start time (left edge aligned to the slot grid)
- **Width** = duration (proportional to number of 15-min slots)
- **Color** = capacity status (green / amber / red for pending; blue for approved)
- **Border style** = dashed for pending, solid for approved
- **Label** = `{userName} · {peopleCount}p` (truncated with ellipsis if the block is too narrow)

**Overlap handling**: When multiple reservations overlap in time within the same space, stack them vertically within the row. Each stacked sub-row is ~32px tall. The space row height grows to accommodate all stacked blocks.

### 5. Detail panel (sidebar)

Triggered by clicking any reservation block. Opens as a **right-side panel** (not a modal) — ~340px wide, full height, with a semi-transparent overlay behind it. The timeline remains visible but dimmed.

Panel contents:

```
┌──────────────────────────────┐
│                          [✕] │
│  Reunión de equipo semanal   │  ← Reservation description as title
│                              │
│  Solicitante                 │
│  María López                 │
│                              │
│  Espacio                     │
│  Sala A (capacidad: 6)       │
│                              │
│  Horario                     │
│  9:00 – 10:30                │
│                              │
│  Personas                    │
│  4                           │
│                              │
│  Estado                      │
│  [Pendiente]                 │  ← Badge
│                              │
│  ┌────────────────────────┐  │
│  │ Reservas superpuestas  │  │
│  │                        │  │
│  │ Carlos Ruiz            │  │
│  │ 9:30 – 11:00 · 3 pers. │  │
│  │ Entrevista candidato   │  │
│  │ [Pendiente]            │  │
│  └────────────────────────┘  │
│                              │
│  [  Aprobar  ] [ Rechazar  ] │  ← Action buttons (only for pending)
└──────────────────────────────┘
```

Key behaviors:

- **Overlapping reservations section**: Shows all other reservations in the same space that overlap in time with the selected one. Each shows user name, time range, people count, description, and status badge. This is critical for the admin to understand the conflict context.
- **Approve**: Changes status to `approved`, refreshes the timeline (colors recalculate), panel stays open with updated info.
- **Reject**: Removes the reservation from the view, closes the panel, refreshes the timeline.
- **Close**: Click the X button or click the overlay behind the panel.

---

## Interaction patterns

### Approve / reject flow

1. Admin scans the heatmap row for red/amber zones
2. Clicks a reservation block in a problem zone
3. Panel opens showing the reservation details + all overlapping reservations
4. Admin reads the descriptions to decide which reservation to keep
5. Admin clicks "Aprobar" or "Rechazar"
6. Timeline and metrics update immediately
7. Admin can click another reservation to continue reviewing

### Bulk actions (future enhancement)

Allow shift-click or checkbox selection of multiple pending reservations to approve/reject them in batch. Show a floating action bar at the bottom with "Aprobar N seleccionadas" / "Rechazar N seleccionadas".

### Filter behavior

- "Solo pendientes": Hides approved reservations from the timeline blocks. The heatmap and capacity calculations still include approved reservations (they contribute to capacity). This is the default mode.
- "Todas": Shows all reservations (pending + approved) on the timeline.

---

## Visual design guidelines

### Colors

Use semantic colors from the design system:

| Element              | Light mode                                    | Dark mode                                      |
| -------------------- | --------------------------------------------- | ---------------------------------------------- |
| Safe reservation     | Green-50 bg, Green-800 text, Green-400 border | Green-800 bg, Green-200 text, Green-600 border |
| Caution reservation  | Amber-50 bg, Amber-800 text, Amber-400 border | Amber-800 bg, Amber-200 text, Amber-600 border |
| Overload reservation | Red-50 bg, Red-800 text, Red-400 border       | Red-800 bg, Red-200 text, Red-600 border       |
| Approved reservation | Blue-50 bg, Blue-800 text, Blue-400 border    | Blue-800 bg, Blue-200 text, Blue-600 border    |
| Pending badge        | Amber-50 bg, Amber-800 text                   | Amber-800 bg, Amber-200 text                   |
| Approved badge       | Green-50 bg, Green-800 text                   | Green-800 bg, Green-200 text                   |

### Typography

- Space names: 13px, weight 500
- Capacity label: 11px, secondary color, weight 400
- Reservation labels: 11px
- Time headers: 11px, secondary color
- Metric values: 22px, weight 500
- Metric labels: 12px, secondary color
- Panel title: 16px, weight 500
- Panel fields: 14px body, 12px labels in secondary color

### Spacing

- Slot width: 16px per 15-minute slot (64px per hour)
- Space label column: 120px fixed width
- Stacked reservation sub-row height: 32px
- Reservation block height: 24px with 4px top offset
- Reservation block border-radius: 4px
- Panel width: 340px

### Borders

- Grid lines between slots: 0.5px, tertiary border color
- Hour marks: 0.5px, secondary border color (slightly more prominent)
- Space row separators: 0.5px, tertiary border color
- Reservation blocks: 0.5px border (dashed for pending, solid for approved)

---

## Responsive considerations

- The timeline should be horizontally scrollable on small screens. The space label column remains fixed/sticky on the left.
- Minimum viewport width for the full layout: ~900px
- On narrow screens, the detail panel could become a bottom sheet instead of a side panel.
- Metric cards can wrap to 2x2 grid on narrow screens.

---

## Accessibility notes

- Reservation status must not rely solely on color. The dashed/solid border distinction and the status badge text in the panel provide non-color alternatives.
- All interactive elements (reservation blocks, buttons, filter toggles) should be keyboard-focusable.
- Reservation blocks should have `aria-label` with the full description: e.g., `"María López, 9:00 to 10:30, 4 people, pending, Reunión de equipo semanal"`.
- The panel should trap focus when open and return focus to the triggering element on close.

---

## Technical notes

- **Capacity calculation is per-slot**: For each 15-min slot, sum `peopleCount` across all overlapping reservations (both pending and approved). Compare against the space's `capacity`.
- **Reservation color assignment**: A reservation's color reflects the worst slot it covers. Iterate all slots the reservation spans, compute the capacity ratio for each, and use the worst one.
- **Overlap stacking**: Use a greedy row-packing algorithm. For each reservation (sorted by start time), find the first sub-row where it doesn't overlap with any existing block. If none, create a new sub-row.
- **Real-time updates**: After an approve/reject action, recalculate all capacity statuses and re-render the affected space row and heatmap. The metrics should also update.
