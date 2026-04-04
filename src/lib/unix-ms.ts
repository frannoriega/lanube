/** UTC instant as milliseconds since Unix epoch (same convention as DB BIGINT). */

export function dateToUnixMs(d: Date): bigint {
  return BigInt(d.getTime());
}

export function unixMsToDate(ms: bigint | number): Date {
  return new Date(Number(ms));
}

export function toUnixMs(v: bigint | number | Date): bigint {
  if (v instanceof Date) return BigInt(v.getTime());
  if (typeof v === "bigint") return v;
  return BigInt(Math.trunc(v));
}
