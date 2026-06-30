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
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
}) {
  const options =
    value && !QUARTER_HOURS.includes(value)
      ? [value, ...QUARTER_HOURS]
      : QUARTER_HOURS;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={ariaLabel} className="w-full">
        <SelectValue placeholder="Hora" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((t) => (
          <SelectItem key={t} value={t}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
