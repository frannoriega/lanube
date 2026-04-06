import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type MaintainRow = {
  deleted_past_ledger: bigint;
  rebuilt_recurring: bigint;
  deleted_reservations: bigint;
};

/**
 * Daily reservation ledger maintenance (UTC day boundaries in SQL).
 * Vercel Cron: set CRON_SECRET and Authorization: Bearer <CRON_SECRET>.
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

  const rows = await prisma.$queryRaw<MaintainRow[]>`
    SELECT * FROM maintain_reservations()
  `;
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "No result from maintain_reservations" }, { status: 500 });
  }

  return NextResponse.json({
    deletedPastLedger: Number(row.deleted_past_ledger),
    rebuiltRecurring: Number(row.rebuilt_recurring),
    deletedReservations: Number(row.deleted_reservations),
  });
}
