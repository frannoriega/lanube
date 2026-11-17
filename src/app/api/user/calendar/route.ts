import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { calendarRangeError } from "@/lib/calendar/activity";
import { nowMs } from "@/lib/clock";
import { getActivityCalendar } from "@/lib/db/activityCalendar";
import { NextRequest } from "next/server";

/**
 * Calendario de actividades de un usuario (milestone 32): `?from=<ms>&to=<ms>`. Sus reservas,
 * los eventos publicados, los días cerrados y lo que reservaron otros como «Ocupado» — esta
 * ruta **nunca** devuelve quién reservó ni el motivo de una reserva ajena
 * (`getActivityCalendar`, vista `user`).
 */
export async function GET(request: NextRequest) {
  const { session, error } = await requireActiveSession();
  if (error) return error;
  const sp = request.nextUrl.searchParams;
  const fromMs = Number(sp.get("from"));
  const toMs = Number(sp.get("to"));
  const rangeError = calendarRangeError(fromMs, toMs, nowMs());
  if (rangeError) return apiError(rangeError, 400);
  try {
    return apiSuccess(
      await getActivityCalendar(fromMs, toMs, {
        kind: "user",
        registeredUserId: session.userId,
      }),
    );
  } catch (e) {
    return apiCatch("user/calendar GET", e);
  }
}
