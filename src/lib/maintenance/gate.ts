/**
 * El "portero" del mantenimiento (milestone 22): lo que corre `src/middleware.ts` ante cada
 * pedido a `/api/**`. Decide **sin tocar ninguna ruta** si un pedido pasa o responde 503, a
 * partir de las ventanas vigentes y las reglas puras de `evaluate.ts`.
 *
 * Sin base de datos ni imports de servidor: el middleware corre en el runtime edge, que no
 * puede abrir una conexión de Prisma. Por eso las ventanas se leen con un `fetch` al propio
 * `GET /api/maintenance?fresh=1`, y se recuerdan {@link OK_TTL_MS} en memoria del proceso.
 *
 * ⚠️ **Falla abierto**: si no se pudo leer (la base caída, un timeout) el pedido pasa. La
 * alternativa es que un problema con el aviso de mantenimiento tumbe todo el sitio. Se
 * recuerda el fallo {@link FAIL_TTL_MS} para no martillar un endpoint que no responde.
 */
import { MAINTENANCE_AREAS, MAINTENANCE_AREA_IDS } from "./areas";
import {
  EMPTY_SNAPSHOT,
  MAINTENANCE_CODE,
  blockedMessage,
  findBlockingWindow,
  pathMatches,
  type MaintenanceSnapshot,
} from "./evaluate";

export const OK_TTL_MS = 15_000;
export const FAIL_TTL_MS = 5_000;
export const PROBE_TIMEOUT_MS = 1_500;

/** La ruta que sirve el estado: nunca se consulta a sí misma (recursión) ni se bloquea. */
export const PROBE_PATH = "/api/maintenance";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const AREA_PATH_PREFIXES: readonly string[] = MAINTENANCE_AREA_IDS.flatMap(
  (id) => MAINTENANCE_AREAS[id].paths as readonly string[],
);

/**
 * ¿Vale la pena consultar las ventanas para este pedido? Los que escriben, siempre (la solo
 * lectura global los alcanza); las lecturas, solo si caen bajo el prefijo de un área (un
 * área `UNAVAILABLE` frena también los GET). Así la mayoría de las lecturas —casi todo el
 * tráfico— no cuesta nada.
 */
export function needsMaintenanceCheck(
  method: string,
  pathname: string,
): boolean {
  if (pathMatches(pathname, PROBE_PATH)) return false;
  if (!SAFE_METHODS.has(method.toUpperCase())) return true;
  return AREA_PATH_PREFIXES.some((p) => pathMatches(pathname, p));
}

type Cached = { at: number; ttl: number; snapshot: MaintenanceSnapshot };

/**
 * Lector de ventanas con caché en memoria y una sola consulta en vuelo. `fetchSnapshot` y
 * `now` se inyectan para poder probar la caché y el "falla abierto" sin red.
 */
export function createSnapshotLoader(
  fetchSnapshot: () => Promise<MaintenanceSnapshot>,
  now: () => number = Date.now,
) {
  let cached: Cached | null = null;
  let inflight: Promise<MaintenanceSnapshot> | null = null;

  return async function load(): Promise<MaintenanceSnapshot> {
    if (cached && now() - cached.at < cached.ttl) return cached.snapshot;
    inflight ??= fetchSnapshot()
      .then((snapshot) => {
        cached = { at: now(), ttl: OK_TTL_MS, snapshot };
        return snapshot;
      })
      .catch(() => {
        cached = { at: now(), ttl: FAIL_TTL_MS, snapshot: EMPTY_SNAPSHOT };
        return EMPTY_SNAPSHOT;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };
}

/** El cuerpo del 503, o `null` si el pedido pasa. Puro: lo prueban los tests. */
export function maintenanceBlock(
  snapshot: MaintenanceSnapshot,
  method: string,
  pathname: string,
): { message: string; code: string } | null {
  const w = findBlockingWindow(snapshot.windows, method, pathname);
  return w ? { message: blockedMessage(w), code: MAINTENANCE_CODE } : null;
}

/**
 * Tope de lectores en memoria (milestone 25, S4). El origen sale del header `Host`; detrás de un
 * proxy que lo reenvíe tal cual (VPS), cada `Host` inventado creaba un lector nuevo para siempre.
 * Un deploy real tiene uno o dos orígenes (dominio y quizás `www`).
 */
const MAX_LOADERS = 8;

/**
 * El origen al que el middleware le pregunta por las ventanas. Por defecto, el del pedido (en
 * Vercel el `Host` tiene que ser un dominio del deploy, así que es confiable, y cada preview se
 * pregunta a sí mismo). En un VPS conviene fijarlo con `MAINTENANCE_PROBE_ORIGIN` (p. ej.
 * `http://127.0.0.1:3000`): así un `Host` arbitrario no puede hacer que el servidor haga pedidos
 * a otro lado (SSRF, milestone 25 S4). Ver el runbook del milestone 22.
 */
export function probeOrigin(requestOrigin: string): string {
  return process.env.MAINTENANCE_PROBE_ORIGIN?.trim() || requestOrigin;
}

/** Lector real, atado al origen (el `fetch` va a la propia app). */
const loaders = new Map<string, ReturnType<typeof createSnapshotLoader>>();

export function loadSnapshotFor(
  requestOrigin: string,
): Promise<MaintenanceSnapshot> {
  const origin = probeOrigin(requestOrigin);
  let loader = loaders.get(origin);
  if (!loader) {
    // `Map` en orden de inserción: se descarta el lector más viejo.
    while (loaders.size >= MAX_LOADERS) {
      const oldest = loaders.keys().next().value;
      if (oldest === undefined) break;
      loaders.delete(oldest);
    }
    loader = createSnapshotLoader(async () => {
      const res = await fetch(`${origin}${PROBE_PATH}?fresh=1`, {
        cache: "no-store",
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`maintenance probe ${res.status}`);
      return (await res.json()) as MaintenanceSnapshot;
    });
    loaders.set(origin, loader);
  }
  return loader();
}
