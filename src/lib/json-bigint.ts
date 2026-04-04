/** Recursively convert bigint values to JSON-safe numbers for API responses. */
export function serializeJson<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
  ) as T;
}
