import { NextRequest, NextResponse } from "next/server";

import { syncNationalHolidays } from "@/lib/db/holidaySync";
import { logger } from "@/lib/logger";

/**
 * Sincronización mensual de feriados nacionales (milestone 23). Vercel Cron: setear
 * CRON_SECRET y `Authorization: Bearer <CRON_SECRET>` (igual que `maintain-reservations`).
 *
 * Solo **propone** feriados (`PENDING_REVIEW`): un admin los confirma en
 * `/admin/closed-days`. Que falle ArgentinaDatos no rompe nada — se informa y se reintenta el
 * mes siguiente (o a mano con «Sincronizar ahora»); el espacio sigue funcionando con lo que ya
 * hay en la base, y los feriados siempre se pueden cargar a mano.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncNationalHolidays();
    logger.info("cron/sync-holidays", { ...summary });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    logger.error("cron/sync-holidays failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { message: "No se pudo sincronizar los feriados" },
      { status: 500 },
    );
  }
}
