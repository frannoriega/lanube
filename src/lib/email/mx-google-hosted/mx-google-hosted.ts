import dns from "node:dns/promises";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const RESOLVE_TIMEOUT_MS = 3000;

type CacheEntry = { value: boolean; expiresAt: number };
const mxCache = new Map<string, CacheEntry>();

function isGoogleMxExchange(exchange: string): boolean {
  const h = exchange.trim().toLowerCase().replace(/\.$/, "");
  return (
    h.endsWith(".google.com") || h.endsWith(".googleusercontent.com")
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("mx_timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * True when `ENABLE_MX_GOOGLE_HOSTED_DETECTION` is set and the domain's lowest-priority MX
 * targets look like Google's. On failure or timeout, returns false (do not strip dots).
 */
export async function isDomainGoogleHostedByMx(domain: string): Promise<boolean> {
  if (process.env.ENABLE_MX_GOOGLE_HOSTED_DETECTION !== "true") {
    return false;
  }

  const d = domain.trim().toLowerCase();
  const now = Date.now();
  const hit = mxCache.get(d);
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  let google = false;
  try {
    const records = await withTimeout(dns.resolveMx(d), RESOLVE_TIMEOUT_MS);
    if (records.length > 0) {
      const minPriority = Math.min(...records.map((r) => r.priority));
      const primary = records.filter((r) => r.priority === minPriority);
      google = primary.some((r) => isGoogleMxExchange(r.exchange));
    }
  } catch {
    google = false;
  }

  mxCache.set(d, { value: google, expiresAt: now + CACHE_TTL_MS });
  return google;
}

/** Test helper: clear in-memory MX cache. */
export function clearMxGoogleHostedCacheForTests(): void {
  mxCache.clear();
}
