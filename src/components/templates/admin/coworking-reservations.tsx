"use client";

import { DayReservationCard } from "@/components/organisms/admin/day-reservation-card";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AdminReservationListResult,
  parseAdminReservationListFromApi,
} from "@/components/templates/admin/dashboard-recent-reservations";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export interface DayWithReservations {
  date: string;
  count: number;
}

export function CoworkingReservationsTemplate({
  service,
  onAction,
  processing,
  refetchKey = 0,
}: {
  service: string;
  onAction: (id: string, action: "APPROVED" | "REJECTED", reason?: string) => void;
  processing: string | null;
  refetchKey?: number;
}) {
  const [daysPending, setDaysPending] = useState<DayWithReservations[]>([]);
  const [daysApproved, setDaysApproved] = useState<DayWithReservations[]>([]);
  const [daysRejected, setDaysRejected] = useState<DayWithReservations[]>([]);
  const [daysPendingTotal, setDaysPendingTotal] = useState(0);
  const [daysApprovedTotal, setDaysApprovedTotal] = useState(0);
  const [daysRejectedTotal, setDaysRejectedTotal] = useState(0);
  const [loadingDays, setLoadingDays] = useState(true);
  const [dayReservations, setDayReservations] = useState<
    Record<string, { items: AdminReservationListResult[]; total: number }>
  >({});
  const [loadingDay, setLoadingDay] = useState<string | null>(null);
  const [loadingMoreDay, setLoadingMoreDay] = useState<string | null>(null);

  const fetchDays = useCallback(
    async (page = 1, append = false) => {
      if (!append) setLoadingDays(true);
      try {
        const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
          fetch(
            `/api/admin/reservations/days?service=${service}&status=PENDING&page=${page}&pageSize=50`
          ),
          fetch(
            `/api/admin/reservations/days?service=${service}&status=APPROVED&page=${page}&pageSize=50`
          ),
          fetch(
            `/api/admin/reservations/days?service=${service}&status=REJECTED&page=${page}&pageSize=50`
          ),
        ]);
        if (pendingRes.ok) {
          const { items, total } = await pendingRes.json();
          setDaysPending((prev) => (append ? [...prev, ...items] : items));
          setDaysPendingTotal(total);
        }
        if (approvedRes.ok) {
          const { items, total } = await approvedRes.json();
          setDaysApproved((prev) => (append ? [...prev, ...items] : items));
          setDaysApprovedTotal(total);
        }
        if (rejectedRes.ok) {
          const { items, total } = await rejectedRes.json();
          setDaysRejected((prev) => (append ? [...prev, ...items] : items));
          setDaysRejectedTotal(total);
        }
      } finally {
        setLoadingDays(false);
      }
    },
    [service]
  );

  const hasMoreDaysPending = daysPendingTotal > daysPending.length;
  const hasMoreDaysApproved = daysApprovedTotal > daysApproved.length;
  const hasMoreDaysRejected = daysRejectedTotal > daysRejected.length;
  const nextDaysPage =
    1 +
    Math.max(
      Math.floor(daysPending.length / 50),
      Math.floor(daysApproved.length / 50),
      Math.floor(daysRejected.length / 50)
    );

  useEffect(() => {
    fetchDays();
  }, [fetchDays, refetchKey]);

  const fetchReservationsForDay = useCallback(
    async (
      date: string,
      status: "PENDING" | "APPROVED" | "REJECTED",
      page = 1,
      append = false
    ) => {
      const key = `${date}-${status}`;
      const cached = dayReservations[key];
      if (!append && cached) return;
      if (append) setLoadingMoreDay(key);
      else setLoadingDay(key);
      try {
        const res = await fetch(
          `/api/admin/reservations?service=${service}&date=${date}&status=${status}&page=${page}&pageSize=50`
        );
        if (res.ok) {
          const { items, total } = await res.json();
          const parsed = parseAdminReservationListFromApi(items);
          setDayReservations((prev) => {
            const existing = prev[key];
            const newItems = append && existing ? [...existing.items, ...parsed] : parsed;
            return { ...prev, [key]: { items: newItems, total } };
          });
        }
      } finally {
        if (append) setLoadingMoreDay(null);
        else setLoadingDay(null);
      }
    },
    [service, dayReservations]
  );


  const totalPending = daysPending.reduce((s, d) => s + d.count, 0);
  const totalApproved = daysApproved.reduce((s, d) => s + d.count, 0);
  const totalRejected = daysRejected.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Reservas de Coworking
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Gestiona las reservas del espacio de coworking
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="glass-card dark:glass-card-dark">
          <CardContent className="flex flex-row items-center justify-between pt-6">
            <span className="text-sm font-medium">Pendientes</span>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardContent>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{loadingDays ? "…" : totalPending}</div>
          </CardContent>
        </Card>
        <Card className="glass-card dark:glass-card-dark">
          <CardContent className="flex flex-row items-center justify-between pt-6">
            <span className="text-sm font-medium">Aprobadas</span>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardContent>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{loadingDays ? "…" : totalApproved}</div>
          </CardContent>
        </Card>
        <Card className="glass-card dark:glass-card-dark">
          <CardContent className="flex flex-row items-center justify-between pt-6">
            <span className="text-sm font-medium">Rechazadas</span>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardContent>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{loadingDays ? "…" : totalRejected}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pendientes ({totalPending})
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Aprobadas ({totalApproved})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Rechazadas ({totalRejected})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {daysPending.length === 0 && !loadingDays ? (
            <Card className="glass-card dark:glass-card-dark">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Clock className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No hay reservas pendientes
                </h3>
                <p className="text-gray-500">Todas las reservas han sido procesadas.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {daysPending.map((day) => (
                <DayReservationCard
                  key={day.date}
                  day={day}
                  reservations={dayReservations[`${day.date}-PENDING`]?.items ?? []}
                  totalReservations={dayReservations[`${day.date}-PENDING`]?.total}
                  onAction={onAction}
                  processing={processing}
                  onFetchReservations={(date) =>
                    fetchReservationsForDay(date, "PENDING")
                  }
                  onLoadMore={(date) => {
                    const key = `${date}-PENDING`;
                    const cached = dayReservations[key];
                    if (!cached) return;
                    const currentPage = Math.ceil(cached.items.length / 50);
                    fetchReservationsForDay(date, "PENDING", currentPage + 1, true);
                  }}
                  isLoading={loadingDay === `${day.date}-PENDING`}
                  isLoadingMore={loadingMoreDay === `${day.date}-PENDING`}
                />
              ))}
            </div>
          )}
          {hasMoreDaysPending && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                className="text-sm text-la-nube-primary hover:underline disabled:opacity-50"
                onClick={() => fetchDays(nextDaysPage, true)}
                disabled={loadingDays}
              >
                {loadingDays ? "Cargando…" : `Cargar más días (${daysPending.length} de ${daysPendingTotal})`}
              </button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {daysApproved.length === 0 && !loadingDays ? (
            <Card className="glass-card dark:glass-card-dark">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <CheckCircle className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No hay reservas aprobadas
                </h3>
                <p className="text-gray-500">Las reservas aprobadas aparecerán aquí.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {daysApproved.map((day) => (
                <DayReservationCard
                  key={day.date}
                  day={day}
                  reservations={dayReservations[`${day.date}-APPROVED`]?.items ?? []}
                  totalReservations={dayReservations[`${day.date}-APPROVED`]?.total}
                  onFetchReservations={(date) =>
                    fetchReservationsForDay(date, "APPROVED")
                  }
                  onLoadMore={(date) => {
                    const key = `${date}-APPROVED`;
                    const cached = dayReservations[key];
                    if (!cached) return;
                    const currentPage = Math.ceil(cached.items.length / 50);
                    fetchReservationsForDay(date, "APPROVED", currentPage + 1, true);
                  }}
                  isLoading={loadingDay === `${day.date}-APPROVED`}
                  isLoadingMore={loadingMoreDay === `${day.date}-APPROVED`}
                />
              ))}
            </div>
          )}
          {hasMoreDaysApproved && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                className="text-sm text-la-nube-primary hover:underline disabled:opacity-50"
                onClick={() => fetchDays(nextDaysPage, true)}
                disabled={loadingDays}
              >
                {loadingDays ? "Cargando…" : `Cargar más días (${daysApproved.length} de ${daysApprovedTotal})`}
              </button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          {daysRejected.length === 0 && !loadingDays ? (
            <Card className="glass-card dark:glass-card-dark">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <XCircle className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No hay reservas rechazadas
                </h3>
                <p className="text-gray-500">Las reservas rechazadas aparecerán aquí.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {daysRejected.map((day) => (
                <DayReservationCard
                  key={day.date}
                  day={day}
                  reservations={dayReservations[`${day.date}-REJECTED`]?.items ?? []}
                  totalReservations={dayReservations[`${day.date}-REJECTED`]?.total}
                  onFetchReservations={(date) =>
                    fetchReservationsForDay(date, "REJECTED")
                  }
                  onLoadMore={(date) => {
                    const key = `${date}-REJECTED`;
                    const cached = dayReservations[key];
                    if (!cached) return;
                    const currentPage = Math.ceil(cached.items.length / 50);
                    fetchReservationsForDay(date, "REJECTED", currentPage + 1, true);
                  }}
                  isLoading={loadingDay === `${day.date}-REJECTED`}
                  isLoadingMore={loadingMoreDay === `${day.date}-REJECTED`}
                />
              ))}
            </div>
          )}
          {hasMoreDaysRejected && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                className="text-sm text-la-nube-primary hover:underline disabled:opacity-50"
                onClick={() => fetchDays(nextDaysPage, true)}
                disabled={loadingDays}
              >
                {loadingDays ? "Cargando…" : `Cargar más días (${daysRejected.length} de ${daysRejectedTotal})`}
              </button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
