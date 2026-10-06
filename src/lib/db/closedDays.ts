import { nowMs } from "@/lib/clock";
import { prisma } from "@/lib/prisma";
import {
  addDaysToDateKey,
  dateKeyFromUnixMs,
} from "@/lib/admin/admin-timezone";
import { ClosedDayStatus } from "@/generated/prisma/client";
import type { ClosedDay, Prisma } from "@/generated/prisma/client";
import type { ClosedDayInput } from "@/lib/schemas/closed-days";

export type { ClosedDay };

/**
 * Los cierres **activos** que podrían tocar la ventana `[startMs, endMs)` (milestone 23).
 *
 * Filtra por fecha de calendario local, que es como se guardan: alcanza con traer los cierres
 * cuyo rango toca algún día de la ventana, y la comparación fina por franja horaria la hace
 * `findClosureForWindow` (pura, testeada). Solo `ACTIVE`: una propuesta pendiente o descartada
 * no cierra nada.
 */
export async function getActiveClosuresForWindow(
  startMs: number,
  endMs: number,
): Promise<ClosedDay[]> {
  // `endMs - 1`: una ventana que termina justo a medianoche no toca el día siguiente.
  const firstKey = dateKeyFromUnixMs(startMs);
  const lastKey = dateKeyFromUnixMs(Math.max(startMs, endMs - 1));
  return prisma.closedDay.findMany({
    where: {
      status: ClosedDayStatus.ACTIVE,
      startDate: { lte: lastKey },
      endDate: { gte: firstKey },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });
}

/** Pestañas de `/admin/closed-days`. */
export type ClosedDayScope = "upcoming" | "review" | "past";

export interface ListClosedDaysResult {
  items: ClosedDay[];
  total: number;
  /** Propuestas sin revisar: alimenta el contador de la pestaña «Por revisar». */
  pendingReview: number;
}

/**
 * Lista paginada para el panel. «Próximos» son los activos que todavía no terminaron (los que
 * hoy ya están en curso incluidos), «Por revisar» las propuestas pendientes y «Pasados» todo lo
 * que ya terminó, descartado o no. Las fechas se comparan como texto `YYYY-MM-DD`, que ordena
 * igual que el calendario.
 */
export async function listClosedDays(opts: {
  scope: ClosedDayScope;
  /** `YYYY-MM-DD` de hoy en la zona del predio. */
  todayKey: string;
  page: number;
  pageSize: number;
}): Promise<ListClosedDaysResult> {
  const { scope, todayKey, page, pageSize } = opts;
  const where: Prisma.ClosedDayWhereInput =
    scope === "review"
      ? { status: ClosedDayStatus.PENDING_REVIEW }
      : scope === "upcoming"
        ? { status: ClosedDayStatus.ACTIVE, endDate: { gte: todayKey } }
        : { endDate: { lt: todayKey } };
  const [items, total, pendingReview] = await Promise.all([
    prisma.closedDay.findMany({
      where,
      orderBy:
        scope === "past"
          ? [{ startDate: "desc" }, { createdAt: "desc" }]
          : [{ startDate: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.closedDay.count({ where }),
    prisma.closedDay.count({
      where: { status: ClosedDayStatus.PENDING_REVIEW },
    }),
  ]);
  return { items, total, pendingReview };
}

export async function getClosedDay(id: string): Promise<ClosedDay | null> {
  return prisma.closedDay.findUnique({ where: { id } });
}

export async function createClosedDay(
  input: ClosedDayInput,
): Promise<ClosedDay> {
  return prisma.closedDay.create({
    data: {
      title: input.title,
      startDate: input.startDate,
      endDate: input.endDate,
      startTime: input.startTime,
      endTime: input.endTime,
      source: input.source ?? "MANUAL_OTHER",
      // Lo carga un admin a mano: nace activo (la revisión es solo para lo sincronizado).
      status: ClosedDayStatus.ACTIVE,
    },
  });
}

/** Edita un cierre. El origen no se toca: un feriado nacional sigue siéndolo aunque se renombre. */
export async function updateClosedDay(
  id: string,
  input: ClosedDayInput,
): Promise<ClosedDay> {
  return prisma.closedDay.update({
    where: { id },
    data: {
      title: input.title,
      startDate: input.startDate,
      endDate: input.endDate,
      startTime: input.startTime,
      endTime: input.endTime,
      ...(input.status ? { status: input.status } : {}),
      updatedAt: BigInt(nowMs()),
    },
  });
}

export async function deleteClosedDay(id: string): Promise<void> {
  await prisma.closedDay.delete({ where: { id } });
}

/**
 * Cambia el estado de un cierre respetando el ciclo de vida: `ACTIVE` solo desde
 * `PENDING_REVIEW` (confirmar una propuesta) y `DISMISSED` solo desde `PENDING_REVIEW` o
 * `ACTIVE`. Es un `updateMany` condicional, así dos admins confirmando a la vez no pisan nada.
 */
export async function setClosedDayStatus(
  id: string,
  next: "ACTIVE" | "DISMISSED",
): Promise<"changed" | "unchanged" | "not_found"> {
  const from: ClosedDayStatus[] =
    next === "ACTIVE"
      ? [ClosedDayStatus.PENDING_REVIEW]
      : [ClosedDayStatus.PENDING_REVIEW, ClosedDayStatus.ACTIVE];
  const { count } = await prisma.closedDay.updateMany({
    where: { id, status: { in: from } },
    data: { status: next, updatedAt: BigInt(nowMs()) },
  });
  if (count > 0) return "changed";
  return (await prisma.closedDay.findUnique({
    where: { id },
    select: { id: true },
  }))
    ? "unchanged"
    : "not_found";
}

/**
 * Los cierres **activos** que empiezan en los próximos `days` días o ya están en curso, para
 * avisarle al público (página de Espacios, `get_contact_info` del asistente). Acotado a 20: es
 * un aviso, no el listado completo.
 */
export async function getUpcomingClosures(
  todayKey: string,
  days = 90,
): Promise<ClosedDay[]> {
  return prisma.closedDay.findMany({
    where: {
      status: ClosedDayStatus.ACTIVE,
      endDate: { gte: todayKey },
      startDate: { lte: addDaysToDateKey(todayKey, days) },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    take: 20,
  });
}
