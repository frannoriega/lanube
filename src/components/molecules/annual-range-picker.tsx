"use client";

/**
 * Selector de **rango anual** (mes + día, sin año) para las ventanas que se repiten cada año
 * — los temas del landing: "del 20 de diciembre al 6 de enero, cada año" (milestone 16).
 *
 * Reemplaza los dos `MonthDayPicker` (selects de mes y de día para "Desde" y otros dos para
 * "Hasta"): cuatro controles para elegir un rango, sin ver el rango. Ahora es el mismo
 * calendario de rango de shadcn que usan los eventos y los temas de fecha única
 * (`DateRangePicker`), con dos diferencias porque el año no existe:
 * - El encabezado muestra solo el mes ("diciembre"), y no se muestran los días de la semana
 *   (un 20 de diciembre no cae siempre el mismo día).
 * - Una ventana puede **cruzar el fin de año**: se elige el inicio en diciembre, se avanza a
 *   enero y se elige el fin. Internamente se dibuja sobre años de referencia
 *   (`annualRangeToDates`), pero lo que se guarda es solo `"MM-DD"`.
 *
 * Mismo comportamiento de clicks que `DateRangePicker`: el primero fija el inicio, el
 * segundo el fin (si es anterior, se invierten), y un click sobre un rango completo empieza
 * uno nuevo.
 */

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  annualDefaultMonth,
  annualRangeToDates,
  dateToMonthDay,
  formatAnnualRange,
  formatMonthDay,
  monthName,
} from "@/lib/landing-themes/month-day";
import { cn } from "@/lib/utils";
import { CalendarRange } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

export interface AnnualRangeValue {
  /** `"MM-DD"` o vacío. */
  start: string;
  /** `"MM-DD"` o vacío. */
  end: string;
}

export function AnnualRangePicker({
  value,
  onChange,
  id,
  ariaLabel,
  placeholder = "Elegí desde qué día hasta qué día",
}: {
  value: AnnualRangeValue;
  onChange: (value: AnnualRangeValue) => void;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  /*
   * La fecha **realmente clickeada** como inicio. El valor guardado no tiene año, y al
   * redibujarlo sobre el año de referencia podría quedar en otro año que el que se está
   * mirando (p. ej. se eligió diciembre de 2023 en la vista); el segundo click se compara
   * contra esta fecha, no contra la reconstruida.
   */
  const [anchor, setAnchor] = useState<Date | null>(null);
  const dates = annualRangeToDates(value.start, value.end);
  const partialFrom = !value.end ? (anchor ?? dates.from) : dates.from;
  const selected: DateRange | undefined = partialFrom
    ? { from: partialFrom, to: value.end ? dates.to : undefined }
    : undefined;

  const label =
    formatAnnualRange(value.start, value.end) ??
    (value.start ? `Desde el ${formatMonthDay(value.start)}…` : null);

  const handleSelect = (_range: DateRange | undefined, clicked: Date) => {
    const startingFresh = !value.start || (value.start && value.end);
    const base = anchor ?? dates.from;
    if (startingFresh || !base) {
      setAnchor(clicked);
      onChange({ start: dateToMonthDay(clicked), end: "" });
      return;
    }
    // El calendario es continuo (dic → ene avanza de año): si el segundo click es anterior
    // al primero en el calendario, se invierten; si es posterior, aunque "MM-DD" quede
    // menor (cruza el fin de año), es un rango válido.
    const [from, to] = clicked < base ? [clicked, base] : [base, clicked];
    setAnchor(null);
    onChange({ start: dateToMonthDay(from), end: dateToMonthDay(to) });
    setOpen(false);
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
          numberOfMonths={2}
          defaultMonth={annualDefaultMonth(value.start, value.end)}
          selected={selected}
          onSelect={handleSelect}
          autoFocus
          className="p-2"
          formatters={{
            formatCaption: (month) =>
              monthName(month).replace(/^./, (c) => c.toUpperCase()),
          }}
          classNames={{ weekdays: "hidden" }}
        />
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Se repite todos los años. Para cruzar el fin de año, elegí el inicio
          en diciembre y avanzá hasta enero.
        </p>
      </PopoverContent>
    </Popover>
  );
}
