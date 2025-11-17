# Meeting Room Feature - Google Calendar Style

## Overview

The Meeting Room feature provides a Google Calendar-style week view for booking meeting rooms. Users can visually see available time slots and occupied reservations in a clean, intuitive interface.

## Features

### ✨ Key Capabilities

1. **Week Calendar View**
   - Google Calendar-style grid layout
   - Shows Monday through Friday (weekdays only)
   - 9 AM to 6 PM time slots (business hours)
   - Visual distinction between available, occupied, and past slots

2. **Navigation**
   - View current week
   - Navigate to next week (max 1 week ahead)
   - Navigate to previous week
   - "Today" button to return to current week

3. **Visual Indicators**
   - **Available slots**: White/dark background with gray border
   - **Occupied slots**: Blue background with reservation details
   - **Past slots**: Grayed out and disabled
   - **Current day**: Highlighted in primary color

4. **Reservation Creation**
   - Click on any available time slot to create a reservation
   - Simple dialog form with:
     - Duration selector (1-4 hours)
     - Event type (Meeting, Workshop, Conference, Other)
     - Reason/description
   - Automatic validation for business hours and weekdays
   - Prevents reservations in the past

5. **Real-time Updates**
   - Uses the `expand_recurring_reservations` PostgreSQL function
   - Automatically expands recurring reservations into individual occurrences
   - Shows all occupied slots from all users

## Technical Implementation

### Routes Created

1. **Page**: `/user/meeting-room`
   - Location: `src/app/(management)/user/meeting-room/page.tsx`
   - Google Calendar-style week view component

2. **API Endpoint**: `/api/meeting-room`
   - Location: `src/app/api/meeting-room/route.ts`
   - GET: Fetch expanded reservations for a week
   - POST: Create new meeting room reservation

### Database Integration

The feature uses the advanced reservation system with:

- **Fungible Resources**: Meeting rooms are managed as fungible resources of type `MEETING`
- **Expanded Reservations**: Uses the `expand_recurring_reservations()` PostgreSQL function to handle recurring bookings
- **Capacity Management**: Automatically checks resource availability using `check_availability_with_actor()`

### Key Components

```typescript
// Calendar Grid
- Header with week navigation (Previous, Today, Next)
- Time slots grid (9 AM - 6 PM)
- Day columns (Monday - Friday)
- Interactive slot buttons

// Reservation Dialog
- Duration selection
- Event type selection
- Reason textarea
- Form validation
```

## Usage

### For Users

1. **Navigate to Meeting Room**
   - Click "Sala de reuniones" in the sidebar
   - You'll see the current week's calendar

2. **View Reservations**
   - Blue slots indicate occupied time slots
   - Hover over occupied slots to see full reservation details
   - Gray slots are in the past and cannot be booked

3. **Create a Reservation**
   - Click on any available (white) time slot
   - Fill in the reservation form:
     - Select duration (1-4 hours)
     - Choose event type
     - Provide a reason/description
   - Click "Crear Reserva" to submit

4. **Navigate Weeks**
   - Use "Anterior" to view last week
   - Use "Siguiente" to view next week (max 1 week ahead)
   - Click "Hoy" to return to current week

### Business Rules

- **Hours**: 9:00 AM - 6:00 PM only
- **Days**: Monday - Friday (weekdays only)
- **Future bookings**: Can only book current week or next week
- **Duration**: 1-4 hours per reservation
- **Validation**: Cannot book:
  - Past time slots
  - Weekends
  - Outside business hours
  - Already occupied slots

## API Reference

### GET /api/meeting-room

Fetches expanded reservations for a date range.

**Query Parameters:**
- `startDate` (required): ISO 8601 date string
- `endDate` (required): ISO 8601 date string

**Response:**
```json
{
  "occurrences": [
    {
      "reservationId": "...",
      "occurrenceStartTime": "2025-10-15T10:00:00Z",
      "occurrenceEndTime": "2025-10-15T11:00:00Z",
      "reason": "Team meeting",
      "status": "APPROVED",
      "reservableType": "USER"
    }
  ],
  "capacity": 10,
  "resources": [...]
}
```

### POST /api/meeting-room

Creates a new meeting room reservation.

**Request Body:**
```json
{
  "startTime": "2025-10-15T10:00:00Z",
  "endTime": "2025-10-15T11:00:00Z",
  "reason": "Team planning session",
  "eventType": "MEETING"
}
```

**Response:**
```json
{
  "id": "...",
  "reservableType": "USER",
  "reservableId": "...",
  "resourceId": "...",
  "eventType": "MEETING",
  "reason": "Team planning session",
  "status": "PENDING",
  "startTime": "2025-10-15T10:00:00Z",
  "endTime": "2025-10-15T11:00:00Z",
  ...
}
```

## Configuration

### Navigation

The meeting room link is automatically added to the user navigation sidebar:

```typescript
// src/app/(management)/user/layout.tsx
const navigation = [
  { name: "Panel de control", href: "/user/dashboard", icon: LayoutDashboard },
  { name: "Coworking", href: "/user/coworking", icon: Building2 },
  { name: "Laboratorio", href: "/user/lab", icon: FlaskConical },
  { name: "Auditorio", href: "/user/auditorium", icon: Presentation },
  { name: "Sala de reuniones", href: "/user/meeting-room", icon: Users }, // 👈 New
]
```

### Middleware

Routes are protected by authentication middleware:

```typescript
// src/middleware.ts
export const config = {
  matcher: ["/", "/user/:path*", "/admin/:path*", "/auth/:path*"]
}
```

## Database Setup

### Required Resources

The feature requires meeting room resources to be seeded in the database:

```sql
-- Fungible resource for meeting rooms
INSERT INTO fungible_resources (id, name, type, capacity) 
VALUES ('meeting_room_group', 'Meeting Rooms', 'MEETING', 1);

-- Physical meeting room resource
INSERT INTO resources (id, name, fungible_resource_id, serial_number) 
VALUES ('meeting_room_1', 'Main Meeting Room', 'meeting_room_group', 'MR-001');
```

Make sure to run `npx prisma db seed` if these resources don't exist.

## Styling

The calendar uses Tailwind CSS with the following design tokens:

- **Primary color**: `la-nube-primary` (for highlights and occupied slots)
- **Glass effects**: `.glass-card` and `.glass-card-dark` for card backgrounds
- **Responsive grid**: 6 columns (time + 5 days)
- **Dark mode support**: Full dark mode theming

## Future Enhancements

Potential improvements for the feature:

1. **Recurring Reservations**: Allow users to create recurring meeting room bookings
2. **Multiple Rooms**: Show availability for multiple meeting rooms side by side
3. **Room Details**: Display room capacity, equipment, and amenities
4. **Conflict Resolution**: Suggest alternative time slots when preferred slot is occupied
5. **Email Notifications**: Send confirmation emails for new reservations
6. **Calendar Export**: Export reservations to iCal/Google Calendar format
7. **Room Filtering**: Filter by room features (projector, capacity, etc.)

## Troubleshooting

### Issue: No meeting rooms available

**Solution**: Ensure meeting room resources are seeded in the database. Run:
```bash
npx prisma db seed
```

### Issue: Cannot create reservation

**Possible causes**:
1. Time slot is in the past
2. Weekend or outside business hours (9 AM - 6 PM)
3. Slot already occupied
4. User not authenticated

**Solution**: Check the validation error message and adjust accordingly.

### Issue: Reservations not showing

**Possible causes**:
1. Database migration not applied
2. API endpoint returning errors
3. Date range issue

**Solution**: 
- Check migration status: `npx prisma migrate status`
- Check browser console for API errors
- Verify date parameters in the request

## Related Documentation

- [Reservations CRUD Guide](./RESERVATIONS_CRUD_GUIDE.md)
- [Database Functions](./prisma/migrations/20251012163357_expand_recurring_reservations/migration.sql)
- [Schema Structure](./prisma/SCHEMA_STRUCTURE.md)

