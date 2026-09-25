"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";

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

/** "yyyy-MM-dd" → "dd/mm/yyyy" deterministically (no locale/TZ). */
function formatKey(key?: string): string | null {
  if (!key) return null;
  const [y, m, d] = key.split("-");
  if (!y || !m || !d) return null;
  return `${d}/${m}/${y}`;
}

interface DatePickerProps {
  /** "yyyy-MM-dd" value, or "" when unset. */
  value: string;
  onChange: (value: string) => void;
  today?: Date;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Single date picker: a Popover trigger showing "dd/mm/yyyy" over a one-month shadcn Calendar.
 * Consumes/emits "yyyy-MM-dd" keys, matching the look of {@link DateRangePicker} and
 * {@link DateTimePicker} without a time component.
 */
export function DatePicker({
  value,
  onChange,
  today,
  id,
  ariaLabel,
  placeholder = "Elegí una fecha",
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const label = formatKey(value);

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
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{label ?? placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          showOutsideDays={false}
          today={today}
          defaultMonth={keyToDate(value) ?? today}
          selected={keyToDate(value)}
          onSelect={(d) => {
            onChange(d ? dateToKey(d) : "");
            setOpen(false);
          }}
          autoFocus
          className="p-2"
        />
      </PopoverContent>
    </Popover>
  );
}
