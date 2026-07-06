"use client";

import { AdminReservationDetailSheet } from "@/components/organisms/admin/admin-reservation-detail-sheet";
import { DayReservationCard } from "@/components/organisms/admin/day-reservation-card";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
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
import { useServerTime } from "@/components/providers/server-time";
import { cn } from "@/lib/utils";
import {
  formatDate,
  formateWeekday,
  parseDateStringLocal,
} from "@/lib/utils/date";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

function weekRangeLabel(weekStartKey: string): string {
  const end = endOfIsoWeekDateKey(weekStartKey);
  const d0 = parseDateStringLocal(weekStartKey);
  const d1 = parseDateStringLocal(end);
  return `${formatDate(d0)} — ${formatDate(d1)}`;
}
const CLOSED_ACCORDION_VALUE = "__none__";

export function AdminReservationsCardsPanel({
  variant,
  spaceId,
  spaceName,
  showHeading = true,
  onAction,
  processing,
  refetchKey = 0,
}: {
  variant: "admin" | "dashboard";
  spaceId: string;
  spaceName: string;
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
      if (!spaceId || !fetchFromKey || !fetchToKey) return;
      if (showSpinner) setLoading(true);
      try {
        const qs = new URLSearchParams({
          service: spaceId,
          startDate: String(startOfDateKeyMs(fetchFromKey)),
          endDate: String(endOfDateKeyMs(fetchToKey)),
        });
        const res = await fetch(`/api/admin/reservations?${qs.toString()}`);
        if (!res.ok) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              "[AdminCardsPanel] API returned %d for %s",
              res.status,
              qs.toString(),
            );
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
            spaceId,
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
    [spaceId, fetchFromKey, fetchToKey],
  );

  useEffect(() => {
    const isSilentRefresh = prevRefetchKey.current !== refetchKey;
    prevRefetchKey.current = refetchKey;
    loadRange(!isSilentRefresh);
  }, [loadRange, refetchKey]);

  useEffect(() => {
    setExpandedDateKey(null);
    setPanelReservation(null);
  }, [spaceId, fetchFromKey, fetchToKey]);

  const orderedDays = useMemo(() => {
    if (!fetchFromKey || !fetchToKey) return [];
    return enumerateDateKeysInclusive(fetchFromKey, fetchToKey);
  }, [fetchFromKey, fetchToKey]);

  const daysWithReservations = useMemo(
    () => orderedDays.filter((d) => (itemsByDate[d]?.length ?? 0) > 0),
    [orderedDays, itemsByDate],
  );

  const wrappedOnAction = useCallback(
    (id: string, action: "APPROVED" | "REJECTED", reason?: string) => {
      onAction(id, action, reason);
    },
    [onAction],
  );

  const canPrevWeek =
    variant === "admin" && !!weekStartKey && weekStartKey > minWeekStart;

  const headingTitle = `Reservas — ${spaceName}`;

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
                setWeekStartKey((w) => (w ? addDaysToDateKey(w, -7) : w))
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
                setWeekStartKey((w) => (w ? addDaysToDateKey(w, 7) : w))
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
        <Accordion
          type="single"
          collapsible
          value={expandedDateKey ?? CLOSED_ACCORDION_VALUE}
          onValueChange={(value) =>
            setExpandedDateKey(
              value && value !== CLOSED_ACCORDION_VALUE ? value : null,
            )
          }
          className={cn(
            "space-y-2",
            loading && "opacity-60 pointer-events-none",
          )}
        >
          {daysWithReservations.map((d) => {
            const list = itemsByDate[d] ?? [];
            const open = expandedDateKey === d;
            const dayDate = parseDateStringLocal(d);
            const title = `${formateWeekday(dayDate)} ${formatDate(dayDate)}`;
            return (
              <DayReservationCard
                key={d}
                value={d}
                dateKey={d}
                title={title}
                count={list.length}
                open={open}
                reservationsForDay={list}
                pendingOnly={pendingOnly}
                onPendingOnlyChange={setPendingOnly}
                onSelectReservation={setPanelReservation}
                disabled={loading}
              />
            );
          })}
        </Accordion>
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
