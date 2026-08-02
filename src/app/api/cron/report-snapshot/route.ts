import { NextRequest, NextResponse } from "next/server";
import { getReportForRange } from "@/lib/db/adminReports";
import { prisma } from "@/lib/prisma";
import { TZDate } from "@date-fns/tz";
import {
  ADMIN_TIMEZONE,
  startOfDateKeyMs,
  endOfDateKeyMs,
} from "@/lib/admin/admin-timezone";
import { nowMs } from "@/lib/clock";
import { logger } from "@/lib/logger";

function toDateKey(d: TZDate): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function upsertSnapshot(opts: {
  key: string;
  type: string;
  year: number;
  month: number | null;
  fromDate: string; // YYYY-MM-DD label stored in DB
  toDate: string;
  fromMs: number;
  toMs: number;
}) {
  const data = await getReportForRange(opts.fromMs, opts.toMs);
  const dataJson = JSON.stringify(data);
  const id = crypto.randomUUID();

  await prisma.$executeRaw`
    INSERT INTO report_snapshots (id, key, type, year, month, from_date, to_date, data)
    VALUES (${id}, ${opts.key}, ${opts.type}, ${opts.year}, ${opts.month}, ${opts.fromDate}, ${opts.toDate}, ${dataJson}::jsonb)
    ON CONFLICT (key) DO UPDATE
      SET from_date = EXCLUDED.from_date,
          to_date   = EXCLUDED.to_date,
          data      = EXCLUDED.data
  `;

  return { key: opts.key, fromMs: opts.fromMs, toMs: opts.toMs };
}

/**
 * Vercel Cron: runs on the 1st of each month at 06:00 UTC.
 * Creates a snapshot for the previous month; on January also snapshots the previous year.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new TZDate(nowMs(), ADMIN_TIMEZONE);
    const snapshots: { key: string; fromMs: number; toMs: number }[] = [];

    // Previous month
    const prevMonthFirst = new TZDate(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
      ADMIN_TIMEZONE,
    );
    const prevYear = prevMonthFirst.getFullYear();
    const prevMonth = prevMonthFirst.getMonth() + 1;
    const monthFromKey = toDateKey(
      new TZDate(prevYear, prevMonth - 1, 1, ADMIN_TIMEZONE),
    );
    const monthToKey = toDateKey(
      new TZDate(prevYear, prevMonth, 0, ADMIN_TIMEZONE),
    );
    const monthKey = `MONTHLY_${prevYear}_${String(prevMonth).padStart(2, "0")}`;

    snapshots.push(
      await upsertSnapshot({
        key: monthKey,
        type: "MONTHLY",
        year: prevYear,
        month: prevMonth,
        fromDate: monthFromKey,
        toDate: monthToKey,
        fromMs: startOfDateKeyMs(monthFromKey),
        toMs: endOfDateKeyMs(monthToKey),
      }),
    );

    // Previous year — only when running in January
    if (now.getMonth() === 0) {
      const lastYear = now.getFullYear() - 1;
      const yearFromKey = `${lastYear}-01-01`;
      const yearToKey = `${lastYear}-12-31`;
      const yearKey = `YEARLY_${lastYear}`;

      snapshots.push(
        await upsertSnapshot({
          key: yearKey,
          type: "YEARLY",
          year: lastYear,
          month: null,
          fromDate: yearFromKey,
          toDate: yearToKey,
          fromMs: startOfDateKeyMs(yearFromKey),
          toMs: endOfDateKeyMs(yearToKey),
        }),
      );
    }

    logger.info("cron/report-snapshot done", { count: snapshots.length });
    return NextResponse.json({ snapshots });
  } catch (error) {
    logger.error("cron/report-snapshot failed", error);
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
