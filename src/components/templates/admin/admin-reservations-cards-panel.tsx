"use client";

import { AdminReservationDetailSheet } from "@/components/organisms/admin/admin-reservation-detail-sheet";
import {
  AdminServiceDayTimeline,
  AdminServiceTimelineLegend,
} from "@/components/organisms/admin/admin-service-day-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AdminReservationListResult,
  parseItemsByDateFromApi,
} from "@/components/templates/admin/dashboard-recent-reservations";
import {
  addDaysToDateKey,
  adminTwoCalendarWeeksRange,
  dateKeyFromUnixMs,
  endOfDateKeyMs,
  endOfIsoWeekDateKey,
  enumerateDateKeysInclusive,
  startOfDateKeyMs,
  startOfIsoWeekDateKey,
  todayDateKeyInAdminTz,
} from "@/lib/admin/admin-timezone";
import type { AdminResourceServiceSlug } from "@/lib/admin/admin-resource-service-slug";
import { ADMIN_RESOURCE_SERVICE_OPTIONS } from "@/lib/admin/admin-resource-service-slug";
import {
  peakOccupancyRatio,
  spacesInConflictCount,
  type ResourceCapacityMeta,
} from "@/lib/admin/admin-timeline";
import { useServerTime } from "@/components/providers/server-time";
import { cn } from "@/lib/utils";
import { formatDate, formateWeekday, parseDateStringLocal } from "@/lib/utils/date";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

function uniqueResourcesMeta(
  items: AdminReservationListResult[],
): ResourceCapacityMeta[] {
  const m = new Map<string, ResourceCapacityMeta>();
  for (const r of items) {
    if (!m.has(r.resource.id)) {
      m.set(r.resource.id, {
        id: r.resource.id,
        capacity: r.resource.capacity,
        isExclusive: r.resource.isExclusive,
      });
    }
  }
  return Array.from(m.values());
}

function serviceTitle(slug: AdminResourceServiceSlug): string {
  return (
    ADMIN_RESOURCE_SERVICE_OPTIONS.find((o) => o.slug === slug)?.label ?? slug
  );
}

function weekRangeLabel(weekStartKey: string): string {
  const end = endOfIsoWeekDateKey(weekStartKey);
  const d0 = parseDateStringLocal(weekStartKey);
  const d1 = parseDateStringLocal(end);
  return `${formatDate(d0)} — ${formatDate(d1)}`;
}

export function AdminReservationsCardsPanel({
  variant,
  serviceSlug,
  showHeading = true,
  onAction,
  processing,
  refetchKey = 0,
}: {
  variant: "admin" | "dashboard";
  serviceSlug: AdminResourceServiceSlug;
  showHeading?: boolean;
  onAction: (
    id: string,
    action: "APPROVED" | "REJECTED",
    reason?: string,
  ) => void;
  processing: string | null;
  refetchKey?: number;
}) {
  const { now, alignRevision } = useServerTime();

  const [itemsByDate, setItemsByDate] = useState<
    Record<string, AdminReservationListResult[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null);
  const [panelReservation, setPanelReservation] =
    useState<AdminReservationListResult | null>(null);

  // Server-aligned week start — null until the server clock offset is applied.
  const [weekStartKey, setWeekStartKey] = useState<string | null>(null);

  useLayoutEffect(() => {
    setWeekStartKey((prev) => {
      const today = todayDateKeyInAdminTz(now().getTime());
      const correct = startOfIsoWeekDateKey(today);
      if (prev === correct) return prev;
      return correct;
    });
  }, [alignRevision, now]);

  const todayKey = todayDateKeyInAdminTz(now().getTime());
  const minWeekStart = startOfIsoWeekDateKey(todayKey);

  const dashboardRange = useMemo(
    () => adminTwoCalendarWeeksRange(now().getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alignRevision],
  );

  const fetchFromKey: string | null =
    weekStartKey === null
      ? null
      : variant === "dashboard"
        ? dashboardRange.fromKey
        : weekStartKey;
  const fetchToKey: string | null =
    weekStartKey === null
      ? null
      : variant === "dashboard"
        ? dashboardRange.toKey
        : endOfIsoWeekDateKey(weekStartKey);

  const prevRefetchKey = useRef(refetchKey);

  const loadRange = useCallback(
    async (showSpinner: boolean) => {
      if (!fetchFromKey || !fetchToKey) return;
      if (showSpinner) setLoading(true);
      try {
        const qs = new URLSearchParams({
          service: serviceSlug,
          startDate: String(startOfDateKeyMs(fetchFromKey)),
          endDate: String(endOfDateKeyMs(fetchToKey)),
        });
        const res = await fetch(`/api/admin/reservations?${qs.toString()}`);
        if (!res.ok) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[AdminCardsPanel] API returned %d for %s", res.status, qs.toString());
          }
          return;
        }
        const data = await res.json();
        const parsed = parseItemsByDateFromApi(data);
        if (process.env.NODE_ENV === "development") {
          const totalItems = Object.values(parsed.itemsByDate).reduce(
            (sum, arr) => sum + arr.length,
            0,
          );
          const daysWithData = Object.entries(parsed.itemsByDate).filter(
            ([, arr]) => arr.length > 0,
          ).length;
          console.info(
            "[AdminCardsPanel] fetched service=%s range=[%s,%s] totalItems=%d daysWithData=%d",
            serviceSlug,
            fetchFromKey,
            fetchToKey,
            totalItems,
            daysWithData,
          );
          if (totalItems > 0) {
            const firstDay = Object.entries(parsed.itemsByDate).find(
              ([, arr]) => arr.length > 0,
            );
            if (firstDay) {
              const sample = firstDay[1][0];
              console.info(
                "[AdminCardsPanel] sample: dateKey=%s id=%s start=%d (%s) end=%d (%s) status=%s resource=%s",
                firstDay[0],
                sample.id,
                sample.startTime,
                new Date(sample.startTime).toISOString(),
                sample.endTime,
                new Date(sample.endTime).toISOString(),
                sample.status,
                sample.resource.name,
              );
            }
          }
        }
        setItemsByDate(parsed.itemsByDate);
      } finally {
        setLoading(false);
      }
    },
    [serviceSlug, fetchFromKey, fetchToKey],
  );

  useEffect(() => {
    const isSilentRefresh = prevRefetchKey.current !== refetchKey;
    prevRefetchKey.current = refetchKey;
    loadRange(!isSilentRefresh);
  }, [loadRange, refetchKey]);

  useEffect(() => {
    setExpandedDateKey(null);
    setPanelReservation(null);
  }, [serviceSlug, fetchFromKey, fetchToKey]);

  const orderedDays = useMemo(() => {
    if (!fetchFromKey || !fetchToKey) return [];
    return enumerateDateKeysInclusive(fetchFromKey, fetchToKey);
  }, [fetchFromKey, fetchToKey]);

  const daysWithReservations = useMemo(
    () => orderedDays.filter((d) => (itemsByDate[d]?.length ?? 0) > 0),
    [orderedDays, itemsByDate],
  );

  const expandedReservations = useMemo(() => {
    if (!expandedDateKey) return [];
    return itemsByDate[expandedDateKey] ?? [];
  }, [expandedDateKey, itemsByDate]);

  const resourcesMeta = useMemo(
    () => uniqueResourcesMeta(expandedReservations),
    [expandedReservations],
  );

  const metrics = useMemo(() => {
    if (!expandedDateKey) {
      return { pending: 0, approved: 0, conflictSpaces: 0, peak: 0 };
    }
    const pending = expandedReservations.filter(
      (r) => r.status === "PENDING",
    ).length;
    const approved = expandedReservations.filter(
      (r) => r.status === "APPROVED",
    ).length;
    const conflictSpaces = spacesInConflictCount(
      expandedReservations,
      resourcesMeta,
      expandedDateKey,
    );
    const peak = peakOccupancyRatio(
      expandedReservations,
      resourcesMeta,
      expandedDateKey,
    );
    return { pending, approved, conflictSpaces, peak };
  }, [expandedReservations, resourcesMeta, expandedDateKey]);

  const wrappedOnAction = useCallback(
    (id: string, action: "APPROVED" | "REJECTED", reason?: string) => {
      onAction(id, action, reason);
    },
    [onAction],
  );

  const canPrevWeek =
    variant === "admin" && !!weekStartKey && weekStartKey > minWeekStart;

  const headingTitle = `Reservas — ${serviceTitle(serviceSlug)}`;

  if (!weekStartKey) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-la-nube-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showHeading ? (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {headingTitle}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {variant === "admin"
              ? "Elegí la semana (actual o futura). Solo se muestran días con reservas; expandí una tarjeta para ver la grilla completa."
              : "Esta semana y la próxima (Argentina). Expandí un día para ver la grilla."}
          </p>
        </div>
      ) : null}

      {variant === "admin" ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!canPrevWeek || loading}
              onClick={() =>
                setWeekStartKey((w) => w ? addDaysToDateKey(w, -7) : w)
              }
              aria-label="Semana anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[200px] text-sm font-medium sm:text-base">
              {loading ? "…" : weekRangeLabel(weekStartKey)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={loading}
              onClick={() =>
                setWeekStartKey((w) => w ? addDaysToDateKey(w, 7) : w)
              }
              aria-label="Semana siguiente"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {loading && daysWithReservations.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-la-nube-primary border-t-transparent" />
        </div>
      ) : !loading && daysWithReservations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay reservas en este período.
        </p>
      ) : (
        <ul className={cn("space-y-2", loading && "opacity-60 pointer-events-none")}>
          {daysWithReservations.map((d) => {
            const list = itemsByDate[d] ?? [];
            const open = expandedDateKey === d;
            const dayDate = parseDateStringLocal(d);
            const title = `${formateWeekday(dayDate)} ${formatDate(dayDate)}`;
            return (
              <li key={d}>
                <Card
                  className={cn(
                    "glass-card dark:glass-card-dark overflow-hidden transition-all duration-150",
                    open
                      ? "ring-1 ring-la-nube-primary/40 shadow-lg"
                      : "hover:shadow-md hover:bg-slate-300/60 dark:hover:bg-slate-600/60 hover:-translate-y-px",
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    onClick={() =>
                      setExpandedDateKey((cur) => (cur === d ? null : d))
                    }
                    aria-expanded={open}
                  >
                    <span className="font-medium">{title}</span>
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      {list.length} reserva{list.length === 1 ? "" : "s"}
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 transition-transform",
                          open && "rotate-180",
                        )}
                      />
                    </span>
                  </button>
                  {open ? (
                    <CardContent className="border-t border-border pt-4 pb-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Card className="glass-card dark:glass-card-dark">
                          <CardContent className="pt-5 pb-4">
                            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                              Pendientes
                            </p>
                            <p className="text-[22px] font-semibold tabular-nums mt-1">
                              {loading ? "…" : metrics.pending}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="glass-card dark:glass-card-dark">
                          <CardContent className="pt-5 pb-4">
                            <p className="text-xs text-muted-foreground">
                              Aprobadas (día)
                            </p>
                            <p className="text-[22px] font-semibold tabular-nums mt-1">
                              {loading ? "…" : metrics.approved}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="glass-card dark:glass-card-dark">
                          <CardContent className="pt-5 pb-4">
                            <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                              Espacios con conflicto
                            </p>
                            <p className="text-[22px] font-semibold tabular-nums mt-1">
                              {loading ? "…" : metrics.conflictSpaces}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="glass-card dark:glass-card-dark">
                          <CardContent className="pt-5 pb-4">
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              Pico de ocupación
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="size-3.5 shrink-0 cursor-help text-muted-foreground/60" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-56">
                                  Máxima proporción de capacidad utilizada en un
                                  slot de 15 min del día. Valores &gt;100%
                                  indican sobrecarga.
                                </TooltipContent>
                              </Tooltip>
                            </p>
                            <p
                              className={cn(
                                "text-[22px] font-semibold tabular-nums mt-1",
                                metrics.peak > 1 &&
                                  "text-red-600 dark:text-red-400",
                              )}
                            >
                              {loading
                                ? "…"
                                : `${Math.round(metrics.peak * 1000) / 10}%`}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                      <div className="flex justify-end">
                        <div className="flex rounded-md border border-border p-0.5 w-fit">
                          <Button
                            type="button"
                            variant={pendingOnly ? "secondary" : "ghost"}
                            size="sm"
                            className="rounded-sm"
                            onClick={() => setPendingOnly(true)}
                          >
                            Solo pendientes
                          </Button>
                          <Button
                            type="button"
                            variant={!pendingOnly ? "secondary" : "ghost"}
                            size="sm"
                            className="rounded-sm"
                            onClick={() => setPendingOnly(false)}
                          >
                            Todas
                          </Button>
                        </div>
                      </div>
                      <AdminServiceTimelineLegend />
                      <AdminServiceDayTimeline
                        dateKey={d}
                        reservationsForCapacity={list}
                        pendingOnly={pendingOnly}
                        showResourceTypeLabels={false}
                        onSelectReservation={setPanelReservation}
                      />
                    </CardContent>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <AdminReservationDetailSheet
        open={!!panelReservation}
        onOpenChange={(o) => !o && setPanelReservation(null)}
        reservation={panelReservation}
        sameDayReservations={
          panelReservation
            ? (itemsByDate[dateKeyFromReservation(panelReservation)] ?? [])
            : []
        }
        onAction={wrappedOnAction}
        processing={processing}
        onRejected={() => setPanelReservation(null)}
      />
    </div>
  );
}

function dateKeyFromReservation(r: AdminReservationListResult): string {
  return dateKeyFromUnixMs(r.startTime);
}
