# Week Navigation Fix: Centralized State Management

## 🐛 The Problem

The calendar had a critical architectural flaw where **state was duplicated** across components:

### Before (Broken Architecture)

```
Page Component:
├── weekStart state (managed here)
├── occurrences state (managed here)
├── loading state (managed here)
├── fetchReservations() (calls API)
└── passes occurrences to WeekCalendar

WeekCalendar Component:
├── currentWeekStart state (managed here too!)
├── Week navigation buttons (change currentWeekStart)
└── Displays occurrences
```

**Issues**:

- ❌ **Duplicate state**: Two components managing week start independently
- ❌ **Out of sync**: When WeekCalendar changes week, Page doesn't know
- ❌ **No refetch**: Clicking "Siguiente" changes WeekCalendar's week but doesn't fetch new data
- ❌ **Wrong initial week**: Pages use `startOfWeek()` which doesn't handle weekends
- ❌ **Complex**: Pages had 40+ lines of state management and fetching logic

### After (Fixed Architecture)

```
Page Component:
├── userId state (for visual differentiation)
├── handleCreateReservation() (calls API)
└── passes configuration to WeekCalendar

WeekCalendar Component:
├── currentWeekStart state (single source of truth)
├── occurrences state (manages its own data)
├── loading state (manages its own loading)
├── fetchReservations() (fetches when week changes)
└── Week navigation buttons (work correctly!)
```

**Benefits**:

- ✅ **Single state**: WeekCalendar owns all calendar state
- ✅ **Always in sync**: Week changes trigger automatic refetch
- ✅ **Correct initialization**: Uses `getCurrentWorkWeekStart()` which handles weekends
- ✅ **Simple pages**: Pages reduced from ~150 lines to ~115 lines
- ✅ **Self-contained**: WeekCalendar is truly reusable

## 🔧 Implementation

### WeekCalendar Component Changes

#### New Props

```typescript
interface WeekCalendarProps {
  resourceType: string;      // "MEETING", "COWORKING", etc.
  apiEndpoint: string;       // "/api/meeting-room", etc.
  onCreateReservation: ...
  // ... other config
}
```

#### Removed Props

```typescript
// No longer needed from parent:
- occurrences: ReservationOccurrence[]
- loading?: boolean
- currentWeekStart: Date
- onWeekChange: (weekStart: Date) => void
```

#### Added Internal State

```typescript
const [occurrences, setOccurrences] = useState<ReservationOccurrence[]>([]);
const [loading, setLoading] = useState(true);
```

#### Added Fetch Logic

```typescript
useEffect(() => {
  const fetchReservations = async () => {
    setLoading(true);
    try {
      const weekEnd = addDays(currentWeekStart, 4); // Friday
      weekEnd.setHours(23, 59, 59, 999);

      const response = await fetch(
        `${apiEndpoint}?startDate=${currentWeekStart.toISOString()}&endDate=${weekEnd.toISOString()}`,
      );

      if (response.ok) {
        const data = await response.json();
        setOccurrences(data.occurrences || []);
      }
    } finally {
      setLoading(false);
    }
  };

  fetchReservations();
}, [currentWeekStart, apiEndpoint]); // ← Refetches when week changes!
```

### Page Component Simplification

#### Before (Meeting Room Example - 150 lines)

```typescript
export default function MeetingRoomPage() {
  const [occurrences, setOccurrences] = useState<ReservationOccurrence[]>([]);
  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Set weekStart
    if (!weekStart) {
      setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));  // ❌ Wrong!
    }
    // Fetch userId
  }, [weekStart, userId]);

  useEffect(() => {
    // Fetch reservations when weekStart changes
    if (!weekStart) return;
    fetchReservations();
  }, [weekStart]);

  const fetchReservations = async () => {
    // ... 20 lines of fetching logic
  };

  const fetchUserId = async () => {
    // ... fetch userId
  };

  return (
    <WeekCalendar
      occurrences={occurrences}
      loading={loading}
      currentWeekStart={weekStart!}
      onWeekChange={setWeekStart}  // ❌ But WeekCalendar has its own state!
      // ... other props
    />
  );
}
```

#### After (Meeting Room - 115 lines)

```typescript
export default function MeetingRoomPage() {
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Only fetch userId
    if (!userId) fetchUserId();
  }, [userId]);

  const fetchUserId = async () => {
    // ... fetch userId
  };

  return (
    <WeekCalendar
      resourceType="MEETING"        // ✅ Just pass type
      apiEndpoint="/api/meeting-room"  // ✅ Just pass endpoint
      userId={userId}
      // ... other config
    />
  );
}
```

**Code reduction**: ~35 lines per page (23% reduction)

## ✅ What This Fixes

### Issue 1: Weekend Detection

**Before**: Pages used `startOfWeek()` which shows past week on weekends
**After**: WeekCalendar uses `getCurrentWorkWeekStart()` which shows next week on weekends

### Issue 2: Week Navigation

**Before**: Clicking "Siguiente" changed WeekCalendar's week but didn't refetch data
**After**: Week changes trigger automatic refetch via useEffect

### Issue 3: Duplicate State

**Before**: Page and WeekCalendar both managed week state (out of sync)
**After**: WeekCalendar is the single source of truth

### Issue 4: Complex Pages

**Before**: Pages had 40+ lines of state management and API logic
**After**: Pages are simple configuration wrappers

## 📊 Behavior Comparison

### Scenario: User Clicks "Siguiente"

**Before**:

```
1. User clicks "Siguiente" button
2. WeekCalendar updates currentWeekStart internally
3. Page's weekStart state unchanged
4. fetchReservations() not called (uses old weekStart)
5. Calendar shows new week but OLD data
6. ❌ Broken!
```

**After**:

```
1. User clicks "Siguiente" button
2. WeekCalendar updates currentWeekStart internally
3. useEffect triggers on currentWeekStart change
4. fetchReservations() called automatically with NEW week
5. Calendar shows new week with CORRECT data
6. ✅ Works perfectly!
```

### Scenario: Page Loads on Weekend

**Before**:

```
Page: weekStart = startOfWeek(now)  // e.g., Mon Oct 6
WeekCalendar: currentWeekStart = getCurrentWorkWeekStart()  // e.g., Mon Oct 13
Result: ❌ Out of sync
```

**After**:

```
WeekCalendar: currentWeekStart = getCurrentWorkWeekStart()  // Mon Oct 13
fetchReservations() called automatically
Result: ✅ Correct week shown
```

## 🎯 Files Changed

### Updated

1. `src/components/organisms/calendar/WeekCalendar.tsx`
   - Added `resourceType` and `apiEndpoint` props
   - Removed `occurrences`, `loading`, `currentWeekStart`, `onWeekChange` props
   - Added internal state for `occurrences` and `loading`
   - Added `useEffect` to fetch reservations when week changes
   - Added `reservableId` to `ReservationOccurrence` interface

2. `src/app/(management)/user/meeting-room/page.tsx`
   - Removed `occurrences`, `weekStart`, `loading` state
   - Removed `fetchReservations()` function
   - Removed week-related useEffect
   - Simplified to ~115 lines (from ~150)

3. `src/app/(management)/user/coworking/page.tsx`
   - Same simplifications as meeting-room

4. `src/app/(management)/user/lab/page.tsx`
   - Same simplifications as meeting-room

5. `src/app/(management)/user/auditorium/page.tsx`
   - Same simplifications as meeting-room

## ✅ Benefits Summary

### Correctness

- ✅ Week navigation works correctly
- ✅ Data refetches when week changes
- ✅ Weekend detection works properly
- ✅ No state synchronization issues

### Performance

- ✅ Fetches data only when needed (week changes)
- ✅ No duplicate API calls
- ✅ Efficient re-renders

### Code Quality

- ✅ 23% less code per page
- ✅ Clearer separation of concerns
- ✅ Easier to maintain
- ✅ Easier to test

### User Experience

- ✅ Navigation buttons work correctly
- ✅ Correct week shown on weekends
- ✅ Reservations appear immediately after creation
- ✅ No confusing "empty calendar" when data should be there

## 🚀 Result

**The calendar is now a truly self-contained, reusable component!**

Pages just need to:

1. Pass `resourceType` and `apiEndpoint`
2. Pass `userId` for visual differentiation
3. Provide event types configuration
4. Handle reservation creation callback

That's it! WeekCalendar handles everything else. 🎉

## 📝 Usage Example

```typescript
<WeekCalendar
  resourceType="COWORKING"
  apiEndpoint="/api/resources/coworking"
  onCreateReservation={handleCreateReservation}
  eventTypes={EVENT_TYPES}
  defaultEventType="OTHER"
  title="Nueva Reserva"
  userId={userId}
/>
```

**Clean, simple, and it works!** ✨
