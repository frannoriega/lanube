import { prisma } from "@/lib/prisma";
import { dateKeyFromUnixMs } from "@/lib/admin/admin-timezone";
import { ClosedDayStatus } from "@/generated/prisma/client";
import type { ClosedDay } from "@/generated/prisma/client";

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
