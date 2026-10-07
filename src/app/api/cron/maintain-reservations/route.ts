import { NextRequest, NextResponse } from "next/server";

import { nowMs } from "@/lib/clock";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getGlobalReadOnlyWindow } from "@/lib/maintenance/server";
import { pruneExpiredOAuthRows } from "@/lib/oauth/server";
import { pruneExpiredEditTokens } from "@/lib/db/participants";

type MaintainRow = {
  deleted_past_ledger: bigint;
  rebuilt_recurring: bigint;
  pruned_expired_ledger: bigint;
};

/**
 * Mantenimiento diario del **ledger** de reservas (los límites de día se calculan en UTC,
 * dentro del SQL). Vercel Cron: setear CRON_SECRET y Authorization: Bearer <CRON_SECRET>.
 *
 * Poda y rematerializa el ledger derivado; **no** borra filas de `reservations`. Antes sí lo
 * hacía (milestone-12 D7), y por eso `/admin/reports` no podía reportar ningún período pasado
 * — el tercer contador ahora es `prunedExpiredLedger`, no `deletedReservations`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Solo lectura global (milestone 22): el cron escribe (poda y rematerializa el ledger),
    // así que durante un respaldo o una migración se saltea. Es seguro: `maintain_reservations()`
    // recalcula todo hacia adelante desde "hoy", de modo que la próxima corrida recupera lo
    // que esta dejó. Si una ventana de solo lectura se olvida abierta días, esto se nota en
    // el log y en `skipped`.
    const readOnly = await getGlobalReadOnlyWindow();
    if (readOnly) {
      logger.warn(
        "cron/maintain-reservations skipped (read-only maintenance)",
        {
          window: readOnly.title,
        },
      );
      return NextResponse.json({
        skipped: true,
        reason: "read-only maintenance",
      });
    }

    const rows = await prisma.$queryRaw<MaintainRow[]>`
      SELECT * FROM maintain_reservations()
    `;
    const row = rows[0];
    if (!row) {
      logger.error("cron/maintain-reservations returned no result");
      return NextResponse.json(
        { message: "No result from maintain_reservations" },
        { status: 500 },
      );
    }

    // Limpieza de tablas transitorias: tokens de verificación vencidos, ventanas de
    // rate limit ya cerradas (milestone-12 D28) y desafíos WebAuthn sin consumir
    // (milestone 17).
    const [transient] = await prisma.$queryRaw<
      {
        deleted_tokens: bigint;
        deleted_rate_limits: bigint;
        deleted_webauthn_challenges: bigint;
      }[]
    >`SELECT * FROM prune_transient_rows(${nowMs()}::bigint)`;

    // Códigos y tokens OAuth del conector MCP (milestone 20) vencidos o revocados hace más
    // de una semana. Los grants revocados se conservan (historia chica).
    const oauth = await pruneExpiredOAuthRows();

    // Enlaces de edición de inscripciones de eventos que ya terminaron (milestone 25, S5). Ya no
    // sirven aunque sigan en la tabla (el vencimiento se calcula al usarlos): esto es limpieza.
    const deletedEditTokens = await pruneExpiredEditTokens();

    const result = {
      deletedPastLedger: Number(row.deleted_past_ledger),
      rebuiltRecurring: Number(row.rebuilt_recurring),
      prunedExpiredLedger: Number(row.pruned_expired_ledger),
      deletedExpiredTokens: Number(transient?.deleted_tokens ?? 0),
      deletedStaleRateLimits: Number(transient?.deleted_rate_limits ?? 0),
      deletedWebAuthnChallenges: Number(
        transient?.deleted_webauthn_challenges ?? 0,
      ),
      deletedOAuthCodes: oauth.codes,
      deletedOAuthTokens: oauth.tokens,
      deletedEditTokens,
    };
    logger.info("cron/maintain-reservations done", result);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("cron/maintain-reservations failed", error);
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
