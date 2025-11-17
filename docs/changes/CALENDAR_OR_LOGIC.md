# Calendar OR Logic Implementation

## 📋 Overview

Implemented smart reservation filtering for calendar views using OR logic to show:
- ✅ **APPROVED** reservations (occupied space - blocks everyone)
- ✅ **User's own** reservations (PENDING or APPROVED - so users can see their bookings)

## 🎯 The Problem

Users need to see on the calendar:
1. **Occupied time slots** - Where space is already taken (APPROVED reservations)
2. **Their own reservations** - Including PENDING ones awaiting approval

Without this, users couldn't see their pending reservations on the calendar!

## ✅ The Solution

### New Function: `getExpandedReservationsForCalendar`

**Location**: `src/lib/db/reservations.ts`

```typescript
export async function getExpandedReservationsForCalendar(
  resourceId: string,
  userId: string,
  startTime: Date,
  endTime: Date
): Promise<ExpandedReservationOccurrence[]>
```

**Query Logic**:
```typescript
where: {
  resourceId,
  startTime: { lt: endTime },
  endTime: { gt: startTime },
  OR: [
    { status: "APPROVED" },  // All approved reservations
    {
      // User's own pending/approved reservations
      reservableType: "USER",
      reservableId: userId,
      status: { in: ["PENDING", "APPROVED"] },
    },
  ],
}
```

### What This Returns

For a given resource and time range:
1. **All APPROVED reservations** (regardless of who made them)
2. **User's PENDING reservations** (only theirs)
3. **User's APPROVED reservations** (only theirs)

**Example**:
```
Calendar for Meeting Room on Monday:

10:00 - 11:00: John's APPROVED booking → ✅ Shows (blue)
11:00 - 12:00: Your PENDING booking → ✅ Shows (yellow)
12:00 - 13:00: Your APPROVED booking → ✅ Shows (green)
13:00 - 14:00: Sarah's PENDING booking → ❌ Doesn't show
14:00 - 15:00: Tom's APPROVED booking → ✅ Shows (blue)
```

## 🎨 Visual Differentiation

The calendar now uses color coding:

### Blue (Default) - Other's Approved Reservations
```css
bg-la-nube-primary
```
- Someone else's approved reservation
- Space is occupied
- User cannot book here

### Green - User's Approved Reservations
```css
bg-green-600 + ✓ checkmark
```
- User's own approved reservation
- Space is occupied (by them)
- Shows with checkmark for recognition

### Yellow - User's Pending Reservations
```css
bg-yellow-500 + ⏳ hourglass
```
- User's own pending reservation (awaiting approval)
- Not yet confirmed
- Shows with hourglass icon

## 📊 Legend Display

The calendar includes a visual legend:

```
┌─────────────────────────────────────────────────────┐
│ Legend:                                             │
│ 🔵 Reserva aprobada                                │
│ 🟢 Tu reserva aprobada ✓                           │
│ 🟡 Tu reserva pendiente ⏳                         │
└─────────────────────────────────────────────────────┘
```

Only shown when `userId` is provided to the component.

## 🔧 Technical Implementation

### API Layer

Updated both API endpoints:
- `src/app/api/meeting-room/route.ts`
- `src/app/api/resources/[type]/route.ts`

**Changes**:
```typescript
// Before: Only APPROVED reservations
const { occurrences } = await listExpandedReservations({
  resourceId,
  status: ["APPROVED"],
  ...
});

// After: APPROVED OR user's own
const occurrences = await getExpandedReservationsForCalendar(
  resourceId,
  user.registeredUser.id,  // Pass user ID
  startDate,
  endDate
);
```

### Component Layer

Updated `WeekCalendar` component:

**New Prop**:
```typescript
interface WeekCalendarProps {
  // ... existing props
  userId?: string; // Current user's ID for visual differentiation
}
```

**Visual Rendering**:
```typescript
const isOwnReservation = userId && 
  occ.reservableType === "USER" && 
  occ.reservableId === userId;
  
const isPending = occ.status === "PENDING";

const bgColor = isOwnReservation && isPending
  ? "bg-yellow-500"        // User's pending
  : isOwnReservation
  ? "bg-green-600"          // User's approved
  : "bg-la-nube-primary";   // Other's approved
```

### Page Layer

All resource pages now fetch and pass `userId`:

**Added to each page**:
```typescript
const [userId, setUserId] = useState<string | null>(null);

const fetchUserId = async () => {
  const response = await fetch("/api/user/profile");
  const data = await response.json();
  setUserId(data.id);
};

<WeekCalendar
  userId={userId || undefined}
  // ... other props
/>
```

## 🔄 Data Flow

```
1. User loads calendar page
   ↓
2. Page fetches user's registered user ID
   ↓
3. Page requests reservations from API
   ↓
4. API calls getExpandedReservationsForCalendar(resourceId, userId, ...)
   ↓
5. Function queries with OR logic:
   - status = APPROVED (all users)
   - OR reservableId = userId AND status IN (PENDING, APPROVED)
   ↓
6. Results include:
   - All approved reservations (occupied space)
   - User's pending/approved reservations
   ↓
7. Calendar renders with color coding:
   - Blue: Other's approved
   - Green: User's approved
   - Yellow: User's pending
```

## 📝 Benefits

### For Users

1. **See occupied space** - All approved reservations show (blue)
2. **Track their bookings** - Their pending reservations show (yellow)
3. **Visual confirmation** - Their approved reservations show (green with ✓)
4. **Clear indicators** - Icons show status at a glance

### For the System

1. **Accurate availability** - Shows truly occupied time slots
2. **User feedback** - Users see their pending requests
3. **No confusion** - Clear visual differentiation
4. **Efficient queries** - Single query with OR logic

## 🧪 Testing Scenarios

### Scenario 1: User with Pending Reservation

**Setup**:
- Monday 10:00-11:00: Your PENDING reservation
- Monday 14:00-15:00: Someone's APPROVED reservation

**Calendar Shows**:
- 10:00-11:00: Yellow block with ⏳ (your pending)
- 14:00-15:00: Blue block (occupied)

### Scenario 2: User with Approved Reservation

**Setup**:
- Tuesday 10:00-12:00: Your APPROVED reservation
- Tuesday 14:00-15:00: Someone's APPROVED reservation

**Calendar Shows**:
- 10:00-12:00: Green block with ✓ (your approved)
- 14:00-15:00: Blue block (occupied)

### Scenario 3: Overlapping Reservations

**Setup**:
- Wednesday 10:00-11:00: Your PENDING reservation
- Wednesday 10:00-11:00: Someone's APPROVED reservation (conflict!)

**Calendar Shows**:
- Both blocks visible (stacked or overlapping)
- Yellow (yours) + Blue (theirs)
- Visual indication of conflict

## 🎨 Visual Examples

### Before (Only APPROVED)
```
Monday Calendar:
09:00 ┌──────────────────┐
10:00 │ John (APPROVED)  │ ← Shows (blue)
11:00 └──────────────────┘
12:00 (Your PENDING)       ← Hidden! ❌
13:00
14:00 ┌──────────────────┐
15:00 │ Sarah (APPROVED) │ ← Shows (blue)
16:00 └──────────────────┘
```

### After (APPROVED OR Yours)
```
Monday Calendar:
09:00 ┌──────────────────┐
10:00 │ John (APPROVED)  │ ← Shows (blue)
11:00 └──────────────────┘
12:00 ┌──────────────────┐
13:00 │ Yours (PENDING)⏳│ ← Shows (yellow) ✅
14:00 └──────────────────┘
15:00 ┌──────────────────┐
16:00 │ Sarah (APPROVED) │ ← Shows (blue)
17:00 └──────────────────┘
```

## 🔐 Security Considerations

### Server-Side Filtering

The OR logic is applied on the server, ensuring:
- Users can only see their OWN pending reservations
- Cannot see other users' pending reservations
- All approved reservations visible (public information)

### Privacy

- **Your pending**: Only you can see
- **Your approved**: Everyone can see
- **Others' approved**: Everyone can see
- **Others' pending**: Hidden from you

## 📚 Related Functions

```typescript
// For general queries (admin, reports, etc.)
listExpandedReservations(filters, options)

// For calendar views (user-specific OR logic)
getExpandedReservationsForCalendar(resourceId, userId, start, end)

// For user's own reservations only
getUserReservations(userId, options)
getExpandedUserReservations(userId, options)
```

## ✅ Summary

**Implemented**: Smart OR logic for calendar reservation display

**Shows**:
- 🔵 All approved reservations (occupied space)
- 🟢 User's approved reservations (with visual indicator)
- 🟡 User's pending reservations (awaiting approval)

**Hides**:
- ❌ Other users' pending reservations (privacy)
- ❌ Rejected/cancelled reservations

**Result**: Users can see accurate availability while tracking their own booking status! 🎉

