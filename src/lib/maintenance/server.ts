import "server-only";
import { nowMs } from "@/lib/clock";
import { prisma } from "@/lib/prisma";
import type { MaintenanceWindow } from "@/generated/prisma/client";
import type { MaintenanceInput } from "@/lib/schemas/maintenance";
import {
  isAreaSuspended,
  isGlobalReadOnly,
  windowState,
  type MaintenanceSnapshot,
  type MaintenanceWindowView,
  type StatefulWindow,
} from "./evaluate";

/**
 * Cuánto antes de empezar se anuncia una ventana programada. Más allá, no se muestra: un
 * cartel con tres semanas de anticipación se vuelve ruido.
 */
export const ANNOUNCE_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;

export function toView(row: MaintenanceWindow): MaintenanceWindowView {
  const n = (v: bigint | null) => (v == null ? null : Number(v));
  return {
    id: row.id,
    title: row.title,
    reasonMd: row.reasonMd,
    mode: row.mode,
    areas: row.areas,
    startsAt: n(row.startsAt),
    endsAt: n(row.endsAt),
    endedAt: n(row.endedAt),
  };
}

function withState(row: MaintenanceWindow, at: number): StatefulWindow {
  const view = toView(row);
  return { ...view, state: windowState(view, at) };
}

/**
 * Lo que se muestra y se aplica **ahora**: las ventanas vigentes y las programadas que
 * empiezan dentro de {@link ANNOUNCE_AHEAD_MS}. Una sola consulta a una tabla chica. Es lo
 * que sirve `GET /api/maintenance` (el aviso del sitio y el middleware).
 */
export async function getMaintenanceSnapshot(): Promise<MaintenanceSnapshot> {
  const at = nowMs();
  const rows = await prisma.maintenanceWindow.findMany({
    where: {
      endedAt: null,
      OR: [{ endsAt: null }, { endsAt: { gt: BigInt(at) } }],
    },
    orderBy: { createdAt: "asc" },
  });
  const windows = rows
    .map((r) => withState(r, at))
    .filter(
      (w) =>
        w.state === "active" ||
        (w.state === "scheduled" &&
          w.startsAt != null &&
          w.startsAt - at <= ANNOUNCE_AHEAD_MS),
    );
  return { now: at, windows };
}

// Para código de servidor que lo consulta seguido (un bucle de correos): un vistazo de unos
// segundos alcanza y evita una consulta por destinatario.
const SERVER_TTL_MS = 5_000;
let serverCache: { at: number; value: MaintenanceSnapshot } | null = null;

/** El snapshot con una caché de {@link SERVER_TTL_MS}. Nunca lanza: ante un fallo, "sin mantenimiento". */
export async function getMaintenanceSnapshotCached(): Promise<MaintenanceSnapshot> {
  const t = Date.now();
  if (serverCache && t - serverCache.at < SERVER_TTL_MS) {
    return serverCache.value;
  }
  try {
    const value = await getMaintenanceSnapshot();
    serverCache = { at: t, value };
    return value;
  } catch {
    // Que la tabla no responda no debe tumbar lo que la consulta: se sigue como si no hubiera.
    return { now: nowMs(), windows: [] };
  }
}

/** Descarta la caché de este proceso (después de escribir). */
export function invalidateMaintenanceCache(): void {
  serverCache = null;
}

export type AdminMaintenanceWindow = StatefulWindow & {
  createdAt: number;
  updatedAt: number;
};

/** Todas las ventanas (también las terminadas, que son el historial), las más nuevas primero. */
export async function listMaintenanceWindows(): Promise<
  AdminMaintenanceWindow[]
> {
  const at = nowMs();
  const rows = await prisma.maintenanceWindow.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    ...withState(r, at),
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
  }));
}

export async function getMaintenanceWindow(
  id: string,
): Promise<MaintenanceWindow | null> {
  return prisma.maintenanceWindow.findUnique({ where: { id } });
}

const big = (v: number | null) => (v == null ? null : BigInt(v));

export async function createMaintenanceWindow(
  input: MaintenanceInput,
): Promise<MaintenanceWindow> {
  const row = await prisma.maintenanceWindow.create({
    data: {
      title: input.title,
      reasonMd: input.reasonMd,
      mode: input.mode,
      areas: input.areas,
      startsAt: big(input.startsAt),
      endsAt: big(input.endsAt),
    },
  });
  invalidateMaintenanceCache();
  return row;
}

export async function updateMaintenanceWindow(
  id: string,
  input: MaintenanceInput,
): Promise<MaintenanceWindow> {
  const row = await prisma.maintenanceWindow.update({
    where: { id },
    data: {
      title: input.title,
      reasonMd: input.reasonMd,
      mode: input.mode,
      areas: input.areas,
      startsAt: big(input.startsAt),
      endsAt: big(input.endsAt),
      updatedAt: BigInt(nowMs()),
    },
  });
  invalidateMaintenanceCache();
  return row;
}

/** "Finalizar ahora": queda en el historial con la hora a la que se cortó. */
export async function endMaintenanceWindow(
  id: string,
): Promise<MaintenanceWindow> {
  const at = BigInt(nowMs());
  const row = await prisma.maintenanceWindow.update({
    where: { id },
    data: { endedAt: at, updatedAt: at },
  });
  invalidateMaintenanceCache();
  return row;
}

/**
 * ¿Hay una ventana que apaga los correos de eventos a participantes? (área `event-emails`).
 * Los senders la consultan y, si es así, **omiten el envío sin reintento** (decisión de
 * producto, milestone 22): lo que importa del cambio sigue visible en la página del evento
 * y, para quien tiene cuenta, en la campanita dentro de la app — que no se toca.
 */
export async function areEventEmailsSuspended(): Promise<boolean> {
  const { windows } = await getMaintenanceSnapshotCached();
  return isAreaSuspended(windows, "event-emails");
}

/** La ventana de solo lectura global vigente, o `null`. La mira el cron y las tools del conector. */
export async function getGlobalReadOnlyWindow(): Promise<StatefulWindow | null> {
  const { windows } = await getMaintenanceSnapshotCached();
  return isGlobalReadOnly(windows);
}
