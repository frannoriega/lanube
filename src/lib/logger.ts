/**
 * Minimal structured logger for server code (API routes, cron, DB helpers).
 *
 * (Intentionally not marked `server-only`: it only writes to `console`, and
 * server-action modules like the email helpers — which are unit-tested in a
 * node/vitest environment — import it transitively.)
 *
 * Cost model (Vercel free/Hobby tier):
 *   - `console.*` output is captured automatically as runtime logs; the call
 *     itself is free. What costs us is *volume* — log retention is short and a
 *     noisy stream buries the lines that matter. So keep logging sparse.
 *   - In production only `error` and `warn` are emitted. `info` is dropped
 *     unless `LOG_VERBOSE=1` (a temporary debug switch) — outside production it
 *     is always on.
 *
 * Output is a single JSON line per event so it stays greppable in the Vercel
 * dashboard and is ready to forward to a log drain later without reformatting.
 */

type LogLevel = "error" | "warn" | "info";
type LogMeta = Record<string, unknown>;

const isProd = process.env.NODE_ENV === "production";
const emitInfo = !isProd || process.env.LOG_VERBOSE === "1";

/** Normalize an unknown thrown value into a loggable shape (never throws). */
function describeError(err: unknown): LogMeta {
  if (err instanceof Error) {
    return {
      error: err.name,
      message: err.message,
      // Stack is server-side only (never returned to clients) and errors are
      // rare, so the extra bytes are worth it for debugging.
      stack: err.stack,
    };
  }
  return { message: String(err) };
}

function write(level: LogLevel, msg: string, meta?: LogMeta): void {
  const line = JSON.stringify(
    { level, msg, ...meta },
    // BigInt is common in this codebase (timestamps) and would throw here.
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
  );
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  /** Unexpected failures. Always emitted. Pass the caught value as `err`. */
  error(msg: string, err?: unknown, meta?: LogMeta): void {
    write("error", msg, {
      ...(err !== undefined ? describeError(err) : {}),
      ...meta,
    });
  },
  /** Notable-but-handled conditions (e.g. an email send failed). Always emitted. */
  warn(msg: string, meta?: LogMeta): void {
    write("warn", msg, meta);
  },
  /** Routine diagnostics. Suppressed in prod unless LOG_VERBOSE=1. */
  info(msg: string, meta?: LogMeta): void {
    if (emitInfo) write("info", msg, meta);
  },
};
