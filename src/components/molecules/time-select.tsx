"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** "00:00", "00:15", … "23:45" — 24h times on a 15-minute grid. */
const QUARTER_HOURS: string[] = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

/**
 * Time-of-day picker in 15-minute steps (24h HH:mm). Times here are wall-clock scheduling
 * config (admin timezone), so no locale/timezone conversion — the value is the HH:mm the
 * schema expects. An off-grid saved value (e.g. from an older free-form input) is preserved
 * by prepending it to the options so edit mode never loses the time.
 */
export function TimeSelect({
  value,
  onChange,
  id,
  ariaLabel,
  isEnd = false,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  /**
   * Selector de una hora de **fin**: `00:00` va al final de la lista (es la medianoche que cierra
   * el día, las 24:00) en lugar de al principio, donde sería un fin antes del inicio.
   */
  isEnd?: boolean;
}) {
  const grid = isEnd
    ? [...QUARTER_HOURS.slice(1), QUARTER_HOURS[0]]
    : QUARTER_HOURS;
  const options = value && !grid.includes(value) ? [value, ...grid] : grid;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={ariaLabel} className="w-full">
        <SelectValue placeholder="Hora" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((t) => (
          <SelectItem key={t} value={t}>
            {isEnd && t === "00:00" ? "00:00 (medianoche)" : t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
