import {
  dateKeyFromUnixMs,
  endOfDateKeyMs,
  enumerateDateKeysInclusive,
  startOfDateKeyMs,
  todayDateKeyInAdminTz,
} from "@/lib/admin/admin-timezone";
import { auth } from "@/lib/auth";
import {
  ADMIN_RESERVATION_FORWARD_DAYS,
  groupAdminReservationsByDateKey,
  isAdminUser,
  listAdminReservationsAllServicesByRange,
  listAdminReservationsByType,
  listAllAdminReservationsAllServicesInDateRange,
  listAllAdminReservationsInDateRange,
} from "@/lib/db/adminReservations";
import { ResourceType } from "@/generated/prisma/client";
import { serializeJson } from "@/lib/json-bigint";
import { NextRequest, NextResponse } from "next/server";

const MAX_PAGE_SIZE = 100;

function parseAllServices(searchParams: URLSearchParams): boolean {
  const v = searchParams.get("allServices");
  return v === "1" || v === "true";
}

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
    const allServices = parseAllServices(searchParams);
    const service = searchParams.get("service");

    const startDate = parseTimestamp(searchParams.get("startDate"));
    const endDate = parseTimestamp(searchParams.get("endDate"));
    const forwardWindowRaw = searchParams.get("forwardWindow");

    const pageRaw = searchParams.get("page");
    const pageSizeRaw = searchParams.get("pageSize");
    const status = searchParams.get("status");

    if (
      !allServices &&
      (!service ||
        !ResourceType[service.toUpperCase() as keyof typeof ResourceType])
    ) {
      return NextResponse.json(
        { message: "Tipo de recurso inválido" },
        { status: 400 },
      );
    }

    const serviceEnum = !allServices
      ? (service!.toUpperCase() as ResourceType)
      : null;

    const statusFilter =
      status && ["PENDING", "APPROVED", "REJECTED"].includes(status)
        ? (status as "PENDING" | "APPROVED" | "REJECTED")
        : undefined;

    // Single-day lookup via startDate/endDate with pagination
    const page = Math.max(1, parseInt(pageRaw ?? "1", 10) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(pageSizeRaw ?? "50", 10) || 50),
    );

    // Determine range (startMs, endMs)
    let startMs: number;
    let endMs: number;

    if (startDate != null && endDate != null) {
      startMs = startDate;
      endMs = endDate;
    } else if (forwardWindowRaw) {
      const days = Math.min(
        31,
        Math.max(
          1,
          parseInt(forwardWindowRaw, 10) || ADMIN_RESERVATION_FORWARD_DAYS,
        ),
      );
      const fromKey = todayDateKeyInAdminTz();
      startMs = startOfDateKeyMs(fromKey);
      const toKey = dateKeyFromUnixMs(startMs + (days - 1) * 86_400_000);
      endMs = endOfDateKeyMs(toKey);
    } else {
      return NextResponse.json(
        { message: "Se requiere startDate + endDate o forwardWindow" },
        { status: 400 },
      );
    }

    // If pagination params are provided, return paginated results
    if (pageRaw || pageSizeRaw) {
      const { items, total } = allServices
        ? await listAdminReservationsAllServicesByRange(startMs, endMs, {
            status: statusFilter,
            page,
            pageSize,
          })
        : await listAdminReservationsByType(serviceEnum!, {
            startMs,
            endMs,
            status: statusFilter,
            page,
            pageSize,
          });

      return NextResponse.json(serializeJson({ items, total }));
    }

    // Default: return all results grouped by date key
    const flat = allServices
      ? await listAllAdminReservationsAllServicesInDateRange(startMs, endMs)
      : await listAllAdminReservationsInDateRange(serviceEnum!, startMs, endMs);

    const fromKey = dateKeyFromUnixMs(startMs);
    const toKey = dateKeyFromUnixMs(endMs);
    const keys = enumerateDateKeysInclusive(fromKey, toKey);
    const itemsByDate = groupAdminReservationsByDateKey(flat, keys);

    return NextResponse.json(serializeJson({ itemsByDate, fromKey, toKey }));
  } catch {
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
