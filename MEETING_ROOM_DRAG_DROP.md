# 📅 Meeting Room Calendar - Google Calendar Drag & Drop Interface

## 🎯 Overview

The meeting room calendar now features a true Google Calendar-style interface with **click-and-drag** functionality for intuitive time selection.

## ✨ New Features

### 🖱️ Click and Drag Selection

Instead of clicking on fixed hourly slots, users can now:

1. **Click** anywhere on the calendar
2. **Hold and drag** to select their desired time range
3. **Release** to open the reservation dialog
4. The selected time range is automatically populated in the dialog

### ⏱️ 15-Minute Intervals

- All time selections snap to **15-minute intervals**
- Provides flexibility for meetings of any duration
- Common times: 9:00, 9:15, 9:30, 9:45, 10:00, etc.

### 📆 Same-Day Restriction

- Start and end times must be on the **same day**
- If you try to drag across days, you'll get a friendly error message
- Each reservation is contained within a single day

### 🌅 Whole Day Events

New toggle in the dialog:
- Check **"Evento de día completo"** for full-day reservations
- Automatically sets time to 9:00 AM - 6:00 PM
- Start/end time inputs are hidden when enabled
- Perfect for all-day workshops or conferences

### 🎨 Visual Feedback

#### During Drag:
- **Blue semi-transparent overlay** shows your selection in real-time
- Updates as you drag up or down
- Visual confirmation of the time range being selected

#### Existing Reservations:
- Displayed as **solid colored blocks** on the calendar
- Show reservation title and time range
- Positioned exactly where they occur in the day

#### Grid Lines:
- **Hourly lines** (darker) for major time markers
- **15-minute lines** (lighter) for precise positioning
- Makes it easy to select exact times

## 🎮 How to Use

### Creating a Reservation

1. **Navigate to the calendar**
   - Click "Sala de reuniones" in the sidebar

2. **Select your time**
   - Find the day you want
   - Click at your desired start time
   - Hold and drag down to your end time
   - Release the mouse button

3. **Fill in details**
   - Dialog opens with your selected time
   - Toggle "Evento de día completo" if needed
   - Adjust start/end times if needed (in 15-min increments)
   - Select event type (Reunión, Taller, Conferencia, Otro)
   - Enter a description

4. **Create**
   - Click "Crear Reserva"
   - Your reservation appears on the calendar immediately

### Modifying Times in Dialog

Even after dragging, you can still adjust times:

```
Start Time: [09:30] ▼
End Time:   [11:45] ▼
```

- Use the time inputs to make fine adjustments
- Both inputs support 15-minute steps
- Constrained to business hours (9 AM - 6 PM)

### Whole Day Events

For full-day reservations:

1. Drag any selection (the initial drag doesn't matter)
2. In the dialog, toggle **"Evento de día completo"**
3. Time inputs disappear
4. Reservation automatically set to 9 AM - 6 PM

## 🎨 Visual Design

### Calendar Layout

```
┌────────────────────────────────────────────────────────────┐
│  Hora  │   LUN 14  │   MAR 15  │   MIÉ 16  │   JUE 17  │   VIE 18  │
├────────┼───────────┼───────────┼───────────┼───────────┼───────────┤
│ 09:00  │           │           │           │           │           │
│        │           │  ┌──────┐ │           │           │           │
│        │           │  │ Team │ │           │           │           │
│ 10:00  │           │  │ Mtg  │ │           │           │           │
│        │           │  └──────┘ │           │           │           │
│ 11:00  │           │           │           │           │           │
│        │           │           │           │  ┌──────┐ │           │
│ 12:00  │           │           │           │  │ Lunch│ │           │
│        │           │           │           │  │ Mtg  │ │           │
│ 13:00  │           │           │           │  └──────┘ │           │
│        │           │           │           │           │           │
│ 14:00  │  ┌────────────────┐  │           │           │           │
│        │  │   Workshop     │  │           │           │           │
│ 15:00  │  │   (dragging)   │  │           │           │           │
│        │  │                │  │           │           │           │
│ 16:00  │  └────────────────┘  │           │           │           │
│        │           │           │           │           │           │
│ 17:00  │           │           │           │           │           │
│        │           │           │           │           │           │
└────────┴───────────┴───────────┴───────────┴───────────┴───────────┘
```

### Color Scheme

| Element | Color | Description |
|---------|-------|-------------|
| Available space | White/Dark | Empty calendar space you can drag on |
| Drag selection | Blue (50% opacity) | Your current selection while dragging |
| Existing reservation | Primary color (solid) | Booked time slots |
| Past time | Gray | Disabled, cannot select |
| Hour lines | Gray (medium) | Major time markers |
| 15-min lines | Gray (light) | Fine grid lines |

## 🔧 Technical Implementation

### Mouse Event Handling

The calendar uses three mouse events:

```typescript
// Start dragging
onMouseDown(e, dayIndex) => {
  - Calculate position
  - Check if not in past
  - Set drag start point
}

// Update selection
onMouseMove(e, dayIndex) => {
  - Only if dragging
  - Update current position
  - Constrain to same day
}

// Finish selection
onMouseUp() => {
  - Calculate final range
  - Validate minimum 15 minutes
  - Open dialog with times
}
```

### Position Calculation

```typescript
// Convert mouse Y position to time
1. Get mouse Y relative to calendar
2. Calculate percentage of total height
3. Convert to minutes (9 AM - 6 PM = 540 minutes)
4. Round to nearest 15 minutes
5. Clamp to business hours
```

### Time Snapping

All times snap to 15-minute intervals:

```typescript
roundedMinutes = Math.round(minutes / 15) * 15
```

This ensures clean, predictable selections like:
- 9:00, 9:15, 9:30, 9:45
- 10:00, 10:15, 10:30, 10:45
- etc.

### State Management

```typescript
// Drag state
isDragging: boolean          // Are we currently dragging?
dragStart: Position | null   // Where did the drag start?
dragCurrent: Position | null // Where is the cursor now?
selection: DragSelection     // Final selected range

// Dialog state
dialogOpen: boolean          // Is dialog visible?
isWholeDay: boolean          // Full day event?
startTime: string            // "HH:mm" format
endTime: string              // "HH:mm" format
```

## ✅ Validation Rules

### Client-Side Validation

1. **Same Day**
   ```typescript
   if (!isSameDay(dragStart.day, dragCurrent.day)) {
     error("Las reservas deben estar en el mismo día")
   }
   ```

2. **Minimum Duration**
   ```typescript
   if (endMinutes - startMinutes < 15) {
     error("La reserva mínima es de 15 minutos")
   }
   ```

3. **Business Hours**
   ```typescript
   if (startMinutes < 540 || endMinutes > 1080) {
     error("Solo entre 9:00 AM y 6:00 PM")
   }
   ```

4. **No Past Reservations**
   ```typescript
   if (selectedDateTime < now) {
     error("No puedes reservar en el pasado")
   }
   ```

5. **Start Before End**
   ```typescript
   if (startTime >= endTime) {
     error("La hora de inicio debe ser anterior")
   }
   ```

### Server-Side Validation

All client validations are also enforced on the server:
- Same validations in API route
- Additional resource availability check
- Database-level constraints

## 🎯 User Experience Improvements

### Before (Slot-based)
- Click on predefined hourly slots
- Limited to 1-4 hour durations
- Fixed start times
- Less flexible

### After (Drag-based)
- ✅ Drag to select any time range
- ✅ 15-minute precision
- ✅ Any duration (minimum 15 min)
- ✅ Start at any quarter-hour
- ✅ Visual real-time feedback
- ✅ More intuitive and flexible

## 📱 Responsive Design

### Desktop
- Full calendar width
- Smooth drag interactions
- Precise mouse positioning

### Tablet
- Horizontal scroll if needed
- Touch-friendly drag areas
- Larger hit targets

### Mobile
- Optimized touch interactions
- Scrollable calendar
- Adjusted grid size

## 🔍 Accessibility

- **Keyboard Support**: Time inputs support keyboard entry
- **Screen Readers**: Proper labels on all form elements
- **Visual Feedback**: Clear indication of selection state
- **Error Messages**: Descriptive validation messages

## 🧪 Testing Scenarios

### Basic Drag Operations
- [ ] Click and drag down (forward in time)
- [ ] Click and drag up (backward in time)
- [ ] Very short drag (< 15 min) - should error
- [ ] Long drag (multiple hours) - should work
- [ ] Release outside calendar - should cancel

### Cross-Day Dragging
- [ ] Start on Monday, drag to Tuesday - should error
- [ ] Drag near day boundary - should constrain to same day

### Time Boundaries
- [ ] Drag starting before 9 AM - should clamp to 9:00
- [ ] Drag ending after 6 PM - should clamp to 18:00
- [ ] Drag entirely outside business hours - should error

### Whole Day Events
- [ ] Toggle whole day on - times disappear
- [ ] Toggle whole day off - times reappear
- [ ] Create whole day event - saves as 9 AM - 6 PM

### Dialog Adjustments
- [ ] Change start time in dialog
- [ ] Change end time in dialog
- [ ] Enter invalid times (start > end) - should error
- [ ] Enter times outside business hours - should error

### Existing Reservations
- [ ] Reservations display correctly
- [ ] Can drag over existing reservations (API will validate)
- [ ] Hover shows reservation details

## 🐛 Known Edge Cases

### 1. Overlapping Reservations
**Behavior**: You can drag over existing reservations  
**Reason**: Client allows it, server validation will catch conflicts  
**User Experience**: Error message after clicking "Create"

**Potential Enhancement**: Visual warning if dragging over occupied space

### 2. Mouse Leaves Calendar While Dragging
**Behavior**: Drag is cancelled  
**Solution**: `onMouseLeave` handler resets drag state

### 3. Rapid Click-Release (No Drag)
**Behavior**: Needs minimum 15-minute selection  
**User Experience**: Error message "La reserva mínima es de 15 minutos"

### 4. Timezone Handling
**Behavior**: All times are in user's local timezone  
**Server**: Converts to UTC for storage  
**Display**: Converts back to local for display

## 🚀 Future Enhancements

### Possible Improvements

1. **Multi-Day Events**
   - Allow dragging across multiple days
   - Create separate reservations per day
   - Or support true multi-day events

2. **Drag to Resize**
   - Drag bottom of existing reservation to extend
   - Drag top to change start time

3. **Drag to Move**
   - Drag entire reservation block to new time
   - Preserves duration, changes time

4. **Visual Conflict Warning**
   - Show red outline if dragging over occupied space
   - Warn before attempting to create

5. **Quick Time Presets**
   - Buttons for common durations (30 min, 1 hour, 2 hours)
   - One-click to create at specific time

6. **Color-Coded Event Types**
   - Different colors for Meetings, Workshops, etc.
   - Legend showing what each color means

7. **Recurring Reservations**
   - "Repeat weekly" option in dialog
   - Create multiple reservations at once

8. **Availability Indicator**
   - Show available/busy status
   - Aggregate view of team availability

## 📊 Performance Considerations

### Optimizations

1. **Event Handler Efficiency**
   - `useCallback` for all mouse handlers
   - Prevents unnecessary re-renders
   - Stable function references

2. **Position Calculations**
   - Memoized where possible
   - Cached bounding rectangles
   - Minimal DOM measurements

3. **Render Optimization**
   - Only re-render affected day columns
   - CSS transforms for smooth animations
   - No layout thrashing

### Potential Bottlenecks

- **Many Reservations**: 100+ reservations may slow rendering
- **Fast Dragging**: Rapid mouse movement generates many events
- **Large Screens**: Very tall calendars need more calculations

**Mitigations**:
- Throttle mouse move events if needed
- Virtual scrolling for very long time ranges
- Limit visible time range (currently 9 AM - 6 PM is manageable)

## 🎓 Learning Resources

### Mouse Events
- [MDN: MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent)
- [Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)

### Date Handling
- [date-fns documentation](https://date-fns.org/)
- Time zone considerations

### React Patterns
- `useCallback` for event handlers
- `useRef` for DOM measurements
- Controlled components for forms

## 📞 Troubleshooting

### Issue: Drag doesn't work

**Possible causes**:
1. JavaScript disabled
2. Mouse events not firing
3. Calendar ref not attached

**Debug**:
```javascript
console.log('isDragging:', isDragging)
console.log('dragStart:', dragStart)
console.log('dragCurrent:', dragCurrent)
```

### Issue: Times are off by 15 minutes

**Cause**: Rounding logic or timezone conversion

**Check**:
- Verify rounding: `Math.round(minutes / 15) * 15`
- Check timezone settings
- Inspect server response

### Issue: Can't select certain times

**Possible causes**:
1. Past time (disabled)
2. Outside business hours (9 AM - 6 PM)
3. Weekend (not supported)

**Verify**:
- Check current date/time
- Verify business hours config
- Ensure day is Monday-Friday

## ✅ Summary

The new drag-and-drop interface provides:

- 🎯 **Intuitive Selection**: Natural click-and-drag interaction
- ⏱️ **Precision**: 15-minute interval snapping
- 📊 **Visual Feedback**: Real-time selection preview
- 🎨 **Professional Look**: Google Calendar-style appearance
- ✅ **Flexible**: Any duration, adjustable in dialog
- 🌅 **Whole Day Support**: One toggle for full-day events
- 🔒 **Validated**: Comprehensive client and server validation

**Result**: A modern, user-friendly meeting room booking experience! 🎉

