"use client";

import { useEffect, useState } from "react";

/**
 * Renders a UNIX-ms timestamp as a date in the *viewer's* timezone + locale — the only place
 * timezones are resolved (see the date-handling principle). The backend always speaks UTC ms.
 *
 * Hydration-safe: server and client both render empty on first paint (state starts ""), then
 * the effect fills in the localized value on the client. This avoids a UTC-vs-local mismatch
 * without freezing the displayed value to the server's locale.
 */
type LocalDateFormat = "numeric" | "dayMonth";

const FORMATS: Record<LocalDateFormat, Intl.DateTimeFormatOptions> = {
  // dd/mm/YYYY for es-AR (locale decides the order).
  numeric: { day: "2-digit", month: "2-digit", year: "numeric" },
  // "1 jul" — compact day + abbreviated month.
  dayMonth: { day: "numeric", month: "short" },
};

function format(ms: number, fmt: LocalDateFormat): string {
  return new Date(ms)
    .toLocaleDateString(undefined, FORMATS[fmt])
    .replace(".", "");
}

export function LocalDate({
  ms,
  format: fmt = "numeric",
  className,
}: {
  ms: number;
  format?: LocalDateFormat;
  className?: string;
}) {
  const [text, setText] = useState("");
  useEffect(() => setText(format(ms, fmt)), [ms, fmt]);
  return (
    <time
      dateTime={new Date(ms).toISOString()}
      className={className}
      suppressHydrationWarning
    >
      {text || " "}
    </time>
  );
}

/**
 * A start–end date range, collapsing to a single date when both fall on the same local day
 * (or when there's no end). Formatted client-side, in the viewer's timezone + locale.
 */
export function LocalDateRange({
  startMs,
  endMs,
  format: fmt = "dayMonth",
  className,
}: {
  startMs: number;
  endMs?: number | null;
  format?: LocalDateFormat;
  className?: string;
}) {
  const [text, setText] = useState("");
  useEffect(() => {
    const start = format(startMs, fmt);
    if (endMs == null) {
      setText(start);
      return;
    }
    const end = format(endMs, fmt);
    setText(end === start ? start : `${start} – ${end}`);
  }, [startMs, endMs, fmt]);
  return (
    <span className={className} suppressHydrationWarning>
      {text || " "}
    </span>
  );
}

/**
 * Renders an occurrence's start date + time range (e.g. "jue. 2 jul. 2026, 10:00 – 13:00")
 * in the viewer's timezone + locale. Hydration-safe: empty on first paint, filled on client.
 */
export function LocalDateTime({
  startMs,
  endMs,
  className,
}: {
  startMs: number;
  endMs: number;
  className?: string;
}) {
  const [text, setText] = useState("");
  useEffect(() => {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    const startStr = new Date(startMs).toLocaleString(undefined, opts);
    const endOpts: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
    };
    const endStr = new Date(endMs).toLocaleTimeString(undefined, endOpts);
    setText(`${startStr} – ${endStr}`);
  }, [startMs, endMs]);
  return (
    <time
      dateTime={new Date(startMs).toISOString()}
      className={className}
      suppressHydrationWarning
    >
      {text || " "}
    </time>
  );
}
