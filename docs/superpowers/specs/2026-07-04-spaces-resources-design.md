# Spaces & Resources Redesign

**Date:** 2026-07-04
**Status:** Approved

## Summary

Introduce a `Space` model as the single source of truth for all physical spaces at La Nube — both reservable (coworking, lab, auditorium, meeting room) and informational-only (kitchen, garden, etc.). Remove the hardcoded `ResourceType` enum from the entire stack in favour of this dynamic, DB-driven approach. Redesign the landing "Services" section as a dynamic "Spaces" section rendered via SSR.

---

## 1. Data Model

### New `Space` model (`prisma/models/resources.prisma`)

| Field                | Type                  | Notes                                                    |
| -------------------- | --------------------- | -------------------------------------------------------- |
| `id`                 | `String` (cuid)       | PK                                                       |
| `name`               | `String`              | Display name                                             |
| `slug`               | `String` (unique)     | URL segment, e.g. `coworking`, `meeting-room`            |
| `description`        | `String`              | Markdown, min content expected                           |
| `imageUrl`           | `String?`             | Storage path (existing `/images/services/*.jpg` pattern) |
| `iconName`           | `String?`             | Lucide icon name as string, e.g. `"Building2"`           |
| `isReservable`       | `Boolean`             | Whether bookings can be made for this space              |
| `isFeatured`         | `Boolean`             | Renders as wide card on landing (Auditorio pattern)      |
| `displayOrder`       | `Int`                 | Ascending sort order for landing cards                   |
| `metadata`           | `Json?`               | `SpaceMetadataItem[]` — see below                        |
| `fungibleResourceId` | `String?` (unique FK) | Links to `FungibleResource` when `isReservable = true`   |
| `createdAt`          | `BigInt`              | Standard pattern                                         |
| `updatedAt`          | `BigInt`              | Standard pattern                                         |

`FungibleResource` gets a back-relation: `space Space?`.

### Metadata JSON schema

Stored as a `Json` array, typed at the application layer:

```ts
type SpaceMetadataItem =
  | { type: "stat"; label: string; value: string }
  | { type: "fraction"; label: string; numerator: number; denominator: number };
```

Examples:

- `{ type: 'stat',     label: 'Capacidad',   value: '50 personas' }`
- `{ type: 'fraction', label: 'Escritorios', numerator: 8, denominator: 10 }`

### `Resource` model changes

- `type` field removed.
- `resource_types` enum removed from `enums.prisma` and the DB.

---

## 2. DB Query & Booking URL

### `src/lib/db/spaces.ts` (new file)

```ts
export async function getPublicSpaces() {
  return prisma.space.findMany({
    orderBy: { displayOrder: "asc" },
    include: { fungibleResource: true },
  });
}
```

### Routing convention (no `bookingPath` field needed)

- **Reservable spaces:** CTA links to `/user/[space.slug]`. The slug matches the existing route segment by convention (`coworking` → `/user/coworking`, `meeting-room` → `/user/meeting-room`).
- **Non-reservable spaces:** CTA links to `/spaces/[space.slug]` (detail page, TBD in a future feature).

### Icon helper

`getServiceIcon` and `getServiceName` (switch statements in `services.ts`) are removed. A new helper replaces them:

```ts
// src/lib/constants/spaces.ts (replaces services.ts icon/name helpers)
function getSpaceIcon(iconName: string): LucideIcon { ... }
```

The static `services` array in `services.ts` is deleted entirely.

---

## 3. ResourceType Removal — Blast Radius

All changes are in scope for this feature.

### Schema

- Drop `Resource.type` column.
- Drop `resource_types` enum.

### SQL functions

`get_unavailable_slots(p_resource_type resource_types, p_start bigint, p_end bigint)` → `get_unavailable_slots(p_fungible_resource_id text, p_start bigint, p_end bigint)`. The inner join filters on `fungible_resource_id` instead of `type`. All other SQL functions that reference `resource_types` or `type` on `resources` must be updated similarly.

### API

`GET /api/resources/[type]` → `GET /api/resources/[fungibleResourceId]`. The route param becomes the `FungibleResource` id. Booking pages look up their `Space` first (by URL slug), obtain `fungibleResourceId`, and pass it to this endpoint.

### User booking pages

`/user/coworking`, `/user/lab`, `/user/auditorium`, `/user/meeting-room` — each page currently identifies itself by a `ResourceType` constant. After: each page uses its URL slug to look up its `Space`, gets `fungibleResourceId`, and passes that to availability/reservation APIs.

### Admin pages

Any label that currently reads `ResourceType` is replaced with `FungibleResource.name` or `Space.name`.

### Constants

`src/lib/constants/services.ts` — deleted entirely. The static `services` array and the `getServiceIcon`/`getServiceName` helpers are its only exports; all are replaced by `src/lib/constants/spaces.ts` and DB-driven Space data.

---

## 4. Landing Section

### File changes

`src/components/templates/landing/services/` → renamed to `spaces/`.

### Component

`SpacesSection` is an `async` Server Component (same pattern as `EventsSection`). It calls `getPublicSpaces()` and returns `null` when the result is empty.

### Card layout

- **Regular spaces:** 3-column grid, reuses `LandingCard` shell.
- **Featured space** (`isFeatured: true`): full-width horizontal card (preserves current Auditorio layout).

### Each card renders

- Cover: `imageUrl` as image if set; fallback branded gradient + `iconName` icon.
- Space name.
- Description excerpt (truncated to ~2 lines).
- Metadata chips: stat → `"label: value"`, fraction → `"label: numerator/denominator"`.
- CTA: reservable → "Reservar" → `/user/[slug]`; non-reservable → "Ver más" → `/spaces/[slug]`.

---

## 5. Seed

`prisma/seed.ts` is updated to create `Space` records for all four existing reservable spaces (coworking, lab, auditorium, meeting room), referencing their `FungibleResource` ids and including images pointing to the existing `/images/services/*.jpg` paths, descriptions (markdown), and metadata chips. Non-reservable spaces (kitchen, garden, etc.) may be added as needed.

---

## 6. Migration

A single hand-written migration (`20260704000000_spaces_resource_type_removal`):

1. Create `spaces` table with all fields above.
2. Drop `type` column from `resources`.
3. Drop `resource_types` enum.
4. Update SQL functions (`get_unavailable_slots` and any others referencing `type`/`resource_types`) to use `fungible_resource_id`.

---

## Out of scope

- Admin UI for managing spaces (future feature).
- Space detail page at `/spaces/[slug]` (future feature).
- Dynamic metadata values (all metadata is static, seeded).
