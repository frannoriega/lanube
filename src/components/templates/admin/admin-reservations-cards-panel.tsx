"use client";

import { AdminReservationDetailSheet } from "@/components/organisms/admin/admin-reservation-detail-sheet";
import { DayReservationCard } from "@/components/organisms/admin/day-reservation-card";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminReservationListResult } from "@/lib/api/admin-reservations";
import { ALL_SPACES_ID, useAdminReservationsRange } from "@/hooks/api";
import {
  adminForwardWindowRange,
  dateKeyFromUnixMs,
  endOfDateKeyMs,
  enumerateDateKeysInclusive,
  startOfDateKeyMs,
} from "@/lib/admin/admin-timezone";
import { useServerTime } from "@/components/providers/server-time";
import { cn } from "@/lib/utils";
import {
  formatDate,
  formateWeekday,
  parseDateStringLocal,
} from "@/lib/utils/date";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CLOSED_ACCORDION_VALUE = "__none__";

/** Days rendered per page (only counting days that actually have reservations). */
const DAYS_PER_PAGE = 5;

const WINDOW_OPTIONS = [7, 14, 30, 60] as const;
const DEFAULT_WINDOW_DAYS = 14;

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
  /** A space id, or `ALL_SPACES_ID` ("all") to show every space at once. */
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
  const isAllSpaces = spaceId === ALL_SPACES_ID;

  const [pendingOnly, setPendingOnly] = useState(false);
  const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null);
  const [panelReservation, setPanelReservation] =
    useState<AdminReservationListResult | null>(null);

  // Only the admin (full-page) variant exposes a window-size control; the
  // dashboard card stays at the default window to keep the widget compact.
  const [windowDays, setWindowDays] = useState<number>(DEFAULT_WINDOW_DAYS);
  const [page, setPage] = useState(1);

  // Server-aligned "today" — null until the server clock offset is applied.
  const [rangeAnchorMs, setRangeAnchorMs] = useState<number | null>(null);

  useEffect(() => {
    setRangeAnchorMs(now().getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alignRevision]);

  const { fromKey: fetchFromKey, toKey: fetchToKey } = useMemo(() => {
    if (rangeAnchorMs === null) return { fromKey: null, toKey: null };
    return adminForwardWindowRange(windowDays, rangeAnchorMs);
  }, [rangeAnchorMs, windowDays]);

  const {
    data: range,
    loading,
    firstTime,
    refetch,
  } = useAdminReservationsRange(
    spaceId && fetchFromKey && fetchToKey
      ? {
          spaceId,
          startMs: startOfDateKeyMs(fetchFromKey),
          endMs: endOfDateKeyMs(fetchToKey),
        }
      : null,
  );
  const itemsByDate = useMemo(() => range?.itemsByDate ?? {}, [range]);

  // External silent refresh (after approving/rejecting a reservation).
  const prevRefetchKey = useRef(refetchKey);
  useEffect(() => {
    if (prevRefetchKey.current === refetchKey) return;
    prevRefetchKey.current = refetchKey;
    refetch();
  }, [refetchKey, refetch]);

  useEffect(() => {
    setExpandedDateKey(null);
    setPanelReservation(null);
    setPage(1);
  }, [spaceId, fetchFromKey, fetchToKey]);

  const orderedDays = useMemo(() => {
    if (!fetchFromKey || !fetchToKey) return [];
    return enumerateDateKeysInclusive(fetchFromKey, fetchToKey);
  }, [fetchFromKey, fetchToKey]);

  const daysWithReservations = useMemo(
    () => orderedDays.filter((d) => (itemsByDate[d]?.length ?? 0) > 0),
    [orderedDays, itemsByDate],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(daysWithReservations.length / DAYS_PER_PAGE),
  );
  const safePage = Math.min(page, totalPages);
  const pagedDays = useMemo(
    () =>
      daysWithReservations.slice(
        (safePage - 1) * DAYS_PER_PAGE,
        safePage * DAYS_PER_PAGE,
      ),
    [daysWithReservations, safePage],
  );

  const wrappedOnAction = useCallback(
    (id: string, action: "APPROVED" | "REJECTED", reason?: string) => {
      onAction(id, action, reason);
    },
    [onAction],
  );

  const headingTitle = isAllSpaces
    ? "Reservas — Todos los espacios"
    : `Reservas — ${spaceName}`;

  if (rangeAnchorMs === null || firstTime) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-40 w-full" />
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
            Próximos {windowDays} días desde hoy (Argentina). Expandí un día con
            reservas para ver la grilla y el detalle lateral.
          </p>
        </div>
      ) : null}

      {variant === "admin" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Ventana:
          </span>
          <div className="flex rounded-md border border-border p-0.5 w-fit">
            {WINDOW_OPTIONS.map((d) => (
              <Button
                key={d}
                type="button"
                variant={windowDays === d ? "secondary" : "ghost"}
                size="sm"
                className="rounded-sm"
                disabled={loading}
                onClick={() => setWindowDays(d)}
              >
                {d}d
              </Button>
            ))}
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
        <>
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
            {pagedDays.map((d) => {
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
                  showResourceTypeLabels={isAllSpaces}
                />
              );
            })}
          </Accordion>

          {totalPages > 1 ? (
            <nav
              className="flex items-center justify-center gap-3"
              aria-label="Paginación de días con reservas"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safePage <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                Página {safePage} de {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </nav>
          ) : null}
        </>
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
