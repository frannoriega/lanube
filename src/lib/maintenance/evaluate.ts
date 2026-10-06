/**
 * Reglas de mantenimiento (milestone 22), **puras**: reciben las ventanas y el momento, no
 * tocan la base ni el reloj. Las usan el middleware (bloquear), el servidor (omitir correos,
 * tools del conector, cron) y el cliente (aviso y formularios). Seguras para el cliente.
 */
import {
  ALL_AREA,
  MAINTENANCE_AREAS,
  READ_ONLY_EXEMPT_PREFIXES,
  isMaintenanceArea,
  type MaintenanceAreaId,
  type MaintenanceMode,
} from "./areas";

/** Una ventana tal como viaja al cliente y al middleware (todo serializable, ms UNIX). */
export type MaintenanceWindowView = {
  id: string;
  title: string;
  reasonMd: string;
  mode: MaintenanceMode;
  areas: string[];
  startsAt: number | null;
  endsAt: number | null;
  endedAt: number | null;
};

export type WindowState = "scheduled" | "active" | "ended";

/**
 * ¿En qué momento de su vida está la ventana? Terminó si se la finalizó a mano o pasó su
 * fin; es futura si todavía no llegó su inicio; si no, está vigente. Los extremos nulos son
 * "sin límite". El fin es exclusivo (a las `endsAt` ya no rige) y el inicio inclusivo.
 */
export function windowState(
  w: Pick<MaintenanceWindowView, "startsAt" | "endsAt" | "endedAt">,
  nowMs: number,
): WindowState {
  if (w.endedAt != null && w.endedAt <= nowMs) return "ended";
  if (w.endsAt != null && w.endsAt <= nowMs) return "ended";
  if (w.startsAt != null && w.startsAt > nowMs) return "scheduled";
  return "active";
}

/** Una ventana más el estado que el servidor calculó al armar la respuesta. */
export type StatefulWindow = MaintenanceWindowView & { state: WindowState };

/** Lo que devuelve `GET /api/maintenance` (y lo que consume el middleware). */
export type MaintenanceSnapshot = {
  /** Reloj del servidor al armarlo. */
  now: number;
  /** Solo vigentes y próximas (las terminadas no viajan). */
  windows: StatefulWindow[];
};

export const EMPTY_SNAPSHOT: MaintenanceSnapshot = { now: 0, windows: [] };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** ¿`pathname` es `prefix` o cuelga de él? (`/api/forms` sí es de `/api/forms/x`, no de `/api/formsx`). */
export function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Vigentes (no futuras ni terminadas). */
function activeWindows(windows: readonly StatefulWindow[]): StatefulWindow[] {
  return windows.filter((w) => w.state === "active");
}

/**
 * La ventana que frena este pedido a la API, o `null` si pasa. Orden de severidad: gana la
 * primera que bloquea; el mensaje que se muestra es el de esa ventana.
 *
 * - `all` + solo lectura: frena todo método que escribe, salvo las rutas exentas.
 * - un área de rutas + `READ_ONLY`: frena lo que escribe bajo sus prefijos.
 * - un área de rutas + `UNAVAILABLE`: frena **cualquier** método bajo sus prefijos.
 * - `NOTICE` nunca frena.
 */
export function findBlockingWindow(
  windows: readonly StatefulWindow[],
  method: string,
  pathname: string,
): StatefulWindow | null {
  const isWrite = !SAFE_METHODS.has(method.toUpperCase());
  const blocking = activeWindows(windows).filter((w) => w.mode !== "NOTICE");

  // Primero las ventanas de un área concreta: si dos frenan el mismo pedido, el mensaje
  // útil es el específico («el correo está caído»), no el genérico de la solo lectura global.
  for (const w of blocking) {
    for (const areaId of w.areas) {
      if (areaId === ALL_AREA || !isMaintenanceArea(areaId)) continue;
      const area = MAINTENANCE_AREAS[areaId];
      if (area.effect !== "paths") continue;
      if (!area.paths.some((p) => pathMatches(pathname, p))) continue;
      if (w.mode === "UNAVAILABLE" || isWrite) return w;
    }
  }

  // Después la solo lectura global, salvo en las rutas exentas.
  if (
    isWrite &&
    !READ_ONLY_EXEMPT_PREFIXES.some((p) => pathMatches(pathname, p))
  ) {
    return blocking.find((w) => w.areas.includes(ALL_AREA)) ?? null;
  }
  return null;
}

/**
 * ¿Hay una ventana vigente que impide **escribir** en esta área? Es lo que mira un
 * formulario para deshabilitarse y mostrar el motivo antes de que alguien lo complete. La
 * solo lectura global (`all`) cuenta para las áreas de rutas, no para las `code`.
 */
export function findWriteBlockForArea(
  windows: readonly StatefulWindow[],
  areaId: MaintenanceAreaId,
): StatefulWindow | null {
  const area = MAINTENANCE_AREAS[areaId];
  const blocking = activeWindows(windows).filter((w) => w.mode !== "NOTICE");

  // La ventana propia del área gana sobre la global (mismo criterio que `findBlockingWindow`).
  const own = blocking.find((w) => w.areas.includes(areaId));
  if (own) return own;

  if (area.effect !== "paths") return null;
  // La global cuenta salvo que las rutas del área estén todas exentas de la solo lectura.
  const exempt = area.paths.every((p) =>
    READ_ONLY_EXEMPT_PREFIXES.some((e) => pathMatches(p, e)),
  );
  return exempt
    ? null
    : (blocking.find((w) => w.areas.includes(ALL_AREA)) ?? null);
}

/**
 * ¿El área está apagada por una ventana con modo distinto de `NOTICE`? Para las áreas
 * `code` (los correos de eventos): `READ_ONLY` y `UNAVAILABLE` significan lo mismo, "no se
 * hace".
 */
export function isAreaSuspended(
  windows: readonly StatefulWindow[],
  areaId: MaintenanceAreaId,
): boolean {
  return activeWindows(windows).some(
    (w) => w.mode !== "NOTICE" && w.areas.includes(areaId),
  );
}

/** ¿Hay solo lectura global vigente? (El cron y las tools de escritura del conector lo miran.) */
export function isGlobalReadOnly(
  windows: readonly StatefulWindow[],
): StatefulWindow | null {
  return (
    activeWindows(windows).find(
      (w) => w.mode !== "NOTICE" && w.areas.includes(ALL_AREA),
    ) ?? null
  );
}

/** Texto 503 para la persona que chocó con una ventana. Apto para mostrar tal cual. */
export function blockedMessage(
  w: Pick<MaintenanceWindowView, "title" | "mode">,
) {
  return w.mode === "UNAVAILABLE"
    ? `Esta función no está disponible por mantenimiento: ${w.title}.`
    : `El sitio está en modo solo lectura por mantenimiento (${w.title}). Podés ver tu información, pero no hacer cambios por ahora.`;
}

/** Código que acompaña al 503 para que el cliente lo reconozca. */
export const MAINTENANCE_CODE = "MAINTENANCE";
