function formatDateFull(date: Date): string {
  return new Date(date).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formateWeekday(date: Date): string {
  return toCapitalCase(
    new Date(date).toLocaleDateString("es-AR", {
      weekday: "long",
    }),
  );
}

/**
 * Parses a YYYY-MM-DD string as local midnight.
 * Avoids the UTC-midnight trap: new Date("2025-01-03") is Jan 2 evening in UTC-3.
 */
function parseDateStringLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeShort(date: Date): string {
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toCapitalCase(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export {
  formatDateFull,
  formateWeekday,
  formatDate,
  formatTime,
  formatTimeShort,
  parseDateStringLocal,
};
