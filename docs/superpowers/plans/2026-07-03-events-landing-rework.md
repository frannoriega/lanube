# Events Landing Rework & Event Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing events carousel with a responsive paginated grid, add `hasExceptions` signaling with an asterisk, and introduce a public `/events/[id]` detail page with a full session agenda.

**Architecture:** A new paginated DB function + public API route feed a client-side `EventsGrid` component that adapts page size to the viewport's column count (Tailwind breakpoints). Each card links to a new public server-rendered detail page that expands all occurrences (past + future) via the existing pure occurrence logic.

**Tech Stack:** Next.js 15 App Router, Prisma 7, Tailwind v4, Radix UI / shadcn, Vitest (node env), TypeScript.

## Global Constraints

- All timestamps stored and transmitted as UNIX ms (BigInt in DB, `number` in TS).
- Dates formatted client-side in the viewer's locale; never server-side for user-facing text.
- No new npm dependencies unless strictly required.
- Public routes live in `src/app/(public)/` or `src/app/api/` (no auth middleware).
- Spanish copy throughout (same language as the rest of the UI).
- No changes to admin pages, form submission flow, or existing DB migrations.

---

## File Map

| Action   | Path                                                          | Responsibility                                                                                                                        |
| -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Modified | `src/lib/events/occurrences.ts`                               | Add `expandAllEventOccurrences`                                                                                                       |
| Modified | `src/lib/db/events.ts`                                        | Export `toRawReservation`; add `getUpcomingPublicEventsPage`, `getPublicEventDetail`; extend `UpcomingEventCard` with `hasExceptions` |
| Created  | `src/app/api/events/route.ts`                                 | `GET /api/events?page&pageSize` — public paginated endpoint                                                                           |
| Modified | `src/components/molecules/local-date.tsx`                     | Add `LocalDateTime` export                                                                                                            |
| Created  | `src/components/molecules/registration-cta.tsx`               | `RegistrationCta` extracted from `event-card.tsx`                                                                                     |
| Modified | `src/components/templates/landing/events/event-card.tsx`      | Full-card link, `w-full`, asterisk badge, consume `RegistrationCta`                                                                   |
| Created  | `src/components/templates/landing/events/events-grid.tsx`     | Responsive grid + pagination client component                                                                                         |
| Deleted  | `src/components/templates/landing/events/events-carousel.tsx` | Replaced by `events-grid.tsx`                                                                                                         |
| Modified | `src/components/templates/landing/events/index.tsx`           | Use `getUpcomingPublicEventsPage`; pass to `EventsGrid`                                                                               |
| Created  | `src/app/(public)/events/[id]/page.tsx`                       | Public event detail page with agenda                                                                                                  |

---

### Task 1: Data layer — `expandAllEventOccurrences` + paginated DB queries

**Files:**

- Modify: `src/lib/events/occurrences.ts`
- Modify: `src/lib/db/events.ts`
- Test: `src/lib/events/occurrences.test.ts`

**Interfaces:**

- Produces: `expandAllEventOccurrences(reservations: RawReservation[]): EventOccurrence[]`
- Produces: `getUpcomingPublicEventsPage(page: number, pageSize: number): Promise<{ events: UpcomingEventCard[], total: number, page: number, pageSize: number }>`
- Produces: `getPublicEventDetail(id: string): Promise<PublicEventDetail | null>`
- Produces: `toRawReservation` (exported)
- Extends: `UpcomingEventCard` with `hasExceptions: boolean`
- Produces: `PublicEventDetail` interface

Where `PublicEventDetail` is:

```ts
export interface PublicEventDetail {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  eventType: EventType;
  startTime: number;
  endTime: number;
  recurrenceEnd: number | null;
  weekdays: number[];
  resourceName: string;
  registration: RegistrationPhase;
  formSlug: string | null;
  formOpensAt: number | null;
  formClosesAt: number | null;
  reservations: RawReservation[];
}
```

- [ ] **Step 1.1: Write the failing test for `expandAllEventOccurrences`**

Add at the bottom of `src/lib/events/occurrences.test.ts`:

```ts
describe("expandAllEventOccurrences", () => {
  it("includes past occurrences that expandEventOccurrences would drop", () => {
    // now = well after all 4 occurrences ended
    const farFuture = START + 10 * WEEK;
    // expandEventOccurrences with farFuture as now → drops everything
    expect(expandEventOccurrences([makeRes()], farFuture)).toHaveLength(0);
    // expandAllEventOccurrences → returns all 4
    const all = expandAllEventOccurrences([makeRes()]);
    expect(all).toHaveLength(4);
    expect(all[0].startMs).toBe(START);
  });

  it("still overlays exceptions on past occurrences", () => {
    const cancelled: RawReservation["exceptions"][number] = {
      id: "ex1",
      exceptionDateMs: START,
      isCancelled: true,
      newStartMs: null,
      newEndMs: null,
      reason: "sala ocupada",
      createdAtMs: START - 1,
    };
    const all = expandAllEventOccurrences([makeRes([cancelled])]);
    expect(all).toHaveLength(4);
    expect(all[0].status).toBe("cancelled");
    expect(all[0].reason).toBe("sala ocupada");
  });
});
```

- [ ] **Step 1.2: Run test to confirm it fails**

```bash
npm test -- --reporter=verbose occurrences
```

Expected: FAIL — `expandAllEventOccurrences` is not exported.

- [ ] **Step 1.3: Add `expandAllEventOccurrences` to `src/lib/events/occurrences.ts`**

Add after the closing brace of `expandEventOccurrences` (around line 112):

```ts
/**
 * Like `expandEventOccurrences` but includes past occurrences too — every
 * week from startMs through recurrenceEndMs. Used on the public event detail
 * page to show the full agenda (past sessions grayed out).
 */
export function expandAllEventOccurrences(
  reservations: RawReservation[],
): EventOccurrence[] {
  // Pass 0 as nowMs so `filterEnd <= 0` is never true for real events.
  return expandEventOccurrences(reservations, 0);
}
```

Also add `expandAllEventOccurrences` to the import in `occurrences.test.ts`.

- [ ] **Step 1.4: Run test to confirm it passes**

```bash
npm test -- --reporter=verbose occurrences
```

Expected: all tests PASS.

- [ ] **Step 1.5: Extend `UpcomingEventCard` and add `getUpcomingPublicEventsPage` in `src/lib/db/events.ts`**

1. Export `toRawReservation` (change `function` to `export function` at line 242).

2. Extend `UpcomingEventCard` interface (around line 874) — add the field:

```ts
export interface UpcomingEventCard {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  eventType: EventType;
  startTime: number;
  recurrenceEnd: number | null;
  resourceName: string;
  weekdays: number[];
  formSlug: string | null;
  registration: RegistrationPhase;
  formOpensAt: number | null;
  formClosesAt: number | null;
  hasExceptions: boolean; // ← new
}
```

3. Add `getUpcomingPublicEventsPage` after `getUpcomingPublicEvents`:

```ts
/**
 * Paginated version of `getUpcomingPublicEvents`. Returns the same cards plus a total
 * count and `hasExceptions` flag per event (true if any ReservationException exists on
 * the event's reservations — any status, any date).
 */
export async function getUpcomingPublicEventsPage(
  page: number,
  pageSize: number,
): Promise<{
  events: UpcomingEventCard[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const nowNum = nowMs();
  const now = BigInt(nowNum);
  const where = {
    status: "PUBLISHED" as const,
    deletedAt: null,
    OR: [
      { recurrenceEnd: { gte: now } },
      { recurrenceEnd: null, endTime: { gte: now } },
    ],
  };

  const [rawEvents, total] = await prisma.$transaction([
    prisma.event.findMany({
      where,
      orderBy: { startTime: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        resource: {
          select: {
            name: true,
            fungibleResource: { select: { capacity: true } },
          },
        },
        form: {
          select: {
            slug: true,
            isPublished: true,
            opensAt: true,
            closesAt: true,
          },
        },
        _count: { select: { participants: { where: { cancelled: false } } } },
      },
    }),
    prisma.event.count({ where }),
  ]);

  // Determine which events have at least one ReservationException (any date/status).
  const eventIds = rawEvents.map((e) => e.id);
  const reservationsWithExceptions = await prisma.reservation.findMany({
    where: {
      reservableType: "EVENT",
      reservableId: { in: eventIds },
      exceptions: { some: {} },
    },
    select: { reservableId: true },
  });
  const withExceptions = new Set(
    reservationsWithExceptions.map((r) => r.reservableId),
  );

  const events: UpcomingEventCard[] = rawEvents.map((e) => {
    const cap = e.capacity ?? e.resource.fungibleResource?.capacity ?? null;
    const isFull = cap !== null && e._count.participants >= cap;
    const opensAt = e.form ? Number(e.form.opensAt) : null;
    const closesAt = e.form ? Number(e.form.closesAt) : null;

    let registration: RegistrationPhase;
    if (!e.form || opensAt === null || closesAt === null) registration = "none";
    else if (opensAt > nowNum) registration = "upcoming";
    else if (nowNum <= closesAt && !isFull) registration = "open";
    else registration = "closed";

    return {
      id: e.id,
      name: e.name,
      description: e.description,
      imageUrl: e.imageUrl,
      eventType: e.eventType,
      startTime: Number(e.startTime),
      recurrenceEnd: e.recurrenceEnd ? Number(e.recurrenceEnd) : null,
      resourceName: e.resource.name,
      weekdays: weekdaysFromRrule(e.rrule),
      formSlug: e.form?.slug ?? null,
      registration,
      formOpensAt: opensAt,
      formClosesAt: closesAt,
      hasExceptions: withExceptions.has(e.id),
    };
  });

  return { events, total, page, pageSize };
}
```

- [ ] **Step 1.6: Add `PublicEventDetail` interface and `getPublicEventDetail` to `src/lib/db/events.ts`**

Add after `getUpcomingPublicEventsPage`:

```ts
export interface PublicEventDetail {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  eventType: EventType;
  startTime: number;
  endTime: number;
  recurrenceEnd: number | null;
  weekdays: number[];
  resourceName: string;
  registration: RegistrationPhase;
  formSlug: string | null;
  formOpensAt: number | null;
  formClosesAt: number | null;
  reservations: RawReservation[];
}

/**
 * Public event detail for the /events/[id] page. Returns null for non-existent,
 * non-PUBLISHED, or soft-deleted events. Includes all reservations with their
 * exceptions so the caller can expand the full agenda.
 */
export async function getPublicEventDetail(
  id: string,
): Promise<PublicEventDetail | null> {
  const nowNum = nowMs();

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      resource: {
        select: {
          name: true,
          fungibleResource: { select: { capacity: true } },
        },
      },
      form: {
        select: {
          slug: true,
          isPublished: true,
          opensAt: true,
          closesAt: true,
        },
      },
      _count: { select: { participants: { where: { cancelled: false } } } },
    },
  });

  if (!event || event.status !== "PUBLISHED" || event.deletedAt !== null) {
    return null;
  }

  const rawReservations = await prisma.reservation.findMany({
    where: { reservableType: "EVENT", reservableId: id },
    include: { exceptions: true },
  });

  const cap =
    event.capacity ?? event.resource.fungibleResource?.capacity ?? null;
  const isFull = cap !== null && event._count.participants >= cap;
  const opensAt = event.form ? Number(event.form.opensAt) : null;
  const closesAt = event.form ? Number(event.form.closesAt) : null;

  let registration: RegistrationPhase;
  if (!event.form || opensAt === null || closesAt === null)
    registration = "none";
  else if (opensAt > nowNum) registration = "upcoming";
  else if (nowNum <= closesAt && !isFull) registration = "open";
  else registration = "closed";

  return {
    id: event.id,
    name: event.name,
    description: event.description,
    imageUrl: event.imageUrl,
    eventType: event.eventType,
    startTime: Number(event.startTime),
    endTime: Number(event.endTime),
    recurrenceEnd: event.recurrenceEnd ? Number(event.recurrenceEnd) : null,
    weekdays: weekdaysFromRrule(event.rrule),
    resourceName: event.resource.name,
    registration,
    formSlug: event.form?.slug ?? null,
    formOpensAt: opensAt,
    formClosesAt: closesAt,
    reservations: rawReservations.map(toRawReservation),
  };
}
```

Also add the import of `RawReservation` from `occurrences.ts` if not already imported (it is, via `toRawReservation`).

- [ ] **Step 1.7: Run the full test suite**

```bash
npm test
```

Expected: all existing tests PASS (no regressions). The new `expandAllEventOccurrences` tests also pass.

- [ ] **Step 1.8: Commit**

```bash
git add src/lib/events/occurrences.ts src/lib/events/occurrences.test.ts src/lib/db/events.ts
git -c commit.gpgsign=false commit -m "feat: add expandAllEventOccurrences, paginated public events query, and event detail query"
```

---

### Task 2: Public API route `GET /api/events`

**Files:**

- Create: `src/app/api/events/route.ts`

**Interfaces:**

- Consumes: `getUpcomingPublicEventsPage(page, pageSize)` from `src/lib/db/events.ts`
- Produces: `GET /api/events?page=N&pageSize=M` → `{ events: UpcomingEventCard[], total: number, page: number, pageSize: number }`

- [ ] **Step 2.1: Create `src/app/api/events/route.ts`**

```ts
import { getUpcomingPublicEventsPage } from "@/lib/db/events";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    16,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "6", 10) || 6),
  );

  const result = await getUpcomingPublicEventsPage(page, pageSize);
  return NextResponse.json(result);
}
```

- [ ] **Step 2.2: Manual smoke test**

Start the dev server (`npm run dev`) and run:

```bash
curl "http://localhost:3000/api/events?page=1&pageSize=4" | jq '{total, page, pageSize, count: (.events | length)}'
```

Expected output (example — values depend on your seed data):

```json
{ "total": 0, "page": 1, "pageSize": 4, "count": 0 }
```

(Zero events is fine for a fresh dev DB; the route returning valid JSON is what matters.)

- [ ] **Step 2.3: Commit**

```bash
git add src/app/api/events/route.ts
git -c commit.gpgsign=false commit -m "feat: add GET /api/events paginated public endpoint"
```

---

### Task 3: `LocalDateTime` molecule

**Files:**

- Modify: `src/components/molecules/local-date.tsx`

**Interfaces:**

- Produces: `LocalDateTime({ startMs, endMs, className }): JSX.Element`
  - `startMs: number` — UNIX ms for the start time
  - `endMs: number` — UNIX ms for the end time
  - Renders e.g. `"jue. 2 jul. 2026, 10:00 – 13:00"` in the viewer's locale

- [ ] **Step 3.1: Add `LocalDateTime` to `src/components/molecules/local-date.tsx`**

Append after the `LocalDateRange` export:

```ts
/**
 * Renders an occurrence's start date + time range (e.g. "jue. 2 jul. 2026, 10:00 – 13:00")
 * in the viewer's timezone + locale. Hydration-safe: empty on first paint, filled on client.
 */
export function LocalDateTime({
  startMs,
  endMs,
  className,
}: {
  startMs: number;
  endMs: number;
  className?: string;
}) {
  const [text, setText] = useState("");
  useEffect(() => {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    const startStr = new Date(startMs).toLocaleString(undefined, opts);
    const endOpts: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
    };
    const endStr = new Date(endMs).toLocaleTimeString(undefined, endOpts);
    setText(`${startStr} – ${endStr}`);
  }, [startMs, endMs]);
  return (
    <time
      dateTime={new Date(startMs).toISOString()}
      className={className}
      suppressHydrationWarning
    >
      {text || " "}
    </time>
  );
}
```

- [ ] **Step 3.2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3.3: Commit**

```bash
git add src/components/molecules/local-date.tsx
git -c commit.gpgsign=false commit -m "feat: add LocalDateTime molecule for occurrence date+time display"
```

---

### Task 4: Extract `RegistrationCta` to a shared molecule

**Files:**

- Create: `src/components/molecules/registration-cta.tsx`
- Modify: `src/components/templates/landing/events/event-card.tsx` (replace inline definition with import)

**Interfaces:**

- Consumes: `UpcomingEventCardData` (from `event-card.tsx`); `RegistrationPhase` (from `@/lib/db/events`)
- Produces: `RegistrationCta({ event: RegistrationCtaProps }): JSX.Element`

Where `RegistrationCtaProps` is:

```ts
export interface RegistrationCtaProps {
  registration: RegistrationPhase;
  formSlug: string | null;
  formOpensAt: number | null;
  formClosesAt: number | null;
}
```

- [ ] **Step 4.1: Create `src/components/molecules/registration-cta.tsx`**

```tsx
import { LocalDate } from "@/components/molecules/local-date";
import { Button } from "@/components/ui/button";
import type { RegistrationPhase } from "@/lib/db/events";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import Link from "next/link";

export interface RegistrationCtaProps {
  registration: RegistrationPhase;
  formSlug: string | null;
  formOpensAt: number | null;
  formClosesAt: number | null;
}

export function RegistrationCta({ event }: { event: RegistrationCtaProps }) {
  if (event.registration === "open" && event.formSlug) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button asChild size="sm" className="w-full">
          <Link
            href={`/forms/${event.formSlug}`}
            onClick={(e) => e.stopPropagation()}
          >
            Inscribirme
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
        {event.formClosesAt !== null && (
          <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="h-3 w-3 shrink-0" />
            Cierra el <LocalDate ms={event.formClosesAt} />
          </span>
        )}
      </div>
    );
  }

  if (event.registration === "upcoming" && event.formOpensAt !== null) {
    return (
      <Button size="sm" className="w-full" disabled aria-disabled="true">
        <CalendarClock className="h-4 w-4" />
        Disponible el <LocalDate ms={event.formOpensAt} />
      </Button>
    );
  }

  return (
    <span className="rounded-md border border-dashed border-border py-1.5 text-center text-xs text-muted-foreground">
      {event.registration === "closed" ? "Inscripción cerrada" : "Próximamente"}
    </span>
  );
}
```

- [ ] **Step 4.2: Update `src/components/templates/landing/events/event-card.tsx`**

Remove the inline `RegistrationCta` function and its imports (`ArrowUpRight`, `CalendarClock`, `LocalDate`, `Button`, `Link`). Import the new shared molecule instead. The `UpcomingEventCardData` interface stays in this file (it's the card's data shape).

Replace the bottom of the file (the `RegistrationCta` function and its imports) so the file looks like:

```tsx
import { EventCover } from "@/components/molecules/event-cover";
import { LocalDateRange } from "@/components/molecules/local-date";
import {
  RegistrationCta,
  type RegistrationCtaProps,
} from "@/components/molecules/registration-cta";
import { eventTypeLabel, WEEKDAY_SHORT_LABELS } from "@/lib/constants/events";
import type { RegistrationPhase } from "@/lib/db/events";
import { MapPin } from "lucide-react";
import Link from "next/link";

export interface UpcomingEventCardData {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  eventType: string;
  startMs: number;
  recurrenceEndMs: number | null;
  resourceName: string;
  weekdays: number[];
  formSlug: string | null;
  registration: RegistrationPhase;
  formOpensAt: number | null;
  formClosesAt: number | null;
  hasExceptions: boolean;
}

export function EventCard({ event }: { event: UpcomingEventCardData }) {
  const cta: RegistrationCtaProps = {
    registration: event.registration,
    formSlug: event.formSlug,
    formOpensAt: event.formOpensAt,
    formClosesAt: event.formClosesAt,
  };

  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 focus-within:ring-2 focus-within:ring-la-nube-primary hover:-translate-y-1 hover:border-la-nube-primary hover:shadow-md">
      {/* Full-card link (stretched link pattern — painted behind content) */}
      <Link
        href={`/events/${event.id}`}
        className="absolute inset-0"
        aria-label={`Ver detalles: ${event.name}`}
        tabIndex={-1}
      />

      {/* Cover */}
      <div className="relative">
        <EventCover
          imageUrl={event.imageUrl}
          name={event.name}
          eventType={event.eventType}
          className="aspect-[16/10] w-full"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-la-nube-selected shadow-sm backdrop-blur dark:bg-slate-950/80 dark:text-la-nube-secondary">
          {eventTypeLabel(event.eventType)}
        </span>
        {event.hasExceptions && (
          <span className="absolute right-3 top-3 rounded-full bg-amber-100/90 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-700 shadow-sm backdrop-blur dark:bg-amber-900/80 dark:text-amber-300">
            *
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <LocalDateRange
            startMs={event.startMs}
            endMs={event.recurrenceEndMs}
            className="font-mono text-sm font-medium text-la-nube-selected before:content-['▸_'] dark:text-la-nube-secondary"
          />
          {event.weekdays.length > 0 && (
            <span className="flex gap-1">
              {event.weekdays.map((d) => (
                <span
                  key={d}
                  className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground"
                >
                  {WEEKDAY_SHORT_LABELS[d]}
                </span>
              ))}
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 text-lg font-bold leading-tight text-foreground">
          {event.name}
        </h3>

        {event.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {event.description}
          </p>
        )}

        <div className="relative z-10 mt-auto flex flex-col gap-3 pt-1">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{event.resourceName}</span>
          </span>
          <RegistrationCta event={cta} />
        </div>
      </div>
    </article>
  );
}
```

Note: `w-[280px] shrink-0` removed (the grid column controls width now). `relative` added to `<article>`. Inner CTA wrapped in `relative z-10` so it sits above the full-card link overlay.

- [ ] **Step 4.3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4.4: Commit**

```bash
git add src/components/molecules/registration-cta.tsx src/components/templates/landing/events/event-card.tsx
git -c commit.gpgsign=false commit -m "feat: extract RegistrationCta molecule; update EventCard with full-card link and asterisk badge"
```

---

### Task 5: `EventsGrid` client component + update `EventsSection`

**Files:**

- Create: `src/components/templates/landing/events/events-grid.tsx`
- Delete: `src/components/templates/landing/events/events-carousel.tsx`
- Modify: `src/components/templates/landing/events/index.tsx`

**Interfaces:**

- Consumes: `UpcomingEventCardData` (from `event-card.tsx`), `EventCard` (from `event-card.tsx`)
- Consumes: `GET /api/events?page&pageSize` (returns `{ events, total, page, pageSize }`)
- Consumes: `getUpcomingPublicEventsPage(1, 6)` from `@/lib/db/events`
- Produces: `<EventsGrid initialEvents={UpcomingEventCardData[]} initialTotal={number} />`

- [ ] **Step 5.1: Create `src/components/templates/landing/events/events-grid.tsx`**

```tsx
"use client";

import {
  EventCard,
  type UpcomingEventCardData,
} from "@/components/templates/landing/events/event-card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

function getColumnCount(): number {
  if (typeof window === "undefined") return 3;
  const w = window.innerWidth;
  if (w >= 1280) return 4;
  if (w >= 1024) return 3;
  if (w >= 640) return 2;
  return 1;
}

export function EventsGrid({
  initialEvents,
  initialTotal,
}: {
  initialEvents: UpcomingEventCardData[];
  initialTotal: number;
}) {
  const [events, setEvents] = useState<UpcomingEventCardData[]>(initialEvents);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6); // matches SSR default
  const [loading, setLoading] = useState(false);

  const fetchPage = useCallback(async (p: number, ps: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events?page=${p}&pageSize=${ps}`);
      const data = await res.json();
      setEvents(data.events);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: detect actual column count and refetch if it differs from SSR default.
  useEffect(() => {
    const cols = getColumnCount();
    const size = cols * 2;
    if (size !== 6) {
      setPageSize(size);
      setPage(1);
      fetchPage(1, size);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback(
    (p: number) => {
      setPage(p);
      fetchPage(p, pageSize);
    },
    [pageSize, fetchPage],
  );

  const totalPages = Math.ceil(total / pageSize);
  const hasAsterisk = events.some((e) => e.hasExceptions);

  return (
    <div className={loading ? "opacity-60 transition-opacity" : ""}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {hasAsterisk && (
        <p className="mt-4 text-xs text-muted-foreground">
          * Este evento tiene sesiones reprogramadas o canceladas.
        </p>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goTo(page - 1)}
            disabled={page <= 1 || loading}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goTo(page + 1)}
            disabled={page >= totalPages || loading}
            aria-label="Página siguiente"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5.2: Update `src/components/templates/landing/events/index.tsx`**

```tsx
import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { EventsGrid } from "@/components/templates/landing/events/events-grid";
import type { UpcomingEventCardData } from "@/components/templates/landing/events/event-card";
import { getUpcomingPublicEventsPage } from "@/lib/db/events";

export default async function EventsSection() {
  const { events, total } = await getUpcomingPublicEventsPage(1, 6);

  if (total === 0) return null;

  const cards: UpcomingEventCardData[] = events.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    imageUrl: e.imageUrl,
    eventType: e.eventType,
    startMs: e.startTime,
    recurrenceEndMs: e.recurrenceEnd,
    resourceName: e.resourceName,
    weekdays: e.weekdays,
    formSlug: e.formSlug,
    registration: e.registration,
    formOpensAt: e.formOpensAt,
    formClosesAt: e.formClosesAt,
    hasExceptions: e.hasExceptions,
  }));

  return (
    <Breakout className="bg-gradient-to-b from-la-nube-accent/40 to-transparent dark:from-la-nube-selected/15">
      <section className="w-full" aria-labelledby="proximos-eventos">
        <Container className="flex flex-col gap-8 px-8 py-16">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-la-nube-selected dark:text-la-nube-secondary">
              ~/ eventos
              <span className="animate-blink">▌</span>
            </span>
            <h2 id="proximos-eventos" className="text-5xl font-bold">
              Próximos{" "}
              <span className="bg-gradient-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-transparent">
                eventos
              </span>
            </h2>
            <p className="max-w-prose text-lg text-muted-foreground">
              Talleres, charlas y encuentros abiertos en La Nube. Sumate a la
              próxima fecha.
            </p>
          </div>

          <EventsGrid initialEvents={cards} initialTotal={total} />
        </Container>
      </section>
    </Breakout>
  );
}
```

- [ ] **Step 5.3: Delete `events-carousel.tsx`**

```bash
rm src/components/templates/landing/events/events-carousel.tsx
```

- [ ] **Step 5.4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5.5: Commit**

```bash
git add src/components/templates/landing/events/events-grid.tsx src/components/templates/landing/events/index.tsx
git rm src/components/templates/landing/events/events-carousel.tsx
git -c commit.gpgsign=false commit -m "feat: replace events carousel with responsive paginated grid"
```

---

### Task 6: `/events/[id]` public detail page

**Files:**

- Create: `src/app/(public)/events/[id]/page.tsx`

**Interfaces:**

- Consumes: `getPublicEventDetail(id)` → `PublicEventDetail | null`
- Consumes: `expandAllEventOccurrences(reservations)` → `EventOccurrence[]`
- Consumes: `EventHero` from `@/components/organisms/forms/event-hero`
- Consumes: `RegistrationCta` from `@/components/molecules/registration-cta`
- Consumes: `LocalDate`, `LocalDateTime` from `@/components/molecules/local-date`
- Consumes: `eventTypeLabel`, `WEEKDAY_SHORT_LABELS` from `@/lib/constants/events`

- [ ] **Step 6.1: Create `src/app/(public)/events/[id]/page.tsx`**

```tsx
import { EventHero } from "@/components/organisms/forms/event-hero";
import { LocalDate, LocalDateTime } from "@/components/molecules/local-date";
import { RegistrationCta } from "@/components/molecules/registration-cta";
import { eventTypeLabel, WEEKDAY_SHORT_LABELS } from "@/lib/constants/events";
import { getPublicEventDetail } from "@/lib/db/events";
import { expandAllEventOccurrences } from "@/lib/events/occurrences";
import { nowMs } from "@/lib/clock";
import { MapPin } from "lucide-react";
import { notFound } from "next/navigation";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getPublicEventDetail(id);
  if (!event) notFound();

  const now = nowMs();
  const occurrences = expandAllEventOccurrences(event.reservations);

  // First future occurrence (not cancelled) for the "next session" highlight.
  const nextIdx = occurrences.findIndex(
    (o) => o.status !== "cancelled" && o.startMs > now,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <EventHero
        name={event.name}
        description={event.description}
        imageUrl={event.imageUrl}
      />

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-border px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide text-la-nube-selected dark:text-la-nube-secondary">
          {eventTypeLabel(event.eventType)}
        </span>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          {event.resourceName}
        </span>
        {event.weekdays.length > 0 && (
          <span className="flex gap-1">
            {event.weekdays.map((d) => (
              <span
                key={d}
                className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground"
              >
                {WEEKDAY_SHORT_LABELS[d]}
              </span>
            ))}
          </span>
        )}
      </div>

      {/* Registration CTA */}
      <div className="max-w-xs">
        <RegistrationCta
          event={{
            registration: event.registration,
            formSlug: event.formSlug,
            formOpensAt: event.formOpensAt,
            formClosesAt: event.formClosesAt,
          }}
        />
      </div>

      {/* Agenda */}
      {occurrences.length > 0 && (
        <section aria-labelledby="sesiones-heading">
          <h2 id="sesiones-heading" className="mb-4 text-xl font-semibold">
            Sesiones
          </h2>
          <ol className="space-y-2">
            {occurrences.map((occ, idx) => {
              const isPast = occ.endMs <= now;
              const isNext = idx === nextIdx;
              const isCancelled = occ.status === "cancelled";
              const isRescheduled = occ.status === "rescheduled";

              return (
                <li
                  key={`${occ.reservationId}-${occ.occurrenceDateMs}`}
                  className={[
                    "flex flex-col gap-1 rounded-lg border px-4 py-3 text-sm",
                    isPast && !isCancelled
                      ? "border-border/50 text-muted-foreground opacity-60"
                      : "border-border",
                    isNext ? "border-l-4 border-l-la-nube-primary" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {isCancelled ? (
                      <span className="line-through opacity-60">
                        <LocalDateTime
                          startMs={occ.occurrenceDateMs}
                          endMs={
                            occ.occurrenceDateMs + (occ.endMs - occ.startMs)
                          }
                        />
                      </span>
                    ) : isRescheduled ? (
                      <span className="flex flex-wrap items-center gap-2">
                        {/* Only the original date is available for rescheduled (no original end time in EventOccurrence). */}
                        <span className="line-through opacity-60">
                          <LocalDate ms={occ.occurrenceDateMs} />
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <LocalDateTime
                          startMs={occ.startMs}
                          endMs={occ.endMs}
                        />
                      </span>
                    ) : (
                      <LocalDateTime startMs={occ.startMs} endMs={occ.endMs} />
                    )}

                    {isCancelled && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        Cancelada
                      </span>
                    )}
                    {isRescheduled && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        Reprogramada
                      </span>
                    )}
                  </div>

                  {occ.reason && (
                    <p className="text-xs text-muted-foreground">
                      {occ.reason}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 6.2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6.3: Manual verification**

Start the dev server and create a test event in the admin. Then:

1. Visit `http://localhost:3000/events/<the-event-id>` — should show the detail page.
2. Visit `http://localhost:3000/events/nonexistent` — should show the Next.js 404 page.
3. On the landing page, verify:
   - Cards render in a grid (not carousel).
   - Each card is clickable and navigates to the detail page.
   - "Inscribirme" button navigates to the form, not the detail page.
   - Asterisk badge appears on cards with exceptions (create a session exception in admin to test).
   - Footnote appears below the grid when at least one asterisk card is visible.
   - Prev/Next pagination appears when total > pageSize.

- [ ] **Step 6.4: Commit**

```bash
git add src/app/(public)/events/
git -c commit.gpgsign=false commit -m "feat: add public event detail page with full session agenda"
```
