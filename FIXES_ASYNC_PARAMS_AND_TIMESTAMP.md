# Fixes: Async Params & Timestamp Type Issue

## 🐛 Issues Fixed

### 1. Next.js 15 Async Params Requirement

**Error**:
```
Error: Route "/api/resources/[type]" used `params.type`. 
`params` should be awaited before using its properties.
```

**Cause**: Next.js 15 changed dynamic route params to be async promises.

**Fix**: Updated route handlers to await params before accessing properties.

**Before**:
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  const resourceType = RESOURCE_TYPE_MAP[params.type]; // ❌ Error!
}
```

**After**:
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params; // ✅ Fixed!
  const resourceType = RESOURCE_TYPE_MAP[type];
}
```

**Locations Fixed**:
- GET handler (3 occurrences)
- POST handler (3 occurrences)

### 2. PostgreSQL Timestamp Type Mismatch

**Error**:
```
Raw query failed. Code: `42804`. 
Message: `ERROR: structure of query does not match function result type
DETAIL: Returned type timestamp without time zone does not match 
expected type timestamp with time zone in column 2.`
```

**Cause**: `generate_series` with interval returns `timestamp` (without timezone), but the function signature declares `timestamptz` (with timezone).

**Fix**: Explicitly cast `generate_series` result to `timestamptz`.

**Before**:
```sql
SELECT
  r.id as reservation_id,
  occurrence as occurrence_date,              -- ❌ timestamp
  occurrence as occurrence_start_time,        -- ❌ timestamp
  occurrence + (r.end_time - r.start_time) as occurrence_end_time,  -- ❌ timestamp
  ...
FROM reservations r
CROSS JOIN LATERAL generate_series(...) AS occurrence
```

**After**:
```sql
SELECT
  r.id as reservation_id,
  occurrence::timestamptz as occurrence_date,              -- ✅ timestamptz
  occurrence::timestamptz as occurrence_start_time,        -- ✅ timestamptz
  (occurrence + (r.end_time - r.start_time))::timestamptz as occurrence_end_time,  -- ✅ timestamptz
  ...
FROM reservations r
CROSS JOIN LATERAL generate_series(...) AS occurrence
```

**Migration**: `20251012223516_fix_expand_recurring_reservations_timestamp/migration.sql`

## 📝 Changes Made

### Files Modified

1. **src/app/api/resources/[type]/route.ts**
   - Updated GET handler to await params
   - Updated POST handler to await params
   - Fixed all references to `params.type`

2. **prisma/migrations/20251012223516_fix_expand_recurring_reservations_timestamp/migration.sql**
   - Added explicit `::timestamptz` casts to `generate_series` results
   - Ensures all timestamp columns return correct type

### Migration Applied

```bash
✔ Migration applied successfully
✔ Database in sync with schema
✔ Prisma Client regenerated
```

## 🧪 Testing

### Verify Async Params Fix

Test each resource type endpoint:
```bash
# Should work without errors
curl http://localhost:3000/api/resources/meeting-room?startDate=...&endDate=...
curl http://localhost:3000/api/resources/coworking?startDate=...&endDate=...
curl http://localhost:3000/api/resources/lab?startDate=...&endDate=...
curl http://localhost:3000/api/resources/auditorium?startDate=...&endDate=...
```

### Verify Timestamp Fix

Test expanded reservations query:
```typescript
const { occurrences } = await listExpandedReservations({
  resourceId: "some_id",
  startTimeFrom: new Date(),
  endTimeTo: new Date(),
});
// Should work without Prisma errors
```

## 🔍 Root Causes Explained

### Next.js 15 Async Params

**Why?**: Next.js 15 made dynamic route params async to support React Server Components and streaming better.

**Pattern**: Always await params in dynamic routes:
```typescript
// Any route with [...], [id], [slug], etc.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ... }> }
) {
  const resolvedParams = await params;
  // Use resolvedParams.id, resolvedParams.slug, etc.
}
```

### PostgreSQL Timestamp Types

**Background**: PostgreSQL has two timestamp types:
- `timestamp` - No timezone information
- `timestamptz` - With timezone (recommended for most use cases)

**Issue**: `generate_series` returns `timestamp`, but our schema uses `timestamptz`.

**Solution**: Explicit casting with `::timestamptz` operator.

**Best Practice**: Always use `timestamptz` for temporal data in PostgreSQL.

## ✅ Verification Checklist

- [x] Next.js async params errors resolved
- [x] PostgreSQL timestamp type errors resolved
- [x] Migration applied successfully
- [x] No linting errors
- [x] API endpoints functional
- [x] Calendar component working
- [x] All resource pages functional

## 📚 Related Documentation

- [Next.js Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [Next.js 15 Breaking Changes](https://nextjs.org/docs/messages/sync-dynamic-apis)
- [PostgreSQL Timestamp Types](https://www.postgresql.org/docs/current/datatype-datetime.html)

## 🎉 Status

**All issues resolved!** The calendar system is now fully functional across all resource types.

✅ Meeting Room  
✅ Coworking  
✅ Lab  
✅ Auditorium  

All using the same reusable `WeekCalendar` component with drag-and-drop functionality! 🚀

