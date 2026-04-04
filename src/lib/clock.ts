/**
 * Server wall clock. Under Docker + libfaketime this matches Postgres `now()`.
 * Client UI should use `useServerTime()` from `@/components/providers/server-time`.
 */
export function now(): Date {
  return new Date();
}

export function nowMs(): number {
  return Date.now();
}
