# Reservations CRUD Guide

This guide explains how to use the comprehensive reservation management system with support for recurring reservations.

## Table of Contents

1. [Overview](#overview)
2. [Types](#types)
3. [CREATE Operations](#create-operations)
4. [READ Operations](#read-operations)
5. [UPDATE Operations](#update-operations)
6. [DELETE Operations](#delete-operations)
7. [Utility Functions](#utility-functions)
8. [Recurring Reservations](#recurring-reservations)
9. [Examples](#examples)

## Overview

The reservation system supports:

- ✅ Single (non-recurring) reservations
- ✅ Recurring reservations with rrule support
- ✅ Reservation exceptions (cancel or modify specific occurrences)
- ✅ Polymorphic reservables (USER, TEAM, ORGANIZATION, EVENT)
- ✅ Automatic capacity checking using PostgreSQL functions
- ✅ Resource availability validation
- ✅ Comprehensive filtering and pagination

## Types

### ReservationWithRelations

Full reservation object with all relations (resources, users, check-ins, exceptions).

### ExpandedReservationOccurrence

Individual occurrence of a reservation (for recurring reservations, this represents a single instance).

```typescript
interface ExpandedReservationOccurrence {
  reservationId: string;
  occurrenceDate: Date;
  occurrenceStartTime: Date;
  occurrenceEndTime: Date;
  reservableType: ReservableType;
  reservableId: string;
  resourceId: string | null;
  eventType: EventType;
  reason: string;
  deniedReason: string | null;
  status: ReservationStatus;
  isRecurring: boolean;
  isException: boolean;
  exceptionCancelled: boolean;
  rrule: string | null;
  recurrenceEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

## CREATE Operations

### Create a Simple Reservation

```typescript
import { createReservation } from "@/lib/db/reservations";

const reservation = await createReservation({
  reservableType: "USER",
  reservableId: "user_123",
  resourceId: "resource_456",
  eventType: "MEETING",
  reason: "Team standup meeting",
  startTime: new Date("2025-10-15T10:00:00Z"),
  endTime: new Date("2025-10-15T11:00:00Z"),
});
```

### Create a Recurring Reservation

```typescript
import { createReservation } from "@/lib/db/reservations";

// Weekly meeting every Monday for 3 months
const recurringReservation = await createReservation({
  reservableType: "TEAM",
  reservableId: "team_789",
  resourceId: "meeting_room_1",
  eventType: "MEETING",
  reason: "Weekly team sync",
  startTime: new Date("2025-10-14T10:00:00Z"), // Monday
  endTime: new Date("2025-10-14T11:00:00Z"),
  isRecurring: true,
  rrule: "FREQ=WEEKLY;INTERVAL=1",
  recurrenceEnd: new Date("2026-01-14T11:00:00Z"),
});
```

### Supported RRULE Formats

- `FREQ=DAILY;INTERVAL=1` - Every day
- `FREQ=DAILY;INTERVAL=2` - Every 2 days
- `FREQ=WEEKLY;INTERVAL=1` - Every week
- `FREQ=WEEKLY;INTERVAL=2` - Every 2 weeks (biweekly)
- `FREQ=MONTHLY;INTERVAL=1` - Every month
- `FREQ=YEARLY;INTERVAL=1` - Every year
- `FREQ=HOURLY;INTERVAL=1` - Every hour

### Create a Reservation Exception

Cancel or modify a specific occurrence of a recurring reservation:

```typescript
import { createReservationException } from "@/lib/db/reservations";

// Cancel a specific occurrence
await createReservationException(
  "reservation_123",
  new Date("2025-10-21T10:00:00Z"), // The date to cancel
  {
    isCancelled: true,
    reason: "Holiday - office closed",
  }
);

// Modify a specific occurrence
await createReservationException(
  "reservation_123",
  new Date("2025-10-28T10:00:00Z"), // The date to modify
  {
    isCancelled: false,
    newStartTime: new Date("2025-10-28T14:00:00Z"), // Changed time
    newEndTime: new Date("2025-10-28T15:00:00Z"),
    reason: "Moved to afternoon due to conflict",
  }
);
```

## READ Operations

### Get a Single Reservation

```typescript
import { getReservationById } from "@/lib/db/reservations";

const reservation = await getReservationById("reservation_123");
```

### List Reservations (Base Table)

Lists reservations from the database (recurring reservations appear as single records):

```typescript
import { listReservations } from "@/lib/db/reservations";

const { reservations, total } = await listReservations(
  {
    reservableType: "USER",
    reservableId: "user_123",
    status: ["PENDING", "APPROVED"],
    startTimeFrom: new Date("2025-10-01"),
    startTimeTo: new Date("2025-10-31"),
  },
  {
    limit: 20,
    offset: 0,
    orderBy: { startTime: "asc" },
  }
);
```

### List Expanded Reservations (With Recurring Instances)

**⭐ NEW: Uses PostgreSQL function to expand recurring reservations into individual occurrences**

```typescript
import { listExpandedReservations } from "@/lib/db/reservations";

// Get all reservation occurrences (expanded recurring reservations)
const { occurrences, total } = await listExpandedReservations(
  {
    reservableType: "USER",
    reservableId: "user_123",
    status: ["PENDING", "APPROVED"],
    startTimeFrom: new Date("2025-10-01"),
    startTimeTo: new Date("2025-10-31"),
  },
  {
    limit: 20,
    offset: 0,
  }
);

// Each occurrence is a separate entry
occurrences.forEach((occ) => {
  console.log(
    `${occ.occurrenceStartTime} - ${occ.occurrenceEndTime}`,
    occ.isRecurring ? "(part of recurring series)" : "(single)"
  );
});
```

### Get User Reservations

```typescript
import { getUserReservations } from "@/lib/db/reservations";

// Get future reservations only
const { reservations, total } = await getUserReservations("user_123", {
  includeExpired: false,
  status: ["APPROVED"],
  limit: 10,
  offset: 0,
});
```

### Get Expanded User Reservations

```typescript
import { getExpandedUserReservations } from "@/lib/db/reservations";

// Get all occurrences of user's reservations (including recurring instances)
const { occurrences, total } = await getExpandedUserReservations("user_123", {
  includeExpired: false,
  status: ["APPROVED"],
  limit: 50,
  offset: 0,
});
```

### Get Resource Reservations

Check what reservations exist for a resource in a time range:

```typescript
import { getResourceReservations } from "@/lib/db/reservations";

const reservations = await getResourceReservations(
  "resource_456",
  new Date("2025-10-15T00:00:00Z"),
  new Date("2025-10-15T23:59:59Z"),
  ["PENDING", "APPROVED"]
);
```

### Get Expanded Resource Reservations

Check all occurrences (including recurring) for a resource:

```typescript
import { getExpandedResourceReservations } from "@/lib/db/reservations";

const occurrences = await getExpandedResourceReservations(
  "resource_456",
  new Date("2025-10-15T00:00:00Z"),
  new Date("2025-10-31T23:59:59Z"),
  ["PENDING", "APPROVED"]
);
```

### Get Upcoming Reservations

```typescript
import { getUpcomingReservations } from "@/lib/db/reservations";

const upcoming = await getUpcomingReservations("USER", "user_123", 10);
```

### Get Expanded Upcoming Reservations

Get upcoming occurrences (including recurring instances):

```typescript
import { getExpandedUpcomingReservations } from "@/lib/db/reservations";

const upcoming = await getExpandedUpcomingReservations("USER", "user_123", 10);
```

## UPDATE Operations

### Update a Reservation

```typescript
import { updateReservation } from "@/lib/db/reservations";

const updated = await updateReservation("reservation_123", {
  startTime: new Date("2025-10-15T11:00:00Z"),
  endTime: new Date("2025-10-15T12:00:00Z"),
  reason: "Updated meeting time",
});
```

### Approve a Reservation

```typescript
import { approveReservation } from "@/lib/db/reservations";

const approved = await approveReservation("reservation_123");
```

### Reject a Reservation

```typescript
import { rejectReservation } from "@/lib/db/reservations";

const rejected = await rejectReservation(
  "reservation_123",
  "Resource is not available at this time"
);
```

### Cancel a Reservation

```typescript
import { cancelReservation } from "@/lib/db/reservations";

const cancelled = await cancelReservation("reservation_123");
```

## DELETE Operations

### Delete a Reservation

**Note:** Cannot delete reservations that have already started.

```typescript
import { deleteReservation } from "@/lib/db/reservations";

await deleteReservation("reservation_123");
```

### Delete a Reservation Exception

```typescript
import { deleteReservationException } from "@/lib/db/reservations";

await deleteReservationException("exception_123");
```

## Utility Functions

### Check Resource Availability

Uses the PostgreSQL function `check_availability_with_actor` to validate capacity:

```typescript
import { checkResourceAvailability } from "@/lib/db/reservations";

const isAvailable = await checkResourceAvailability(
  "resource_456",
  "TEAM",
  "team_789",
  new Date("2025-10-15T10:00:00Z"),
  new Date("2025-10-15T11:00:00Z")
);

if (isAvailable) {
  // Create reservation
}
```

### Get Actor Size

Gets the number of people represented by a reservable entity:

```typescript
import { getActorSize } from "@/lib/db/reservations";

const userSize = await getActorSize("USER", "user_123"); // Returns 1
const teamSize = await getActorSize("TEAM", "team_789"); // Returns team member count
const orgSize = await getActorSize("ORGANIZATION", "org_456"); // Returns org member count
```

### Get Reservation Statistics

```typescript
import { getReservationStats } from "@/lib/db/reservations";

const stats = await getReservationStats(
  new Date("2025-10-01"),
  new Date("2025-10-31"),
  {
    eventType: "MEETING",
  }
);

console.log(stats);
// {
//   total: 150,
//   byStatus: { PENDING: 20, APPROVED: 100, REJECTED: 10, CANCELLED: 20 },
//   byEventType: { MEETING: 150 },
//   byReservableType: { USER: 100, TEAM: 40, ORGANIZATION: 10 }
// }
```

### Check if User Has Active Reservations

```typescript
import { hasActiveReservations } from "@/lib/db/reservations";

const hasActive = await hasActiveReservations("user_123");
```

### Get Conflicting Reservations

Find reservations that overlap with a time range:

```typescript
import { getConflictingReservations } from "@/lib/db/reservations";

const conflicts = await getConflictingReservations(
  "resource_456",
  new Date("2025-10-15T10:00:00Z"),
  new Date("2025-10-15T11:00:00Z")
);
```

## Recurring Reservations

### How Recurring Reservations Work

1. **Storage**: Recurring reservations are stored as a single record with `isRecurring=true` and an `rrule` field.

2. **Expansion**: When querying with `listExpandedReservations()`, the PostgreSQL function `expand_recurring_reservations` uses `generate_series` to create individual occurrences.

3. **Exceptions**: You can cancel or modify specific occurrences using `createReservationException()`.

4. **Filtering**: The expansion function respects all filters (date ranges, status, etc.).

### When to Use Regular vs Expanded Queries

**Use Regular Queries (`listReservations`)** when:

- You want to manage the reservation records themselves
- You're building admin interfaces to edit recurring patterns
- You need to update the base reservation

**Use Expanded Queries (`listExpandedReservations`)** when:

- You want to display a calendar view
- You need to show all individual occurrences
- You're checking availability for specific dates
- You're building user-facing UIs to see their schedule

## Examples

### Example 1: Create and List Recurring Reservations

```typescript
// Create a daily recurring meeting for 2 weeks
const reservation = await createReservation({
  reservableType: "USER",
  reservableId: "user_123",
  resourceId: "meeting_room_1",
  eventType: "MEETING",
  reason: "Daily standup",
  startTime: new Date("2025-10-14T09:00:00Z"),
  endTime: new Date("2025-10-14T09:30:00Z"),
  isRecurring: true,
  rrule: "FREQ=DAILY;INTERVAL=1",
  recurrenceEnd: new Date("2025-10-28T09:30:00Z"),
});

// List all occurrences
const { occurrences } = await listExpandedReservations({
  reservableId: "user_123",
  startTimeFrom: new Date("2025-10-14"),
  startTimeTo: new Date("2025-10-28"),
});

console.log(`Created ${occurrences.length} occurrences`);
// Output: Created 14 occurrences (10/14 through 10/27)
```

### Example 2: Cancel One Occurrence of a Recurring Reservation

```typescript
// User wants to cancel just the Friday meeting
await createReservationException(
  reservation.id,
  new Date("2025-10-17T09:00:00Z"), // Friday
  {
    isCancelled: true,
    reason: "Out of office",
  }
);

// Now list occurrences again
const { occurrences } = await listExpandedReservations({
  reservableId: "user_123",
  startTimeFrom: new Date("2025-10-14"),
  startTimeTo: new Date("2025-10-28"),
});

console.log(`Now showing ${occurrences.length} occurrences`);
// Output: Now showing 13 occurrences (Friday is excluded)
```

### Example 3: Check Resource Availability

```typescript
// Check if a resource is available for a new reservation
const startTime = new Date("2025-10-15T14:00:00Z");
const endTime = new Date("2025-10-15T15:00:00Z");

// First, check existing occurrences in that time range
const existing = await getExpandedResourceReservations(
  "meeting_room_1",
  startTime,
  endTime,
  ["APPROVED", "PENDING"]
);

if (existing.length > 0) {
  console.log("Time slot is occupied:");
  existing.forEach((occ) => {
    console.log(`  - ${occ.reason} (${occ.occurrenceStartTime})`);
  });
} else {
  // Check capacity
  const isAvailable = await checkResourceAvailability(
    "meeting_room_1",
    "TEAM",
    "team_456",
    startTime,
    endTime
  );

  if (isAvailable) {
    // Create the reservation
    await createReservation({
      reservableType: "TEAM",
      reservableId: "team_456",
      resourceId: "meeting_room_1",
      eventType: "MEETING",
      reason: "Project planning",
      startTime,
      endTime,
    });
  }
}
```

### Example 4: API Endpoint Using Expanded Reservations

```typescript
// app/api/reservations/calendar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getExpandedUserReservations } from "@/lib/db/reservations";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const { occurrences, total } = await getExpandedUserReservations(
    session.user.id,
    {
      includeExpired: false,
      status: ["APPROVED"],
      limit: 100,
    }
  );

  // Filter by date range if provided
  const filtered = occurrences.filter((occ) => {
    if (startDate && occ.occurrenceStartTime < new Date(startDate)) return false;
    if (endDate && occ.occurrenceEndTime > new Date(endDate)) return false;
    return true;
  });

  return NextResponse.json({
    occurrences: filtered,
    total,
  });
}
```

## Best Practices

1. **Always use expanded queries for calendar views** - This ensures recurring reservations are properly displayed.

2. **Validate capacity before creating reservations** - Use `checkResourceAvailability()` to prevent overbooking.

3. **Handle exceptions gracefully** - When users cancel or modify a recurring reservation occurrence, use `createReservationException()` instead of updating the base reservation.

4. **Set reasonable recurrence end dates** - Don't create recurring reservations that extend too far into the future (e.g., limit to 1 year).

5. **Consider pagination** - When querying expanded reservations over long time periods, use pagination to avoid performance issues.

6. **Use appropriate filters** - Take advantage of the filtering capabilities to reduce the data returned.

## Database Functions

The system leverages these PostgreSQL functions:

- `expand_recurring_reservations()` - Expands recurring reservations into individual occurrences
- `count_expanded_reservations()` - Counts total occurrences for pagination
- `check_availability_with_actor()` - Validates resource capacity considering actor size
- `get_actor_size()` - Returns the number of people represented by a reservable entity
- `parse_rrule_freq()` - Parses the FREQ field from an rrule
- `parse_rrule_interval()` - Parses the INTERVAL field from an rrule

## Additional Resources

- [Prisma Schema - Reservations Model](prisma/models/reservations.prisma)
- [Database Functions Migration](prisma/migrations/20251008000836_functions_and_triggers/migration.sql)
- [Expand Recurring Reservations Migration](prisma/migrations/20251012163357_expand_recurring_reservations/migration.sql)
- [iCalendar RRULE Specification](https://icalendar.org/iCalendar-RFC-5545/3-8-5-3-recurrence-rule.html)

