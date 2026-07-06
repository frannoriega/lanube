/**
 * Minimal JSON API client shared by `useApi` and mutation call sites.
 *
 * GET requests are deduplicated (concurrent callers share one in-flight
 * request) and cached briefly, so several components mounting at once — or
 * React Strict Mode double-effects in dev — produce a single network call.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, fallback = "Error de servidor") {
    // Routes answer with either `{ message }` or `{ error }`.
    let message = fallback;
    if (body !== null && typeof body === "object") {
      const b = body as { message?: unknown; error?: unknown };
      if (typeof b.message === "string") message = b.message;
      else if (typeof b.error === "string") message = b.error;
    }
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** Extracts a user-facing message from an unknown error. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback;
}

const DEFAULT_TTL_MS = 10_000;

type CacheEntry = { data: unknown; at: number };

const inflight = new Map<string, Promise<unknown>>();
const cache = new Map<string, CacheEntry>();

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body);
  }
  return body as T;
}

/**
 * Typed GET with in-flight dedup and a short shared cache.
 * `force` skips the cache (still joins an in-flight request if one exists).
 */
export function apiGet<T>(
  url: string,
  opts: { ttlMs?: number; force?: boolean } = {},
): Promise<T> {
  const { ttlMs = DEFAULT_TTL_MS, force = false } = opts;
  if (!force) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at <= ttlMs) {
      return Promise.resolve(hit.data as T);
    }
  }
  const pending = inflight.get(url);
  if (pending) {
    return pending as Promise<T>;
  }
  const request = requestJson<T>(url, { cache: "no-store" })
    .then((data) => {
      cache.set(url, { data, at: Date.now() });
      return data;
    })
    .finally(() => {
      inflight.delete(url);
    });
  inflight.set(url, request);
  return request;
}

/** Drops cached GET responses whose URL starts with `prefix` ("" clears all). */
export function invalidateApi(prefix = ""): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/** Typed mutation. Throws `ApiError` carrying the server's `message`. */
export function apiSend<TResponse = unknown, TBody = unknown>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: TBody,
): Promise<TResponse> {
  return requestJson<TResponse>(url, {
    method,
    headers:
      body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
