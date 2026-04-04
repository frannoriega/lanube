"use client";

import { DayReservationCard } from "@/components/organisms/admin/day-reservation-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResourceType } from "@/generated/prisma/enums";
import { Calendar } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/**
 * Lists reservations filtered by resource type, including basic user and resource info.
 */
export interface AdminReservationListResult {
  id: string;
  startTime: number;
  endTime: number;
  reason: string;
  status: string;
  createdAt: number;
  deniedReason?: string | null;
  resource: {
    id: string;
    name: string;
    type: ResourceType;
  };
  registeredUser: {
    name: string;
    lastName: string;
    dni: string;
    institution: string | null;
    user: {
      email: string;
    }
  };
}
export interface DayWithReservations {
  date: string;
  count: number;
}

export function DashboardRecentReservations({
  onAction,
  processing,
  refetchKey = 0,
}: {
  onAction: (id: string, action: "APPROVED" | "REJECTED", reason?: string) => void;
  processing: string | null;
  refetchKey?: number;
}) {
  const [days, setDays] = useState<DayWithReservations[]>([]);
  const [daysTotal, setDaysTotal] = useState(0);
  const [loadingDays, setLoadingDays] = useState(true);
  const [dayReservations, setDayReservations] = useState<
    Record<string, { items: AdminReservationListResult[]; total: number }>
  >({});
  const [loadingDay, setLoadingDay] = useState<string | null>(null);
  const [loadingMoreDay, setLoadingMoreDay] = useState<string | null>(null);

  const fetchDays = useCallback(async (page = 1, append = false) => {
    if (!append) setLoadingDays(true);
    try {
      const res = await fetch(`/api/admin/reservations/days?page=${page}&pageSize=50`);
      if (res.ok) {
        const { items, total } = await res.json();
        setDays((prev) => (append ? [...prev, ...items] : items));
        setDaysTotal(total);
      }
    } finally {
      setLoadingDays(false);
    }
  }, []);

  useEffect(() => {
    setDayReservations({});
    fetchDays();
  }, [fetchDays, refetchKey]);

  const fetchReservationsForDay = useCallback(
    async (date: string, page = 1, append = false) => {
      const cached = dayReservations[date];
      if (!append && cached) return;
      if (append) setLoadingMoreDay(date);
      else setLoadingDay(date);
      try {
        const res = await fetch(
          `/api/admin/reservations/by-date?date=${date}&page=${page}&pageSize=50`
        );
        if (res.ok) {
          const { items, total } = await res.json();
          const parsed = parseAdminReservationListFromApi(items);
          setDayReservations((prev) => {
            const existing = prev[date];
            const newItems = append && existing ? [...existing.items, ...parsed] : parsed;
            return { ...prev, [date]: { items: newItems, total } };
          });
        }
      } finally {
        if (append) setLoadingMoreDay(null);
        else setLoadingDay(null);
      }
    },
    [dayReservations]
  );

  const handleActionSuccess = useCallback(() => {
    fetchDays(1, false);
    setDayReservations({});
  }, [fetchDays]);

  if (days.length === 0 && !loadingDays) return null;

  return (
    <Card className="glass-card dark:glass-card-dark">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Reservas recientes
        </CardTitle>
        <CardDescription>Reservas pendientes por día</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {days.map((day) => (
            <DayReservationCard
              key={day.date}
              day={day}
              reservations={dayReservations[day.date]?.items ?? []}
              totalReservations={dayReservations[day.date]?.total}
              onAction={(id, action, reason) => {
                onAction(id, action, reason);
                handleActionSuccess();
              }}
              processing={processing}
              onFetchReservations={fetchReservationsForDay}
              onLoadMore={(date) => {
                const cached = dayReservations[date];
                if (!cached) return;
                const currentPage = Math.ceil(cached.items.length / 50);
                fetchReservationsForDay(date, currentPage + 1, true);
              }}
              isLoading={loadingDay === day.date}
              isLoadingMore={loadingMoreDay === day.date}
            />
          ))}
        </div>
        {daysTotal > days.length && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              className="text-sm text-la-nube-primary hover:underline disabled:opacity-50"
              onClick={() => fetchDays(Math.floor(days.length / 50) + 1, true)}
              disabled={loadingDays}
            >
              {loadingDays ? "Cargando…" : `Cargar más días (${days.length} de ${daysTotal})`}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Normalizes API JSON (ms UTC or legacy ISO strings) into AdminReservationListResult. */
export function parseAdminReservationListFromApi(
  raw: unknown
): AdminReservationListResult[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: Record<string, unknown>) => ({
    ...item,
    startTime: new Date(item.startTime as string | number | Date).getTime(),
    endTime: new Date(item.endTime as string | number | Date).getTime(),
    createdAt: new Date(item.createdAt as string | number | Date).getTime(),
  })) as AdminReservationListResult[];
}