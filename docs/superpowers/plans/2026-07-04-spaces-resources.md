# Spaces & Resources Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `Space` model as the single source of truth for all physical spaces, remove `ResourceType` from the entire stack, and make the landing Spaces section SSR-driven from the DB.

**Architecture:** A new `Space` Prisma model holds name, slug, description (markdown), imageUrl, iconName, isReservable, isFeatured, displayOrder, metadata (JSON), and an optional FK to `FungibleResource`. All SQL functions previously parameterised by `resource_types` enum are rewritten to use `fungible_resource_id text`. Booking pages become Server Components that look up their Space by slug; the landing section becomes async SSR.

**Tech Stack:** Next.js 15 App Router, Prisma v7, PostgreSQL 17, TailwindCSS v4, Lucide React icons

## Global Constraints

- Timestamps: `BigInt` ms in DB, convert at boundaries (`dateToUnixMs` / `unixMsToDate`)
- DB IDs: CUID2 (`@paralleldrive/cuid2`)
- Imports: absolute (`@/...`)
- No `ResourceType` enum anywhere in code after this feature lands
- Spec: `docs/superpowers/specs/2026-07-04-spaces-resources-design.md`
- Run `npm run lint && npm run format:check` before each commit
- Tests: `npm test` after tasks that touch tested files

---

## File Map

**Created:**

- `prisma/migrations/20260704000000_spaces_resource_type_removal/migration.sql`
- `src/lib/types/spaces.ts`
- `src/lib/constants/spaces.ts`
- `src/lib/db/spaces.ts`
- `src/app/api/resources/[fungibleResourceId]/route.ts`
- `src/components/templates/landing/spaces/index.tsx`
- `src/components/templates/landing/spaces/space-card/index.tsx`

**Deleted:**

- `src/lib/constants/services.ts`
- `src/lib/admin/admin-resource-service-slug.ts`
- `src/app/api/resources/[type]/route.ts`
- `src/components/templates/landing/services/index.tsx`
- `src/components/templates/landing/services/service-card/index.tsx`

**Modified:**

- `prisma/models/resources.prisma`
- `prisma/models/enums.prisma`
- `prisma/seed.ts`
- `src/lib/db/reservations.ts`
- `src/lib/db/resourceCalendar.ts`
- `src/lib/db/adminReservations.ts`
- `src/lib/db/adminReports.ts`
- `src/lib/db/events.ts`
- `src/app/api/admin/reservations/route.ts`
- `src/app/api/admin/reservations/days/route.ts`
- `src/components/templates/user/calendar-template-client.tsx`
- `src/app/(management)/user/coworking/page.tsx`
- `src/app/(management)/user/lab/page.tsx`
- `src/app/(management)/user/auditorium/page.tsx`
- `src/app/(management)/user/meeting-room/page.tsx`
- `src/components/molecules/admin-resource-type-combobox.tsx`
- `src/components/templates/admin/dashboard-recent-reservations.tsx`
- `src/components/templates/admin/admin-reservations-cards-panel.tsx`
- `src/components/organisms/admin/admin-service-day-timeline.tsx`
- `src/components/organisms/admin/event-filters.tsx`
- `src/app/(management)/admin/reservations/page.tsx`
- `src/app/(management)/admin/events/page.tsx`
- `src/app/(management)/admin/dashboard/page.tsx`
- `src/types/prisma.ts`
- `src/lib/admin/admin-timeline.test.ts`
- `src/app/(public)/page.tsx`

---

### Task 1: Prisma schema + migration

**Files:**

- Modify: `prisma/models/resources.prisma`
- Modify: `prisma/models/enums.prisma`
- Create: `prisma/migrations/20260704000000_spaces_resource_type_removal/migration.sql`

**Interfaces:**

- Produces: `Space` Prisma model, no `ResourceType` enum, no `Resource.type` field, updated SQL functions (`create_reservation`, `get_unavailable_slots`, `get_user_next_reservations`) that take `_fungible_resource_id text` instead of `_resource_type resource_types`

- [ ] **Step 1: Update `prisma/models/enums.prisma`**

Remove the entire `ResourceType` enum block:

```prisma
// DELETE this block:
enum ResourceType {
  MEETING
  AUDITORIUM
  COWORKING
  LAB

  @@map("resource_types")
}
```

- [ ] **Step 2: Update `prisma/models/resources.prisma`**

Remove `type` from `Resource` and add `Space` model + back-relation:

```prisma
model FungibleResource {
  id          String     @id @default(cuid())
  name        String
  capacity    Int
  isExclusive Boolean    @default(false) @map("is_exclusive")
  createdAt   BigInt     @default(dbgenerated("((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)")) @map("created_at")
  updatedAt   BigInt     @default(dbgenerated("((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)")) @map("updated_at")
  resources   Resource[]
  space       Space?

  @@map("fungible_resources")
}

model Resource {
  id                 String           @id @default(cuid())
  name               String
  fungibleResourceId String           @map("fungible_resource_id")
  serialNumber       String?          @unique @map("serial_number")
  metadata           Json?
  createdAt          BigInt           @default(dbgenerated("((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)")) @map("created_at")
  updatedAt          BigInt           @default(dbgenerated("((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)")) @map("updated_at")
  reservations       Reservation[]
  events             Event[]
  fungibleResource   FungibleResource @relation(fields: [fungibleResourceId], references: [id], onDelete: Cascade)

  @@index([fungibleResourceId])
  @@map("resources")
}

model Space {
  id                 String            @id @default(cuid())
  name               String
  slug               String            @unique
  description        String
  imageUrl           String?           @map("image_url")
  iconName           String?           @map("icon_name")
  isReservable       Boolean           @default(false) @map("is_reservable")
  isFeatured         Boolean           @default(false) @map("is_featured")
  displayOrder       Int               @default(0) @map("display_order")
  metadata           Json?
  fungibleResourceId String?           @unique @map("fungible_resource_id")
  createdAt          BigInt            @default(dbgenerated("((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)")) @map("created_at")
  updatedAt          BigInt            @default(dbgenerated("((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)")) @map("updated_at")
  fungibleResource   FungibleResource? @relation(fields: [fungibleResourceId], references: [id])

  @@map("spaces")
}
```

- [ ] **Step 3: Write the migration SQL**

Create `prisma/migrations/20260704000000_spaces_resource_type_removal/migration.sql`:

```sql
-- ============================================================================
-- 1. Create spaces table
-- ============================================================================
CREATE TABLE spaces (
  id                  text        NOT NULL PRIMARY KEY,
  name                text        NOT NULL,
  slug                text        NOT NULL UNIQUE,
  description         text        NOT NULL,
  image_url           text,
  icon_name           text,
  is_reservable       boolean     NOT NULL DEFAULT false,
  is_featured         boolean     NOT NULL DEFAULT false,
  display_order       int         NOT NULL DEFAULT 0,
  metadata            jsonb,
  fungible_resource_id text       UNIQUE REFERENCES fungible_resources(id),
  created_at          bigint      NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
  updated_at          bigint      NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)
);

-- ============================================================================
-- 2. Rewrite create_reservation: _resource_type resource_types → _fungible_resource_id text
--    Latest version from 20260610000000_cross_resource_overlap_check, adapted.
-- ============================================================================
CREATE OR REPLACE FUNCTION create_reservation(
  _reservation_id text,
  _reservable_type reservable_types,
  _reservable_id text,
  _fungible_resource_id text,
  _event_type event_types,
  _reason text,
  _start_ms bigint,
  _end_ms bigint,
  _is_recurring boolean DEFAULT false,
  _rrule text DEFAULT NULL,
  _recurrence_end_ms bigint DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  actor_size int;
  chosen_resource text;
  cap int;
  exclusive boolean;
  overlap int;
  occ_ms bigint;
  duration_ms bigint;
  recurrence_cap_ms bigint;
  year_cap_ms bigint;
  step_interval interval;
  now_ms bigint;
  omit boolean;
  win_s bigint;
  win_e bigint;
  conflict_resource_name text;
BEGIN
  now_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  duration_ms := _end_ms - _start_ms;
  IF duration_ms <= 0 THEN
    RAISE EXCEPTION 'Invalid reservation window';
  END IF;

  year_cap_ms := 365::bigint * 86400000;

  SELECT get_actor_size(_reservable_type, _reservable_id)
  INTO actor_size;

  FOR chosen_resource, cap, exclusive IN
    SELECT
      r.id,
      COALESCE(fr.capacity, 1) AS capacity,
      COALESCE(fr.is_exclusive, true) AS is_exclusive
    FROM resources r
    LEFT JOIN fungible_resources fr ON fr.id = r.fungible_resource_id
    WHERE r.fungible_resource_id = _fungible_resource_id
    ORDER BY r.id
  LOOP
    IF exclusive THEN
      SELECT COUNT(*) INTO overlap
      FROM reservation_ledger l
      WHERE l.resource_id = chosen_resource
        AND l.status = 'APPROVED'
        AND l.occurrence_start_time < _end_ms
        AND l.occurrence_end_time > _start_ms;

      IF overlap = 0 THEN
        EXIT;
      END IF;

    ELSE
      SELECT COALESCE(MAX(slot_sum), 0)
        INTO overlap
      FROM (
        SELECT COALESCE((
                 SELECT SUM(l.actor_size)
                 FROM reservation_ledger l
                 WHERE l.resource_id = chosen_resource
                   AND l.status = 'APPROVED'
                   AND l.occurrence_start_time = gs
               ), 0) AS slot_sum
        FROM generate_series(_start_ms, _end_ms - 1, 900000::bigint) AS gs
        WHERE gs < _end_ms
      ) slot_check;

      IF (overlap + actor_size) <= cap THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;

  IF chosen_resource IS NULL THEN
    RAISE EXCEPTION 'No available resource for the given time window';
  END IF;

  IF NOT _is_recurring THEN
    -- Cross-resource overlap guard
    SELECT r.name
    INTO conflict_resource_name
    FROM reservation_ledger l
    JOIN resources r ON r.id = l.resource_id
    WHERE l.reservable_id   = _reservable_id
      AND l.reservable_type = _reservable_type
      AND l.status          = 'APPROVED'
      AND l.occurrence_start_time < _end_ms
      AND l.occurrence_end_time   > _start_ms
    LIMIT 1;
    IF conflict_resource_name IS NOT NULL THEN
      RAISE EXCEPTION 'Overlap with approved reservation at %', conflict_resource_name;
    END IF;

    INSERT INTO reservations (
      id, reservable_type, reservable_id, resource_id,
      event_type, reason, start_time, end_time,
      is_recurring, rrule, recurrence_end, status,
      created_at, updated_at
    )
    VALUES (
      _reservation_id, _reservable_type, _reservable_id, chosen_resource,
      _event_type, _reason, _start_ms, _end_ms,
      false, NULL, NULL, 'PENDING',
      now_ms, now_ms
    );

    PERFORM insert_into_ledger(_reservation_id, _start_ms, _end_ms, _reservable_type, _reservable_id, chosen_resource, _event_type, _reason, actor_size, 'PENDING');

    RETURN;
  END IF;

  INSERT INTO reservations (
    id, reservable_type, reservable_id, resource_id,
    event_type, reason, start_time, end_time,
    is_recurring, rrule, recurrence_end, status,
    created_at, updated_at
  )
  VALUES (
    _reservation_id, _reservable_type, _reservable_id, chosen_resource,
    _event_type, _reason, _start_ms, _end_ms,
    true, _rrule, _recurrence_end_ms, 'PENDING',
    now_ms, now_ms
  );

  IF _rrule ILIKE '%DAILY%' THEN
    step_interval := interval '1 day';
  ELSIF _rrule ILIKE '%WEEKLY%' THEN
    step_interval := interval '1 week';
  ELSIF _rrule ILIKE '%MONTHLY%' THEN
    step_interval := interval '1 month';
  ELSIF _rrule ILIKE '%YEARLY%' THEN
    step_interval := interval '1 year';
  ELSE
    step_interval := interval '1 day';
  END IF;

  recurrence_cap_ms := LEAST(
    COALESCE(_recurrence_end_ms, _start_ms + year_cap_ms),
    _start_ms + year_cap_ms
  );

  occ_ms := _start_ms;
  WHILE occ_ms <= recurrence_cap_ms LOOP
    SELECT * INTO omit, win_s, win_e
    FROM effective_occurrence_window(_reservation_id, occ_ms, duration_ms);

    IF NOT omit THEN
      IF exclusive THEN
        SELECT COUNT(*) INTO overlap
        FROM reservation_ledger l
        WHERE l.resource_id = chosen_resource
          AND l.status = 'APPROVED'
          AND l.occurrence_start_time < win_e
          AND l.occurrence_end_time > win_s;

        IF overlap > 0 THEN
          RAISE EXCEPTION 'Conflict on %', occ_ms;
        END IF;
      ELSE
        SELECT COALESCE(MAX(slot_sum), 0) INTO overlap
        FROM (
          SELECT COALESCE((
                   SELECT SUM(l.actor_size)
                   FROM reservation_ledger l
                   WHERE l.resource_id = chosen_resource
                     AND l.status = 'APPROVED'
                     AND l.occurrence_start_time = gs
                 ), 0) AS slot_sum
          FROM generate_series(win_s, win_e - 1, 900000::bigint) AS gs
          WHERE gs < win_e
        ) slot_check;

        IF (overlap + actor_size) > cap THEN
          RAISE EXCEPTION 'Capacity exceeded on %', occ_ms;
        END IF;
      END IF;

      -- Cross-resource overlap guard per occurrence
      SELECT r.name
      INTO conflict_resource_name
      FROM reservation_ledger l
      JOIN resources r ON r.id = l.resource_id
      WHERE l.reservable_id   = _reservable_id
        AND l.reservable_type = _reservable_type
        AND l.status          = 'APPROVED'
        AND l.occurrence_start_time < win_e
        AND l.occurrence_end_time   > win_s
      LIMIT 1;
      IF conflict_resource_name IS NOT NULL THEN
        RAISE EXCEPTION 'Overlap with approved reservation at % on occurrence %', conflict_resource_name, occ_ms;
      END IF;

      PERFORM insert_into_ledger(_reservation_id, win_s, win_e, _reservable_type, _reservable_id, chosen_resource, _event_type, _reason, actor_size, 'PENDING');
    END IF;

    EXIT WHEN occ_ms >= recurrence_cap_ms;
    occ_ms := (EXTRACT(EPOCH FROM (to_timestamp(occ_ms / 1000.0) + step_interval)) * 1000)::bigint;
    IF occ_ms <= _start_ms THEN
      EXIT;
    END IF;
  END LOOP;

END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Rewrite get_unavailable_slots: _resource_type → _fungible_resource_id
--    Latest version from 20260404180000_unix_timestamps_ms, adapted.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_unavailable_slots(
  _fungible_resource_id text,
  _from_ms bigint,
  _to_ms bigint,
  _exclude_user_id text DEFAULT NULL
)
RETURNS TABLE (
  resource_id text,
  start_time bigint,
  end_time bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH ledger_data AS (
    SELECT
      r.id AS resource_id,
      COALESCE(fr.capacity, 1) AS capacity,
      COALESCE(fr.is_exclusive, true) AS is_exclusive,
      l.occurrence_start_time,
      l.occurrence_end_time,
      SUM(l.actor_size) OVER (
        PARTITION BY r.id
        ORDER BY l.occurrence_start_time
        RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
      ) AS total_used
    FROM reservation_ledger l
    JOIN resources r ON r.id = l.resource_id
    LEFT JOIN fungible_resources fr ON fr.id = r.fungible_resource_id
    WHERE r.fungible_resource_id = _fungible_resource_id
      AND l.status = 'APPROVED'
      AND l.occurrence_start_time < _to_ms
      AND l.occurrence_end_time > _from_ms
      AND (_exclude_user_id IS NULL OR l.reservable_id != _exclude_user_id)
  )
  SELECT DISTINCT
    l.resource_id,
    occurrence_start_time AS start_time,
    occurrence_end_time AS end_time
  FROM ledger_data l
  WHERE
    (is_exclusive = true)
    OR (total_used >= capacity)
  ORDER BY start_time;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Rewrite get_user_next_reservations: _resource_type → _fungible_resource_id
--    Latest version from 20260406200000_reservation_ledger_maintenance, adapted.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_next_reservations(
  _user_id text,
  _fungible_resource_id text DEFAULT NULL,
  _limit int DEFAULT 10,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  id text,
  reservation_id text,
  occurrence_start_time bigint,
  occurrence_end_time bigint,
  reservable_type reservable_types,
  reservable_id text,
  resource_id text,
  event_type event_types,
  reason text,
  actor_size int,
  status reservation_statuses,
  created_at bigint
) AS $$
DECLARE
  now_ms bigint;
BEGIN
  now_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;

  RETURN QUERY
  WITH expanded_reservations AS (
    SELECT
      r.id::text AS id,
      r.id::text AS reservation_id,
      r.start_time AS occurrence_start_time,
      r.end_time AS occurrence_end_time,
      r.reservable_type,
      r.reservable_id,
      r.resource_id,
      r.event_type,
      r.reason,
      get_actor_size(r.reservable_type, r.reservable_id) AS actor_size,
      r.status,
      r.created_at
    FROM reservations r
    JOIN resources res ON res.id = r.resource_id
    WHERE r.reservable_type = 'USER'
      AND (_fungible_resource_id IS NULL OR res.fungible_resource_id = _fungible_resource_id)
      AND r.reservable_id = _user_id
      AND r.is_recurring = false
      AND r.start_time >= now_ms

    UNION ALL

    SELECT
      (r.id || '_' || eff.occ_eff_start::text) AS id,
      r.id::text AS reservation_id,
      eff.occ_eff_start AS occurrence_start_time,
      eff.occ_eff_end AS occurrence_end_time,
      r.reservable_type,
      r.reservable_id,
      r.resource_id,
      r.event_type,
      r.reason,
      get_actor_size(r.reservable_type, r.reservable_id) AS actor_size,
      r.status,
      r.created_at
    FROM reservations r
    CROSS JOIN LATERAL generate_series(
      to_timestamp(r.start_time / 1000.0),
      LEAST(
        CASE
          WHEN r.recurrence_end IS NULL THEN to_timestamp(r.start_time / 1000.0) + interval '1 year'
          ELSE to_timestamp(r.recurrence_end / 1000.0)
        END,
        to_timestamp(r.start_time / 1000.0) + interval '1 year'
      ),
      CASE
        WHEN r.rrule ILIKE '%DAILY%' THEN interval '1 day'
        WHEN r.rrule ILIKE '%WEEKLY%' THEN interval '1 week'
        WHEN r.rrule ILIKE '%MONTHLY%' THEN interval '1 month'
        WHEN r.rrule ILIKE '%YEARLY%' THEN interval '1 year'
        ELSE interval '1 day'
      END
    ) AS occ_start
    JOIN resources res ON res.id = r.resource_id
    LEFT JOIN LATERAL (
      SELECT re.is_cancelled, re.new_start_time, re.new_end_time
      FROM reservation_exceptions re
      WHERE re.reservation_id = r.id
        AND (to_timestamp(re.exception_date / 1000.0) AT TIME ZONE 'UTC')::date =
            (to_timestamp((EXTRACT(EPOCH FROM occ_start) * 1000)::bigint / 1000.0) AT TIME ZONE 'UTC')::date
      ORDER BY re.created_at DESC
      LIMIT 1
    ) ex ON true
    CROSS JOIN LATERAL (
      SELECT
        CASE
          WHEN ex.new_start_time IS NOT NULL AND ex.new_end_time IS NOT NULL
            THEN ex.new_start_time
          ELSE (EXTRACT(EPOCH FROM occ_start) * 1000)::bigint
        END AS occ_eff_start,
        CASE
          WHEN ex.new_start_time IS NOT NULL AND ex.new_end_time IS NOT NULL
            THEN ex.new_end_time
          ELSE (EXTRACT(EPOCH FROM occ_start) * 1000)::bigint + (r.end_time - r.start_time)
        END AS occ_eff_end
    ) eff
    WHERE r.reservable_type = 'USER'
      AND (_fungible_resource_id IS NULL OR res.fungible_resource_id = _fungible_resource_id)
      AND r.reservable_id = _user_id
      AND r.is_recurring = true
      AND COALESCE(ex.is_cancelled, false) = false
      AND eff.occ_eff_start >= now_ms
      AND occ_start <= LEAST(
        CASE
          WHEN r.recurrence_end IS NULL THEN to_timestamp(r.start_time / 1000.0) + interval '1 year'
          ELSE to_timestamp(r.recurrence_end / 1000.0)
        END,
        to_timestamp(r.start_time / 1000.0) + interval '1 year'
      )
  )
  SELECT
    er.id,
    er.reservation_id,
    er.occurrence_start_time,
    er.occurrence_end_time,
    er.reservable_type,
    er.reservable_id,
    er.resource_id,
    er.event_type,
    er.reason,
    er.actor_size,
    er.status,
    er.created_at
  FROM expanded_reservations er
  ORDER BY er.occurrence_start_time ASC
  LIMIT _limit
  OFFSET _offset;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Drop type column from resources and the enum
-- ============================================================================
ALTER TABLE resources DROP COLUMN IF EXISTS type;
DROP TYPE IF EXISTS resource_types;
```

- [ ] **Step 4: Apply the migration**

```bash
npx prisma migrate resolve --applied 20260704000000_spaces_resource_type_removal
npx prisma generate
```

If you're on a fresh dev DB, run instead:

```bash
npx prisma migrate dev --name spaces_resource_type_removal
```

Expected: Prisma client regenerated. TypeScript errors will appear — that is expected and will be resolved task by task.

- [ ] **Step 5: Commit**

```bash
git add prisma/models/resources.prisma prisma/models/enums.prisma \
  prisma/migrations/20260704000000_spaces_resource_type_removal/
git commit -m "feat: add Space model, remove ResourceType from schema and SQL functions"
```

---

### Task 2: Seed update

**Files:**

- Modify: `prisma/seed.ts`

**Interfaces:**

- Consumes: `Space` Prisma model (from Task 1)
- Produces: seeded Space rows for all 4 reservable spaces

- [ ] **Step 1: Remove `ResourceType` import and update resource creation**

In `prisma/seed.ts`:

1. Remove `ResourceType` from the import line:

   ```ts
   // BEFORE:
   import {
     EventType,
     PrismaClient,
     ReservableType,
     ReservationStatus,
     ResourceType,
     UserRole,
   } from "@/generated/prisma/client";
   // AFTER:
   import {
     EventType,
     PrismaClient,
     ReservableType,
     ReservationStatus,
     UserRole,
   } from "@/generated/prisma/client";
   ```

2. Replace each `prisma.resource.findFirst({ where: { type: ResourceType.X } })` lookup with a name-based lookup via FungibleResource. Replace the 4 resource find-or-create blocks:

   ```ts
   const meetingRoom =
     (await prisma.resource.findFirst({
       where: { fungibleResourceId: meetingRoomFR.id },
     })) ??
     (await prisma.resource.create({
       data: {
         name: "Sala de reuniones",
         fungibleResourceId: meetingRoomFR.id,
       },
     }));

   const laboratory =
     (await prisma.resource.findFirst({
       where: { fungibleResourceId: laboratoryFR.id },
     })) ??
     (await prisma.resource.create({
       data: {
         name: "Laboratorio",
         fungibleResourceId: laboratoryFR.id,
       },
     }));

   const auditorium =
     (await prisma.resource.findFirst({
       where: { fungibleResourceId: auditoriumFR.id },
     })) ??
     (await prisma.resource.create({
       data: {
         name: "Auditorio",
         fungibleResourceId: auditoriumFR.id,
       },
     }));

   const coworking =
     (await prisma.resource.findFirst({
       where: { fungibleResourceId: coworkingFR.id },
     })) ??
     (await prisma.resource.create({
       data: {
         name: "Coworking",
         fungibleResourceId: coworkingFR.id,
       },
     }));
   ```

- [ ] **Step 2: Add Space upserts after the resource creation block**

Add this block in `main()` after the resource creation, before `seedExampleUsers()`:

```ts
// ── Spaces ────────────────────────────────────────────────────────────────────
await prisma.space.upsert({
  where: { slug: "coworking" },
  create: {
    name: "Coworking",
    slug: "coworking",
    description:
      "Espacio flexible para trabajo individual y colaborativo.\n\nMesas compartidas y livings con puntos de energía y conectividad de alta velocidad. Ideal para programar, diseñar, investigar, atender reuniones breves y avanzar proyectos tecnológicos.",
    imageUrl: "/images/services/coworking.jpg",
    iconName: "Building2",
    isReservable: true,
    isFeatured: false,
    displayOrder: 0,
    metadata: [
      { type: "stat", label: "Mesas compartidas", value: "12 puestos" },
      { type: "stat", label: "Conectividad", value: "Alta velocidad" },
    ],
    fungibleResourceId: coworkingFR.id,
  },
  update: { fungibleResourceId: coworkingFR.id },
});

await prisma.space.upsert({
  where: { slug: "lab" },
  create: {
    name: "Laboratorio",
    slug: "lab",
    description:
      "Ámbito técnico para 6–10 personas (según montaje).\n\nMesa de trabajo en configuración colaborativa. Pensado para hackathones, workshops prácticos y sesiones de trabajo en equipo.",
    imageUrl: "/images/services/laboratorio.jpg",
    iconName: "FlaskConical",
    isReservable: true,
    isFeatured: false,
    displayOrder: 1,
    metadata: [
      { type: "fraction", label: "Capacidad", numerator: 8, denominator: 10 },
      { type: "stat", label: "Configuración", value: "Colaborativa" },
    ],
    fungibleResourceId: laboratoryFR.id,
  },
  update: { fungibleResourceId: laboratoryFR.id },
});

await prisma.space.upsert({
  where: { slug: "meeting-room" },
  create: {
    name: "Sala de reuniones",
    slug: "meeting-room",
    description:
      "Ámbito reservado para 6–10 personas (según montaje).\n\nMesa de trabajo, pantalla y pizarra digital. Pensada para planificaciones, presentaciones a equipos y entrevistas.",
    imageUrl: "/images/services/sala-de-reuniones.jpg",
    iconName: "MessagesSquare",
    isReservable: true,
    isFeatured: false,
    displayOrder: 2,
    metadata: [
      { type: "fraction", label: "Capacidad", numerator: 6, denominator: 10 },
      { type: "stat", label: "Equipamiento", value: "Pizarra digital" },
    ],
    fungibleResourceId: meetingRoomFR.id,
  },
  update: { fungibleResourceId: meetingRoomFR.id },
});

await prisma.space.upsert({
  where: { slug: "auditorium" },
  create: {
    name: "Auditorio",
    slug: "auditorium",
    description:
      "Ambiente amplio y modular para charlas, talleres y presentaciones.\n\nSoporte de proyección y sonido con posibilidad de transmisión en línea. Apto para actividades académicas, empresariales y comunitarias.",
    imageUrl: "/images/services/auditorio.jpg",
    iconName: "Presentation",
    isReservable: true,
    isFeatured: true,
    displayOrder: 3,
    metadata: [
      { type: "stat", label: "Capacidad", value: "50 personas" },
      { type: "stat", label: "Equipamiento", value: "Proyección · Sonido" },
      { type: "stat", label: "Streaming", value: "Transmisión en línea" },
    ],
    fungibleResourceId: auditoriumFR.id,
  },
  update: { fungibleResourceId: auditoriumFR.id },
});

console.log("[seed] Spaces ready");
```

- [ ] **Step 3: Verify seed runs**

```bash
npm run db:reset
```

Expected output contains `[seed] Spaces ready` with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed Space records for all reservable spaces"
```

---

### Task 3: Types + constants

**Files:**

- Create: `src/lib/types/spaces.ts`
- Create: `src/lib/constants/spaces.ts`
- Delete: `src/lib/constants/services.ts` (after confirming no remaining consumers)

**Interfaces:**

- Produces:
  - `SpaceMetadataItem` type (from `src/lib/types/spaces.ts`)
  - `getSpaceIcon(iconName: string): LucideIcon` (from `src/lib/constants/spaces.ts`)

- [ ] **Step 1: Create `src/lib/types/spaces.ts`**

```ts
export type SpaceMetadataItem =
  | { type: "stat"; label: string; value: string }
  | { type: "fraction"; label: string; numerator: number; denominator: number };
```

- [ ] **Step 2: Create `src/lib/constants/spaces.ts`**

```ts
import {
  Building2,
  FlaskConical,
  LucideIcon,
  MessagesSquare,
  Presentation,
  LayoutGrid,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Building2,
  FlaskConical,
  MessagesSquare,
  Presentation,
};

export function getSpaceIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? LayoutGrid;
}
```

- [ ] **Step 3: Delete `src/lib/constants/services.ts`**

First confirm no remaining consumers (they'll be removed in later tasks):

```bash
grep -rn "constants/services" src/ --include="*.ts" --include="*.tsx"
```

The file will have remaining consumers for now — **do not delete yet**. Come back to delete it in Task 12 once all consumers are migrated.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types/spaces.ts src/lib/constants/spaces.ts
git commit -m "feat: add SpaceMetadataItem type and getSpaceIcon helper"
```

---

### Task 4: DB layer — `src/lib/db/spaces.ts`

**Files:**

- Create: `src/lib/db/spaces.ts`

**Interfaces:**

- Produces:
  - `getPublicSpaces(): Promise<SpaceWithFungible[]>` — all spaces ordered by displayOrder, including fungibleResource
  - `getSpaceBySlug(slug: string): Promise<SpaceWithFungible | null>` — single space with fungibleResource

- [ ] **Step 1: Create `src/lib/db/spaces.ts`**

```ts
import { prisma } from "@/lib/prisma";
import type { FungibleResource, Space } from "@/generated/prisma/client";

export type SpaceWithFungible = Space & {
  fungibleResource: FungibleResource | null;
};

export async function getPublicSpaces(): Promise<SpaceWithFungible[]> {
  return prisma.space.findMany({
    orderBy: { displayOrder: "asc" },
    include: { fungibleResource: true },
  });
}

export async function getSpaceBySlug(
  slug: string,
): Promise<SpaceWithFungible | null> {
  return prisma.space.findUnique({
    where: { slug },
    include: { fungibleResource: true },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only from files not yet migrated (they'll say `Property 'type' does not exist on type 'Resource'` or similar). No errors from `spaces.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/spaces.ts
git commit -m "feat: add getPublicSpaces and getSpaceBySlug DB helpers"
```

---

### Task 5: DB layer — `src/lib/db/reservations.ts`

**Files:**

- Modify: `src/lib/db/reservations.ts`

**Interfaces:**

- Consumes: nothing new
- Produces:
  - `CreateReservationInput.fungibleResourceId: string` (replaces `resourceType: ResourceType`)
  - `getUnavailableSlots(fungibleResourceId: string, startTime: Date, endTime: Date, excludeUserId?: string)`
  - `getUserNextReservations(userId: string, fungibleResourceId?: string, limit?: number, offset?: number)`
  - `ReservationWithRelations.resource` no longer has a `type` field

- [ ] **Step 1: Remove `ResourceType` import**

In `reservations.ts`, change:

```ts
import {
  EventType,
  Prisma,
  ReservableType,
  Reservation,
  ReservationException,
  ReservationStatus,
  ResourceType,
} from "@/generated/prisma/client";
```

to:

```ts
import {
  EventType,
  Prisma,
  ReservableType,
  Reservation,
  ReservationException,
  ReservationStatus,
} from "@/generated/prisma/client";
```

- [ ] **Step 2: Update `ReservationWithRelations`**

Remove the `type` field from the nested `resource` type:

```ts
export interface ReservationWithRelations extends Reservation {
  resource?: {
    id: string;
    name: string;
    serialNumber: string | null;
    fungibleResource: {
      id: string;
      name: string;
      capacity: number;
    } | null;
  } | null;
  // ... rest unchanged
}
```

- [ ] **Step 3: Update `CreateReservationInput`**

Replace `resourceType: ResourceType` with `fungibleResourceId: string`:

```ts
export interface CreateReservationInput {
  reservableType: ReservableType;
  reservableId: string;
  fungibleResourceId: string;
  eventType: EventType;
  reason: string;
  startTime: Date;
  endTime: Date;
  isRecurring?: boolean;
  rrule?: string;
  recurrenceEnd?: Date;
}
```

- [ ] **Step 4: Update `createReservation` SQL call**

Find the `$executeRaw` call inside `createReservation` and change:

```ts
// BEFORE:
${data.resourceType}::resource_types,
// AFTER:
${data.fungibleResourceId}::text,
```

- [ ] **Step 5: Update `getUnavailableSlots`**

```ts
export async function getUnavailableSlots(
  fungibleResourceId: string,
  startTime: Date,
  endTime: Date,
  excludeUserId?: string,
): Promise<UnavailableSlot[]> {
  const fromMs = dateToUnixMs(startTime);
  const toMs = dateToUnixMs(endTime);
  const rows = await prisma.$queryRaw<
    {
      resource_id: string;
      start_time: bigint;
      end_time: bigint;
    }[]
  >`
    SELECT * FROM get_unavailable_slots(
      ${fungibleResourceId}::text,
      ${fromMs}::bigint,
      ${toMs}::bigint,
      ${excludeUserId || null}::text
    )
  `;

  return rows.map((row) => ({
    resourceId: row.resource_id,
    startTime: row.start_time,
    endTime: row.end_time,
  }));
}
```

- [ ] **Step 6: Update `getUserNextReservations`**

Change the function signature and SQL call:

```ts
export async function getUserNextReservations(
  userId: string,
  fungibleResourceId?: string,
  limit: number = 10,
  offset: number = 0,
): Promise<ReservationLedgerRow[]> {
  const rows = await prisma.$queryRaw<...>`
    SELECT * FROM get_user_next_reservations(
      ${userId}::text,
      ${fungibleResourceId ?? null}::text,
      ${limit}::int,
      ${offset}::int
    )
  `;
  // ... rest unchanged
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/reservations.ts
git commit -m "refactor: replace ResourceType with fungibleResourceId in reservation DB layer"
```

---

### Task 6: DB layer — `src/lib/db/resourceCalendar.ts`

**Files:**

- Modify: `src/lib/db/resourceCalendar.ts`

**Interfaces:**

- Consumes: `getUnavailableSlots(fungibleResourceId, ...)` and `getUserNextReservations(userId, fungibleResourceId?, ...)` (from Task 5)
- Produces:
  - `getEventOccurrencesForFungibleResource(fungibleResourceId: string, startDate: Date, endDate: Date)`
  - `getCalendarDataByFungibleResource(fungibleResourceId: string, userId: string, startDate: Date, endDate: Date)`

- [ ] **Step 1: Remove `ResourceType` import**

Change the import:

```ts
import { ReservableType } from "@/generated/prisma/client";
// ResourceType removed
```

- [ ] **Step 2: Rename and update `getEventOccurrencesForType`**

Rename to `getEventOccurrencesForFungibleResource`. Change signature from `resourceType: ResourceType` to `fungibleResourceId: string`. Update the SQL query:

```ts
export async function getEventOccurrencesForFungibleResource(
  fungibleResourceId: string,
  startDate: Date,
  endDate: Date,
): Promise<ReservationOccurrence[]> {
  const rangeStartMs = dateToUnixMs(startDate);
  const rangeEndMs = dateToUnixMs(endDate);

  const rows = await prisma.$queryRaw<EventOccurrenceRow[]>`
    SELECT l.reservation_id, l.reservable_id AS event_id, l.resource_id,
           l.occurrence_start_time, l.occurrence_end_time, l.reason
    FROM reservation_ledger l
    JOIN resources r ON r.id = l.resource_id
    WHERE l.reservable_type = 'EVENT'
      AND l.status = 'APPROVED'
      AND r.fungible_resource_id = ${fungibleResourceId}
      AND l.occurrence_start_time < ${rangeEndMs}::bigint
      AND l.occurrence_end_time > ${rangeStartMs}::bigint
  `;
  // ... rest of function body unchanged
}
```

- [ ] **Step 3: Rename and update `getCalendarDataByType`**

Rename to `getCalendarDataByFungibleResource`. Change signature from `resourceType: ResourceType` to `fungibleResourceId: string`.

Update the three callsites inside:

```ts
// 1. getUnavailableSlots call:
getUnavailableSlots(fungibleResourceId, startDate, endDate, userId),
// 2. getEventOccurrencesForFungibleResource call:
getEventOccurrencesForFungibleResource(fungibleResourceId, startDate, endDate),
```

- [ ] **Step 4: Update cross-resource type comparison**

The function builds `resourceTypeMap` (maps resourceId → ResourceType) to split user reservations by whether they match the current resource type. After removal, compare by `fungibleResourceId`.

Replace the `resourceTypeMap` block:

```ts
// BEFORE:
const resourceTypeMap = new Map<string, ResourceType>();
if (uniqueResourceIds.length > 0) {
  const resources = await prisma.resource.findMany({
    where: { id: { in: uniqueResourceIds } },
    select: { id: true, type: true },
  });
  for (const r of resources) {
    resourceTypeMap.set(r.id, r.type);
  }
}
// ...
const resType = res.resourceId ? resourceTypeMap.get(res.resourceId) : undefined;
if (resType === resourceType) { ... }
else if (resType !== undefined && ...) { ... }

// AFTER:
const resourceFungibleMap = new Map<string, string>();
if (uniqueResourceIds.length > 0) {
  const resources = await prisma.resource.findMany({
    where: { id: { in: uniqueResourceIds } },
    select: { id: true, fungibleResourceId: true },
  });
  for (const r of resources) {
    resourceFungibleMap.set(r.id, r.fungibleResourceId);
  }
}
// ...
const resFungibleId = res.resourceId ? resourceFungibleMap.get(res.resourceId) : undefined;
if (resFungibleId === fungibleResourceId) { ... }
else if (resFungibleId !== undefined && ...) { ... }
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/resourceCalendar.ts
git commit -m "refactor: replace ResourceType with fungibleResourceId in calendar DB layer"
```

---

### Task 7: Admin DB layer

**Files:**

- Modify: `src/lib/db/adminReservations.ts`
- Modify: `src/lib/db/adminReports.ts`
- Modify: `src/lib/db/events.ts`

**Interfaces:**

- Produces:
  - `listAdminReservationsByFungibleResource(fungibleResourceId: string, ...)`
  - `listAllAdminReservationsInDateRange(fungibleResourceId: string, ...)`
  - `listDayAdminReservations(fungibleResourceId: string, ...)` (third usage at line ~300)
  - `adminReports` keyed by `FungibleResource.name` instead of `ResourceType`
  - `listEvents` filter uses `fungibleResourceId` instead of `resourceType`

- [ ] **Step 1: Update `adminReservations.ts`**

Remove `ResourceType` import. Rename all three functions and change their `service: ResourceType` param to `fungibleResourceId: string`. Update each Prisma `where` clause:

```ts
// BEFORE:
where: {
  resource: {
    type: service;
  }
}
// AFTER:
where: {
  resource: {
    fungibleResourceId;
  }
}
```

The three functions to update (find them by grep):

- `listAdminReservationsByType` → `listAdminReservationsByFungibleResource`
- `listAllAdminReservationsInDateRange` — same param change
- Third function at ~line 300 — identify it and apply same change

- [ ] **Step 2: Update `adminReports.ts`**

Change the `fetchRangeData` select to include fungible resource name:

```ts
// BEFORE:
resource: { select: { type: true } },
// AFTER:
resource: { select: { fungibleResource: { select: { name: true } } } },
```

Update `ReservationRow` type:

```ts
type ReservationRow = {
  startTime: bigint;
  endTime: bigint;
  status: string;
  resource: { fungibleResource: { name: string } | null } | null;
};
```

Update the bucket key lookup:

```ts
// BEFORE:
const type = r.resource?.type ?? "UNKNOWN";
// AFTER:
const type = r.resource?.fungibleResource?.name ?? "Unknown";
```

- [ ] **Step 3: Update `events.ts`**

Find `buildEventListWhere` (or similar). Change the `resourceType` filter:

```ts
// BEFORE:
if (filters.resourceType) {
  and.push({ resource: { type: filters.resourceType as ResourceType } });
}
// AFTER:
if (filters.fungibleResourceId) {
  and.push({ resource: { fungibleResourceId: filters.fungibleResourceId } });
}
```

Rename the filter field from `resourceType` to `fungibleResourceId` in the `EventListFilters` type:

```ts
/** Filter by the resource's FungibleResource id. */
fungibleResourceId?: string;
```

Remove `ResourceType` import from `events.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/adminReservations.ts src/lib/db/adminReports.ts src/lib/db/events.ts
git commit -m "refactor: replace ResourceType with fungibleResourceId in admin DB layer"
```

---

### Task 8: API routes

**Files:**

- Create: `src/app/api/resources/[fungibleResourceId]/route.ts`
- Delete: `src/app/api/resources/[type]/route.ts`
- Modify: `src/app/api/admin/reservations/route.ts`
- Modify: `src/app/api/admin/reservations/days/route.ts`

**Interfaces:**

- Consumes: `getCalendarDataByFungibleResource`, `createReservation` (Tasks 5–6), `listAdminReservationsByFungibleResource` (Task 7)
- Produces: `GET/POST/DELETE /api/resources/[fungibleResourceId]` — same behaviour, param is now a FungibleResource id

- [ ] **Step 1: Create `src/app/api/resources/[fungibleResourceId]/route.ts`**

```ts
import { auth } from "@/lib/auth";
import { nowMs } from "@/lib/clock";
import { createReservation } from "@/lib/db/reservations";
import { getCalendarDataByFungibleResource } from "@/lib/db/resourceCalendar";
import { getRegisteredUserById } from "@/lib/db/users";
import { serializeJson } from "@/lib/json-bigint";
import { unixMsToDate } from "@/lib/unix-ms";
import { prisma } from "@/lib/prisma";
import { isAfter, startOfDay } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

async function resolveFungibleResource(id: string) {
  return prisma.fungibleResource.findUnique({ where: { id } });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fungibleResourceId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.userId)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = await getRegisteredUserById(session.userId);
    if (!user)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 401 },
      );

    const { fungibleResourceId } = await params;
    const fr = await resolveFungibleResource(fungibleResourceId);
    if (!fr)
      return NextResponse.json(
        { error: "Recurso no encontrado" },
        { status: 404 },
      );

    const { searchParams } = new URL(request.url);
    const startMs = Number(searchParams.get("startDate"));
    const endMs = Number(searchParams.get("endDate"));
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs))
      return NextResponse.json(
        { error: "Se requieren startDate y endDate en milisegundos UTC" },
        { status: 400 },
      );

    const data = await getCalendarDataByFungibleResource(
      fungibleResourceId,
      user.id,
      unixMsToDate(startMs),
      unixMsToDate(endMs),
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fungibleResourceId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.userId)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = await getRegisteredUserById(session.userId);
    if (!user)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 401 },
      );

    const { fungibleResourceId } = await params;
    const fr = await resolveFungibleResource(fungibleResourceId);
    if (!fr)
      return NextResponse.json(
        { error: "Recurso no encontrado" },
        { status: 404 },
      );

    const body = await request.json();
    const { startTime, endTime, reason, eventType } = body;
    if (!startTime || !endTime || !reason)
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 },
      );

    const startMs =
      typeof startTime === "number" ? startTime : Number(startTime);
    const endMs = typeof endTime === "number" ? endTime : Number(endTime);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs))
      return NextResponse.json(
        { error: "startTime y endTime deben ser milisegundos UTC válidos" },
        { status: 400 },
      );

    const startDateTime = unixMsToDate(startMs);
    const endDateTime = unixMsToDate(endMs);

    if (startDateTime >= endDateTime)
      return NextResponse.json(
        { error: "La hora de inicio debe ser anterior a la hora de fin" },
        { status: 400 },
      );

    if (startMs < nowMs())
      return NextResponse.json(
        { error: "No se pueden hacer reservas en el pasado" },
        { status: 400 },
      );

    const serverNow = unixMsToDate(nowMs());
    if (!isAfter(startOfDay(startDateTime), startOfDay(serverNow)))
      return NextResponse.json(
        { error: "Las reservas solo están disponibles a partir de mañana" },
        { status: 400 },
      );

    const dayOfWeek = startDateTime.getUTCDay();
    const startHour = startDateTime.getUTCHours();
    const endHour = endDateTime.getUTCHours();

    if (dayOfWeek === 0 || dayOfWeek === 6)
      return NextResponse.json(
        { error: "Las reservas solo están disponibles de lunes a viernes" },
        { status: 400 },
      );

    if (
      startHour < 12 ||
      endHour > 21 ||
      (endHour === 18 && endDateTime.getMinutes() > 0)
    )
      return NextResponse.json(
        { error: "Las reservas deben estar entre las 9:00 AM y las 6:00 PM" },
        { status: 400 },
      );

    const reservation = await createReservation({
      reservableType: "USER",
      reservableId: user.id,
      fungibleResourceId,
      eventType: eventType || "MEETING",
      reason,
      startTime: startDateTime,
      endTime: endDateTime,
    });

    return NextResponse.json(serializeJson(reservation), { status: 201 });
  } catch (error) {
    console.error(error);
    const knownError = error as Error;
    return NextResponse.json(
      { error: knownError.message || "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fungibleResourceId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.userId)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { fungibleResourceId: _fr } = await params;

    const user = await getRegisteredUserById(session.userId);
    if (!user)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 401 },
      );

    const body = await request.json();
    const { reservationId } = body || {};
    if (!reservationId)
      return NextResponse.json(
        { error: "reservationId requerido" },
        { status: 400 },
      );

    const existing = await prisma.reservation.findFirst({
      where: { id: reservationId, reservableId: user.id },
    });
    if (!existing)
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 },
      );

    if (
      !(existing.reservableType === "USER" && existing.reservableId === user.id)
    )
      return NextResponse.json(
        { error: "No puedes eliminar esta reserva" },
        { status: 403 },
      );

    await prisma.reservation.delete({ where: { id: reservationId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const knownError = error as Error;
    return NextResponse.json(
      { error: knownError.message || "Error interno del servidor" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Delete the old route**

```bash
rm src/app/api/resources/\[type\]/route.ts
rmdir src/app/api/resources/\[type\]
```

- [ ] **Step 3: Update admin reservations routes**

In `src/app/api/admin/reservations/route.ts` and `src/app/api/admin/reservations/days/route.ts`:

1. Remove `ResourceType` import
2. Remove the `ResourceType[service.toUpperCase()]` validation check — instead, validate by looking up the FungibleResource:
   ```ts
   const fr = await prisma.fungibleResource.findUnique({
     where: { id: service },
   });
   if (!fr)
     return NextResponse.json({ error: "Recurso inválido" }, { status: 400 });
   ```
3. Pass `service` (the fungibleResourceId string) directly to `listAdminReservationsByFungibleResource(service, ...)` and `listAllAdminReservationsInDateRange(service, ...)` / `listDayAdminReservations(service, ...)`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/resources/ src/app/api/admin/reservations/
git commit -m "refactor: resources API uses fungibleResourceId, drop ResourceType validation"
```

---

### Task 9: User booking pages + CalendarTemplateClient

**Files:**

- Modify: `src/components/templates/user/calendar-template-client.tsx`
- Modify: `src/app/(management)/user/coworking/page.tsx`
- Modify: `src/app/(management)/user/lab/page.tsx`
- Modify: `src/app/(management)/user/auditorium/page.tsx`
- Modify: `src/app/(management)/user/meeting-room/page.tsx`

**Interfaces:**

- Consumes: `getSpaceBySlug` (Task 4), `getSpaceIcon` (Task 3)

- [ ] **Step 1: Update `CalendarTemplateClient` to accept `iconName` instead of `icon`**

In `src/components/templates/user/calendar-template-client.tsx`:

1. Remove the `icon: LucideIcon` prop
2. Add `iconName?: string` prop
3. Import `getSpaceIcon` from `@/lib/constants/spaces`
4. Resolve the icon inside the component: `const Icon = iconName ? getSpaceIcon(iconName) : LayoutGrid;`
5. Import `LayoutGrid` from `lucide-react` as the fallback

The prop type change (find the existing props interface and update it):

```ts
// BEFORE:
icon: LucideIcon;
// AFTER:
iconName?: string;
```

- [ ] **Step 2: Update `coworking/page.tsx`**

```tsx
import { getSpaceBySlug } from "@/lib/db/spaces";
import { CalendarTemplateClient } from "@/components/templates/user/calendar-template-client";
import { notFound } from "next/navigation";

const EVENT_TYPES = [
  { value: "MEETING", label: "Reunión" },
  { value: "WORKSHOP", label: "Taller" },
  { value: "OTHER", label: "Trabajo individual" },
];

export default async function CoworkingPage() {
  const space = await getSpaceBySlug("coworking");
  if (!space?.fungibleResourceId) notFound();

  return (
    <CalendarTemplateClient
      title={space.name}
      description="Reserva un espacio de trabajo colaborativo en La Nube"
      iconName={space.iconName ?? undefined}
      apiEndpoint={`/api/resources/${space.fungibleResourceId}`}
      eventTypes={EVENT_TYPES}
      defaultEventType="OTHER"
    />
  );
}
```

Remove the `"use client"` directive at the top (file becomes a Server Component).

- [ ] **Step 3: Update `lab/page.tsx`**

```tsx
import { getSpaceBySlug } from "@/lib/db/spaces";
import { CalendarTemplateClient } from "@/components/templates/user/calendar-template-client";
import { notFound } from "next/navigation";

const EVENT_TYPES = [
  { value: "WORKSHOP", label: "Taller" },
  { value: "MEETING", label: "Reunión de proyecto" },
  { value: "OTHER", label: "Otro" },
];

export default async function LabPage() {
  const space = await getSpaceBySlug("lab");
  if (!space?.fungibleResourceId) notFound();

  return (
    <CalendarTemplateClient
      title={space.name}
      description="Reserva el laboratorio para tus proyectos tecnológicos"
      iconName={space.iconName ?? undefined}
      apiEndpoint={`/api/resources/${space.fungibleResourceId}`}
      eventTypes={EVENT_TYPES}
      defaultEventType="WORKSHOP"
    />
  );
}
```

Remove the `"use client"` directive.

- [ ] **Step 4: Update `auditorium/page.tsx`**

```tsx
import { getSpaceBySlug } from "@/lib/db/spaces";
import { CalendarTemplateClient } from "@/components/templates/user/calendar-template-client";
import { notFound } from "next/navigation";

const EVENT_TYPES = [
  { value: "CONFERENCE", label: "Conferencia" },
  { value: "WORKSHOP", label: "Taller" },
  { value: "MEETING", label: "Reunión" },
  { value: "OTHER", label: "Otro" },
];

export default async function AuditoriumPage() {
  const space = await getSpaceBySlug("auditorium");
  if (!space?.fungibleResourceId) notFound();

  return (
    <CalendarTemplateClient
      title={space.name}
      description="Reserva el auditorio para eventos y presentaciones"
      iconName={space.iconName ?? undefined}
      apiEndpoint={`/api/resources/${space.fungibleResourceId}`}
      eventTypes={EVENT_TYPES}
      defaultEventType="CONFERENCE"
    />
  );
}
```

Remove the `"use client"` directive.

- [ ] **Step 5: Update `meeting-room/page.tsx`**

```tsx
import { getSpaceBySlug } from "@/lib/db/spaces";
import { CalendarTemplateClient } from "@/components/templates/user/calendar-template-client";
import { notFound } from "next/navigation";

const EVENT_TYPES = [
  { value: "MEETING", label: "Reunión" },
  { value: "WORKSHOP", label: "Taller" },
  { value: "CONFERENCE", label: "Conferencia" },
  { value: "OTHER", label: "Otro" },
];

export default async function MeetingRoomPage() {
  const space = await getSpaceBySlug("meeting-room");
  if (!space?.fungibleResourceId) notFound();

  return (
    <CalendarTemplateClient
      title={space.name}
      description="Arrastra para seleccionar el horario de tu reunión"
      iconName={space.iconName ?? undefined}
      apiEndpoint={`/api/resources/${space.fungibleResourceId}`}
      eventTypes={EVENT_TYPES}
      defaultEventType="MEETING"
    />
  );
}
```

Remove the `"use client"` directive.

- [ ] **Step 6: Commit**

```bash
git add src/components/templates/user/calendar-template-client.tsx \
  src/app/\(management\)/user/coworking/page.tsx \
  src/app/\(management\)/user/lab/page.tsx \
  src/app/\(management\)/user/auditorium/page.tsx \
  src/app/\(management\)/user/meeting-room/page.tsx
git commit -m "refactor: booking pages use Space slug lookup, drop ResourceType"
```

---

### Task 10: Admin components

**Files:**

- Delete: `src/lib/admin/admin-resource-service-slug.ts`
- Modify: `src/components/molecules/admin-resource-type-combobox.tsx`
- Modify: `src/components/templates/admin/dashboard-recent-reservations.tsx`
- Modify: `src/components/templates/admin/admin-reservations-cards-panel.tsx`
- Modify: `src/components/organisms/admin/admin-service-day-timeline.tsx`
- Modify: `src/components/organisms/admin/event-filters.tsx`
- Modify: `src/app/(management)/admin/reservations/page.tsx`
- Modify: `src/app/(management)/admin/events/page.tsx`
- Modify: `src/app/(management)/admin/dashboard/page.tsx`

**Interfaces:**

- Consumes: `getPublicSpaces()` (Task 4), `SpaceWithFungible` type
- Produces: admin combobox that accepts `{ id: string; name: string }[]` options prop; admin pages pass space options from DB

- [ ] **Step 1: Update `AdminResourceTypeCombobox`**

Rewrite the component to accept dynamic options instead of reading from `admin-resource-service-slug.ts`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

export interface SpaceOption {
  id: string;
  name: string;
}

export function AdminResourceTypeCombobox({
  value,
  onChange,
  options,
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SpaceOption[];
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = options.find((o) => o.id === value)?.name ?? value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between sm:w-[280px]", className)}
        >
          {label}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Buscar espacio…" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={`${opt.name} ${opt.id}`}
                  onSelect={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {opt.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Update `dashboard-recent-reservations.tsx`**

1. Remove `ResourceType` import
2. Remove `AdminResourceServiceSlug` import
3. Remove `type: ResourceType` from `AdminReservationListResult.resource` interface
4. Add `spaceOptions: SpaceOption[]` prop
5. Update internal state: `const [service, setService] = useState<string>(spaceOptions[0]?.id ?? "")`
6. Pass `options={spaceOptions}` to `AdminResourceTypeCombobox`
7. Pass `service` (fungibleResourceId) to `AdminReservationsCardsPanel`

- [ ] **Step 3: Update `admin-reservations-cards-panel.tsx`**

1. Remove `AdminResourceServiceSlug` import and type usage
2. Change `serviceSlug: AdminResourceServiceSlug` prop to `fungibleResourceId: string`
3. Remove the `serviceTitle` function (or rename it to use `name` from the options)
4. Pass `fungibleResourceId` to the fetch call instead of the slug
5. Update the heading title: pass `spaceName: string` prop (the parent passes `space.name`)

- [ ] **Step 4: Update `admin-service-day-timeline.tsx`**

1. Remove `ResourceType` import
2. Remove `resourceTypeLabel` function
3. Find the data structure that has `type: ResourceType` — change it to `spaceName: string`
4. Replace `resourceTypeLabel(meta.type)` with `meta.spaceName` at lines 294 and 446
5. Update the data population code that assigns `type:` to assign `spaceName:` from the FungibleResource or Space name

- [ ] **Step 5: Update `event-filters.tsx`**

Change the `resourceType` filter param to `fungibleResourceId`:

```tsx
// Props type:
resourceType → fungibleResourceId (rename in the interface)
// Usage: same, just a string query param
```

- [ ] **Step 6: Update admin pages**

In `src/app/(management)/admin/reservations/page.tsx`:

1. Import `getPublicSpaces`
2. Fetch `const spaces = await getPublicSpaces()`
3. Build options: `const spaceOptions = spaces.filter(s => s.isReservable && s.fungibleResourceId).map(s => ({ id: s.fungibleResourceId!, name: s.name }))`
4. Pass `spaceOptions` to `DashboardRecentReservations`

In `src/app/(management)/admin/events/page.tsx`:

1. Fetch spaces, build space options
2. Pass options to `EventFilters` (change its props to accept `spaceOptions`)

In `src/app/(management)/admin/dashboard/page.tsx`:

1. Remove any hardcoded `ResourceType` usage
2. Fetch spaces if needed for any ResourceType-based display

- [ ] **Step 7: Delete `admin-resource-service-slug.ts`**

```bash
rm src/lib/admin/admin-resource-service-slug.ts
```

- [ ] **Step 8: Commit**

```bash
git add src/components/molecules/admin-resource-type-combobox.tsx \
  src/components/templates/admin/ \
  src/components/organisms/admin/admin-service-day-timeline.tsx \
  src/components/organisms/admin/event-filters.tsx \
  src/app/\(management\)/admin/reservations/page.tsx \
  src/app/\(management\)/admin/events/page.tsx \
  src/app/\(management\)/admin/dashboard/page.tsx
git commit -m "refactor: admin components use dynamic Space options, drop ResourceType"
```

---

### Task 11: Landing spaces section

**Files:**

- Create: `src/components/templates/landing/spaces/index.tsx`
- Create: `src/components/templates/landing/spaces/space-card/index.tsx`
- Delete: `src/components/templates/landing/services/index.tsx`
- Delete: `src/components/templates/landing/services/service-card/index.tsx`
- Modify: `src/app/(public)/page.tsx`

**Interfaces:**

- Consumes: `getPublicSpaces()` (Task 4), `SpaceMetadataItem` (Task 3), `SpaceWithFungible`

- [ ] **Step 1: Create `src/components/templates/landing/spaces/space-card/index.tsx`**

```tsx
import { LandingCard } from "@/components/templates/landing/shared/landing-card";
import { getSpaceIcon } from "@/lib/constants/spaces";
import type { SpaceMetadataItem } from "@/lib/types/spaces";
import type { SpaceWithFungible } from "@/lib/db/spaces";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

function MetadataChips({ metadata }: { metadata: SpaceMetadataItem[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {metadata.map((item, i) => (
        <span
          key={i}
          className="text-xs px-2 py-0.5 rounded-full bg-la-nube-accent/40 text-foreground font-medium"
        >
          {item.type === "stat"
            ? `${item.label}: ${item.value}`
            : `${item.label}: ${item.numerator}/${item.denominator}`}
        </span>
      ))}
    </div>
  );
}

export function SpaceCard({ space }: { space: SpaceWithFungible }) {
  const metadata = (space.metadata ?? []) as SpaceMetadataItem[];
  const href = space.isReservable
    ? `/user/${space.slug}`
    : `/spaces/${space.slug}`;
  const cta = space.isReservable ? "Reservar" : "Ver más";
  const Icon = space.iconName ? getSpaceIcon(space.iconName) : null;

  return (
    <LandingCard data={{ href, label: `${cta} ${space.name}` }}>
      <div className="flex flex-col gap-3 p-5">
        {space.imageUrl ? (
          <div className="relative h-36 w-full overflow-hidden rounded-lg">
            <Image
              src={space.imageUrl}
              alt={space.name}
              fill
              className="object-cover"
            />
          </div>
        ) : Icon ? (
          <Icon className="w-8 h-8 text-la-nube-primary" />
        ) : null}
        <h3 className="text-lg font-bold">{space.name}</h3>
        {metadata.length > 0 && <MetadataChips metadata={metadata} />}
        <p className="text-sm text-muted-foreground line-clamp-3">
          {space.description.split("\n")[0]}
        </p>
        <div className="flex items-center gap-1.5 text-sm font-medium text-la-nube-primary mt-1">
          {cta}
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
        </div>
      </div>
    </LandingCard>
  );
}
```

- [ ] **Step 2: Create `src/components/templates/landing/spaces/index.tsx`**

```tsx
import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicSpaces } from "@/lib/db/spaces";
import { getSpaceIcon } from "@/lib/constants/spaces";
import type { SpaceMetadataItem } from "@/lib/types/spaces";
import type { SpaceWithFungible } from "@/lib/db/spaces";
import { SpaceCard } from "./space-card";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

function FeaturedSpaceCard({ space }: { space: SpaceWithFungible }) {
  const metadata = (space.metadata ?? []) as SpaceMetadataItem[];
  const href = space.isReservable
    ? `/user/${space.slug}`
    : `/spaces/${space.slug}`;
  const Icon = space.iconName ? getSpaceIcon(space.iconName) : null;

  return (
    <Card className="relative group hover:shadow-[0_4px_16px_rgba(78,135,194,0.2)] transition-shadow duration-200">
      <Link
        href={href}
        className="absolute inset-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-la-nube-primary focus-visible:ring-offset-2"
        aria-label={`Reservar ${space.name}`}
      />
      <CardContent className="flex flex-col md:flex-row gap-6 p-6">
        <div className="flex flex-col gap-3 md:w-2/5">
          {Icon && <Icon className="w-10 h-10 text-la-nube-primary" />}
          <h3 className="text-2xl font-bold">{space.name}</h3>
          {metadata.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {metadata.map((item, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full bg-la-nube-accent/40 text-foreground font-medium"
                >
                  {item.type === "stat"
                    ? `${item.label}: ${item.value}`
                    : `${item.label}: ${item.numerator}/${item.denominator}`}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 md:w-3/5 md:border-l md:border-border md:pl-6">
          {space.imageUrl && (
            <div className="relative h-32 w-full overflow-hidden rounded-lg">
              <Image
                src={space.imageUrl}
                alt={space.name}
                fill
                className="object-cover"
              />
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {space.description.split("\n")[0]}
          </p>
          <div className="flex items-center gap-1.5 text-sm font-medium text-la-nube-primary">
            {space.isReservable ? "Reservar" : "Ver más"}
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function SpacesSection() {
  const spaces = await getPublicSpaces();

  if (spaces.length === 0) return null;

  const featured = spaces.find((s) => s.isFeatured);
  const regular = spaces.filter((s) => !s.isFeatured);

  return (
    <Breakout>
      <section className="w-full flex flex-col items-center border-t border-la-nube-primary/15">
        <Container className="px-8 py-16 gap-8 flex flex-col">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-la-nube-selected dark:text-la-nube-secondary">
              ~/ espacios
              <span className="animate-blink">▌</span>
            </span>
            <h2 id="nuestros-espacios" className="text-5xl font-bold">
              Nuestros{" "}
              <span className="bg-linear-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-transparent">
                espacios
              </span>
            </h2>
            <p className="max-w-prose text-lg text-muted-foreground">
              Los espacios de trabajo que ofrecemos. ¡Vení a conocerlos!
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {regular.length > 0 && (
              <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
                {regular.map((space) => (
                  <SpaceCard key={space.id} space={space} />
                ))}
              </div>
            )}
            {featured && <FeaturedSpaceCard space={featured} />}
          </div>
        </Container>
      </section>
    </Breakout>
  );
}
```

- [ ] **Step 3: Update `src/app/(public)/page.tsx`**

Replace the `ServicesSection` import with `SpacesSection`:

```tsx
// BEFORE:
import ServicesSection from "@/components/templates/landing/services";
// AFTER:
import SpacesSection from "@/components/templates/landing/spaces";
```

And in the JSX:

```tsx
// BEFORE:
<ServicesSection />
// AFTER:
<SpacesSection />
```

- [ ] **Step 4: Delete old services components**

```bash
rm src/components/templates/landing/services/service-card/index.tsx
rmdir src/components/templates/landing/services/service-card
rm src/components/templates/landing/services/index.tsx
rmdir src/components/templates/landing/services
```

- [ ] **Step 5: Commit**

```bash
git add src/components/templates/landing/spaces/ \
  src/app/\(public\)/page.tsx
git commit -m "feat: dynamic SSR Spaces section on landing, replaces static Services"
```

---

### Task 12: Types + test cleanup + delete `services.ts`

**Files:**

- Modify: `src/types/prisma.ts`
- Modify: `src/lib/admin/admin-timeline.test.ts`
- Delete: `src/lib/constants/services.ts`

**Interfaces:**

- Consumes: nothing new
- Produces: clean TypeScript build with no remaining `ResourceType` references

- [ ] **Step 1: Remove `ResourceType` from `src/types/prisma.ts`**

Delete the `ResourceType` const block:

```ts
// DELETE:
export const ResourceType = {
  MEETING: "MEETING",
  AUDITORIUM: "AUDITORIUM",
  COWORKING: "COWORKING",
  LAB: "LAB",
} as const;
```

- [ ] **Step 2: Fix `admin-timeline.test.ts` mock objects**

Remove `type: ResourceType.X` from all `resource` objects in the test file. The `AdminReservationListResult.resource` interface no longer has a `type` field (removed in Task 10). Simply delete each `type:` line:

```ts
// BEFORE:
resource: {
  id: "space-1",
  name: "S",
  type: ResourceType.COWORKING,   // ← DELETE this line
  capacity: 10,
  isExclusive: true,
},
// AFTER:
resource: {
  id: "space-1",
  name: "S",
  capacity: 10,
  isExclusive: true,
},
```

Also remove the `ResourceType` import at line 2.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass. If `admin-timeline.test.ts` fails, the fix is in the mock shapes — verify the `AdminReservationListResult` interface matches what the test provides.

- [ ] **Step 4: Verify no remaining `ResourceType` references in source**

```bash
grep -rn "ResourceType\|resource_types" src/ prisma/models/ --include="*.ts" --include="*.tsx" --include="*.prisma"
```

Expected: no matches (only the migration SQL files and generated Prisma client are allowed to have them; generated files are in `src/generated/` and will update on next `prisma generate` — ignore those).

- [ ] **Step 5: Confirm `services.ts` has no consumers and delete**

```bash
grep -rn "constants/services" src/ --include="*.ts" --include="*.tsx"
```

Expected: no matches. Then:

```bash
rm src/lib/constants/services.ts
```

- [ ] **Step 6: Full lint + type check + tests**

```bash
npm run lint && npx tsc --noEmit && npm test
```

Expected: lint passes, no TypeScript errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/types/prisma.ts src/lib/admin/admin-timeline.test.ts
git commit -m "chore: remove ResourceType from types and test stubs, delete services.ts"
```
