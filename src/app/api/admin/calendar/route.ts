import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { calendarRangeError } from "@/lib/calendar/activity";
import { nowMs } from "@/lib/clock";
import { getActivityCalendar } from "@/lib/db/activityCalendar";
import { NextRequest } from "next/server";

/**
 * Calendario de actividades del panel (milestone 32): `?from=<ms>&to=<ms>[&space=<id>]`.
 * Todas las reservas con quién reservó (pendientes incluidas), los eventos (con su estado),
 * los días cerrados y las ventanas de mantenimiento. Permiso: el de ver reservas
 * (`reservations:manage`). Rango acotado y con tope de navegación (`calendarRangeError`).
 */
export async function GET(request: NextRequest) {
  const { error } = await requirePermission("reservations:manage");
  if (error) return error;
  const sp = request.nextUrl.searchParams;
  const fromMs = Number(sp.get("from"));
  const toMs = Number(sp.get("to"));
  const rangeError = calendarRangeError(fromMs, toMs, nowMs());
  if (rangeError) return apiError(rangeError, 400);
  const space = sp.get("space") || undefined;
  if (space && !/^[a-z0-9]{1,64}$/i.test(space)) {
    return apiError("Espacio inválido", 400);
  }
  try {
    return apiSuccess(
      await getActivityCalendar(fromMs, toMs, {
        kind: "admin",
        spaceId: space,
      }),
    );
  } catch (e) {
    return apiCatch("admin/calendar GET", e);
  }
}
