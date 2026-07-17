"use client";

import { TimeSelect } from "@/components/molecules/time-select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarClock } from "lucide-react";
import { useState } from "react";

/** Split a "YYYY-MM-DDTHH:mm" datetime-local string into its date + time parts. */
function splitValue(value: string): { dateKey: string; time: string } {
  const [date = "", time = ""] = value.split("T");
  return { dateKey: date, time };
}

/** "yyyy-MM-dd" key for a Date, from its local components (no timezone shift). */
function dateToKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parse a "yyyy-MM-dd" key into a local Date (midnight), or undefined. */
function keyToDate(key?: string): Date | undefined {
  if (!key) return undefined;
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/** "YYYY-MM-DDTHH:mm" → "dd/mm/yyyy · HH:mm" deterministically (admin scheduling, no locale/TZ). */
function formatValue(value: string): string | null {
  const { dateKey, time } = splitValue(value);
  const [y, m, d] = dateKey.split("-");
  if (!y || !m || !d || !time) return null;
  return `${d}/${m}/${y} · ${time}`;
}

interface DateTimePickerProps {
  /** "YYYY-MM-DDTHH:mm" datetime-local value (admin timezone), or "" when unset. */
  value: string;
  onChange: (value: string) => void;
  /**
   * Server-aligned "today" so the calendar's highlight + the empty-state default month match
   * the server clock (matters under faketime, where the browser is on the real date).
   */
  today?: Date;
  /** Time-of-day filled in when a date is picked before any time was chosen. */
  defaultTime?: string;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Single date + time picker: a Popover trigger showing "dd/mm/yyyy · HH:mm" over a one-month
 * shadcn Calendar plus a 15-minute TimeSelect. Consumes/emits "YYYY-MM-DDTHH:mm" datetime-local
 * strings (admin timezone), matching the polished look of {@link DateRangePicker}.
 */
export function DateTimePicker({
  value,
  onChange,
  today,
  defaultTime = "09:00",
  id,
  ariaLabel,
  placeholder = "Elegí fecha y hora",
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const { dateKey, time } = splitValue(value);
  const label = formatValue(value);

  const emit = (nextDate: string, nextTime: string) => {
    // Picking a time before a date defaults the date to "today" so the value stays valid.
    const day = nextDate || (nextTime ? dateToKey(today ?? new Date()) : "");
    if (!day) {
      onChange("");
      return;
    }
    onChange(`${day}T${nextTime || defaultTime}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={ariaLabel ?? placeholder}
          className={cn(
            "w-full justify-start gap-2 font-normal",
            !label && "text-muted-foreground",
            className,
          )}
        >
          <CalendarClock className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{label ?? placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          showOutsideDays={false}
          today={today}
          defaultMonth={keyToDate(dateKey) ?? today}
          selected={keyToDate(dateKey)}
          onSelect={(d) => d && emit(dateToKey(d), time)}
          autoFocus
          className="p-2"
        />
        <div className="space-y-1.5 border-t p-3">
          <Label className="text-xs text-muted-foreground">Hora</Label>
          <TimeSelect
            value={time}
            onChange={(t) => emit(dateKey, t)}
            ariaLabel={ariaLabel ? `${ariaLabel} — hora` : "Hora"}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
