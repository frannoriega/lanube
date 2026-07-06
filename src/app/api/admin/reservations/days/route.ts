import { auth } from "@/lib/auth";
import {
  endOfDateKeyMs,
  startOfDateKeyMs,
  todayDateKeyInAdminTz,
} from "@/lib/admin/admin-timezone";
import {
  ADMIN_RESERVATION_FORWARD_DAYS,
  isAdminUser,
  listDaysWithPendingReservationsAllServices,
  listReservationDayCountsInRange,
} from "@/lib/db/adminReservations";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function parseTimestamp(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email || !session?.userId) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    const isAdmin = await isAdminUser(session.userId);
    if (!isAdmin) {
      return NextResponse.json({ message: "Acceso denegado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const service = searchParams.get("service");
    const status = searchParams.get("status");
    const pageRaw = searchParams.get("page");
    const pageSizeRaw = searchParams.get("pageSize");

    const startDate = parseTimestamp(searchParams.get("startDate"));
    const endDate = parseTimestamp(searchParams.get("endDate"));

    const page = Math.max(1, parseInt(pageRaw ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(pageSizeRaw ?? "50", 10) || 50),
    );

    // Default window when no explicit timestamps provided
    let startMs: number;
    let endMs: number;
    if (startDate != null && endDate != null) {
      startMs = startDate;
      endMs = endDate;
    } else {
      const fromKey = todayDateKeyInAdminTz();
      startMs = startOfDateKeyMs(fromKey);
      const daysAhead = ADMIN_RESERVATION_FORWARD_DAYS;
      endMs = endOfDateKeyMs(
        todayDateKeyInAdminTz(startMs + (daysAhead - 1) * 86_400_000),
      );
    }

    if (!service) {
      const { items, total } = await listDaysWithPendingReservationsAllServices(
        startMs,
        endMs,
        { page, pageSize },
      );
      return NextResponse.json({ items, total });
    }

    const sp = await prisma.space.findUnique({
      where: { id: service },
    });
    if (!sp)
      return NextResponse.json(
        { message: "Tipo de recurso inválido" },
        { status: 400 },
      );

    const statusFilter =
      status && ["PENDING", "APPROVED", "REJECTED"].includes(status)
        ? (status as "PENDING" | "APPROVED" | "REJECTED")
        : undefined;

    const { items, total } = await listReservationDayCountsInRange(
      service,
      statusFilter,
      startMs,
      endMs,
    );

    return NextResponse.json({ items, total });
  } catch {
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
