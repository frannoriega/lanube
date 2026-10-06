"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarRange } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

export interface DateRangeValue {
  from?: string;
  to?: string;
}

/** "yyyy-MM-dd" calendar key for a Date, from its local components (no timezone shift). */
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

/** "yyyy-MM-dd" → "dd/mm/yyyy" deterministically (admin scheduling format, no locale/TZ). */
function formatKey(key?: string): string | null {
  if (!key) return null;
  const [y, m, d] = key.split("-");
  if (!y || !m || !d) return null;
  return `${d}/${m}/${y}`;
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** Allow clearing back to an empty range (used by filters, not the event form). */
  clearable?: boolean;
  placeholder?: string;
  numberOfMonths?: number;
  id?: string;
  ariaLabel?: string;
  className?: string;
  /**
   * Server-aligned "today" so the calendar's highlight + the empty-state default month match
   * the server clock (matters under faketime, where the browser is on the real date).
   */
  today?: Date;
}

/**
 * Range date picker: a Popover trigger showing the selected dd/mm/yyyy range over a
 * two-month shadcn Calendar in range mode. Selecting a start then an end fills the range
 * automatically. Dates are exchanged as "yyyy-MM-dd" keys (admin-timezone scheduling).
 */
export function DateRangePicker({
  value,
  onChange,
  clearable = false,
  placeholder = "Elegí las fechas",
  numberOfMonths = 2,
  id,
  ariaLabel,
  className,
  today,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  /** Primer clic de un rango a medio elegir ("yyyy-MM-dd"); `undefined` = el próximo clic abre un rango. */
  const [anchor, setAnchor] = useState<string | undefined>();

  const selected: DateRange | undefined = value.from
    ? { from: keyToDate(value.from), to: keyToDate(value.to) }
    : undefined;

  const fromLabel = formatKey(value.from);
  const toLabel = formatKey(value.to);
  const label = fromLabel
    ? toLabel && toLabel !== fromLabel
      ? `${fromLabel} – ${toLabel}`
      : fromLabel
    : null;

  // Explicit two-click range selection (react-day-picker's default "extend nearest edge"
  // behaviour is confusing): the 1st click sets the start, the 2nd sets the end (auto-ordered),
  // and a click on an already-complete range starts a fresh range. The popover stays open
  // until both ends are chosen. `triggerDate` is the day that was actually clicked.
  //
  // El primer clic se recuerda en `anchor` (estado propio) en vez de deducirlo de `value`:
  // un formulario que normaliza el valor al recibirlo (p. ej. `to ?? from`, como el de días
  // cerrados) hacía que el picker viera un rango completo y el segundo clic empezara otro,
  // por lo que nunca se podía elegir más de un día.
  const handleSelect = (_range: DateRange | undefined, triggerDate: Date) => {
    if (!anchor) {
      const key = dateToKey(triggerDate);
      setAnchor(key);
      onChange({ from: key, to: undefined });
      return;
    }
    let from = keyToDate(anchor)!;
    let to = triggerDate;
    if (to < from) [from, to] = [to, from];
    onChange({ from: dateToKey(from), to: dateToKey(to) });
    setAnchor(undefined);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Cerrar a medio elegir descarta el primer clic: al reabrir se empieza de cero.
        if (!next) setAnchor(undefined);
        setOpen(next);
      }}
    >
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
          <CalendarRange className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{label ?? placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          showOutsideDays={false}
          numberOfMonths={numberOfMonths}
          today={today}
          defaultMonth={keyToDate(value.from) ?? today}
          selected={selected}
          onSelect={handleSelect}
          autoFocus
          className="p-2"
        />
        {clearable && value.from && (
          <div className="flex justify-end border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange({ from: undefined, to: undefined });
                setOpen(false);
              }}
            >
              Limpiar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
