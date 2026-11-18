"use client";

import { ToneBadge } from "@/components/atoms/status-badge";
import {
  AdminServiceDayTimeline,
  AdminServiceTimelineLegend,
} from "@/components/organisms/admin/admin-service-day-timeline";
import { useServerTime } from "@/components/providers/server-time";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ALL_SPACES_ID,
  useAdminReservationsRange,
  useSpaceOptions,
} from "@/hooks/api";
import {
  addDaysToDateKey,
  endOfDateKeyMs,
  mondayOfDateKey,
  startOfDateKeyMs,
  todayDateKeyInAdminTz,
} from "@/lib/admin/admin-timezone";
import {
  spacesInConflictCount,
  type ResourceCapacityMeta,
} from "@/lib/admin/admin-timeline";
import type { AdminReservationListResult } from "@/lib/api/admin-reservations";
import { cn } from "@/lib/utils";
import {
  formatDate,
  formateWeekday,
  parseDateStringLocal,
} from "@/lib/utils/date";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type OnAction = (
  id: string,
  action: "APPROVED" | "REJECTED",
  reason?: string,
) => void;

/** Una ventana son dos semanas (lunes a domingo): «esta y la siguiente». */
const WINDOW_DAYS = 14;

/** Reservas de un espacio, por día. */
type DaysMap = Record<string, AdminReservationListResult[]>;

function resourceMetas(
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

const pendingOf = (list: AdminReservationListResult[]) =>
  list.filter((r) => r.status === "PENDING").length;

/**
 * Tablero del admin: **una sección por espacio** con lo que viene (esta semana y la
 * siguiente, navegable de a semanas), agrupado por día. Cada día es una tarjeta con cuántas
 * reservas tiene y cuántas están pendientes; al tocarla se abre la línea de tiempo de ese día
 * para ver de un vistazo si hay reservas que se pisan y decidir cuáles aprobar. Tocar un bloque
 * abre su detalle (popover) con aprobar / rechazar.
 */
export function AdminSpaceBoard({
  onAction,
  processing,
  refetchKey = 0,
}: {
  onAction: OnAction;
  processing: string | null;
  refetchKey?: number;
}) {
  const { now, alignRevision } = useServerTime();
  const [anchorMs, setAnchorMs] = useState<number | null>(null);
  useEffect(() => {
    setAnchorMs(now().getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alignRevision]);

  /** 0 = esta semana y la siguiente; cada paso corre la ventana una semana. */
  const [weekOffset, setWeekOffset] = useState(0);
  const [onlyPending, setOnlyPending] = useState(false);

  const todayKey = anchorMs === null ? null : todayDateKeyInAdminTz(anchorMs);
  const { fromKey, toKey } = useMemo(() => {
    if (!todayKey) return { fromKey: null, toKey: null };
    const monday = addDaysToDateKey(mondayOfDateKey(todayKey), weekOffset * 7);
    return {
      // La primera ventana arranca hoy: lo que ya pasó no se decide.
      fromKey: weekOffset === 0 ? todayKey : monday,
      toKey: addDaysToDateKey(monday, WINDOW_DAYS - 1),
    };
  }, [todayKey, weekOffset]);

  const {
    data: range,
    loading,
    firstTime,
    refetch,
  } = useAdminReservationsRange(
    fromKey && toKey
      ? {
          spaceId: ALL_SPACES_ID,
          startMs: startOfDateKeyMs(fromKey),
          endMs: endOfDateKeyMs(toKey),
        }
      : null,
  );
  const { data: spaceOptions } = useSpaceOptions();

  // Refresco silencioso tras aprobar / rechazar.
  const prevRefetchKey = useRef(refetchKey);
  useEffect(() => {
    if (prevRefetchKey.current === refetchKey) return;
    prevRefetchKey.current = refetchKey;
    refetch();
  }, [refetchKey, refetch]);

  /** espacio → día → reservas vivas (las rechazadas y canceladas no ayudan a decidir). */
  const bySpace = useMemo(() => {
    const out = new Map<string, DaysMap>();
    for (const [dateKey, list] of Object.entries(range?.itemsByDate ?? {})) {
      for (const r of list) {
        if (r.status !== "PENDING" && r.status !== "APPROVED") continue;
        const days = out.get(r.resource.spaceName) ?? {};
        (days[dateKey] ??= []).push(r);
        out.set(r.resource.spaceName, days);
      }
    }
    return out;
  }, [range]);

  /** Los espacios en su orden configurado; los que traen reservas y no figuran van al final. */
  const spaceNames = useMemo(() => {
    const names = (spaceOptions ?? []).map((s) => s.name);
    for (const n of bySpace.keys()) if (!names.includes(n)) names.push(n);
    return names;
  }, [spaceOptions, bySpace]);

  const totalPending = useMemo(
    () =>
      Array.from(bySpace.values()).reduce(
        (sum, days) =>
          sum + Object.values(days).reduce((s, l) => s + pendingOf(l), 0),
        0,
      ),
    [bySpace],
  );

  if (anchorMs === null || firstTime) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const windowLabel =
    weekOffset === 0
      ? "Esta semana y la siguiente"
      : `${formatDate(parseDateStringLocal(fromKey!))} – ${formatDate(parseDateStringLocal(toKey!))}`;

  return (
    <section aria-labelledby="admin-space-board" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="admin-space-board"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <CalendarRange className="h-5 w-5" aria-hidden="true" />
            Próximas reservas
          </h2>
          <p className="text-sm text-muted-foreground">
            Por espacio y por día (hora de Argentina). Abrí un día para ver la
            línea de tiempo y decidir.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-fit rounded-md border border-border p-0.5">
            <Button
              type="button"
              variant={!onlyPending ? "secondary" : "ghost"}
              size="sm"
              className="rounded-sm"
              onClick={() => setOnlyPending(false)}
            >
              Todas
            </Button>
            <Button
              type="button"
              variant={onlyPending ? "secondary" : "ghost"}
              size="sm"
              className="rounded-sm"
              onClick={() => setOnlyPending(true)}
            >
              Pendientes
              {totalPending > 0 ? (
                <span className="ml-1.5 rounded-full bg-amber-200 px-1.5 text-xs font-semibold tabular-nums text-amber-950 dark:bg-amber-900 dark:text-amber-100">
                  {totalPending}
                </span>
              ) : null}
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Semana anterior"
              disabled={weekOffset === 0 || loading}
              onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span
              className="min-w-40 text-center text-sm font-medium tabular-nums"
              aria-live="polite"
            >
              {windowLabel}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Semana siguiente"
              disabled={loading}
              onClick={() => setWeekOffset((w) => w + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {weekOffset !== 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setWeekOffset(0)}
              >
                Hoy
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className={cn("space-y-6", loading && "opacity-60")}>
        {spaceNames.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay espacios reservables.
          </p>
        ) : (
          spaceNames.map((name) => (
            <SpaceSection
              key={name}
              name={name}
              days={bySpace.get(name) ?? {}}
              todayKey={todayKey!}
              onlyPending={onlyPending}
              processing={processing}
              onAction={onAction}
            />
          ))
        )}
      </div>
    </section>
  );
}

function SpaceSection({
  name,
  days,
  todayKey,
  onlyPending,
  processing,
  onAction,
}: {
  name: string;
  days: DaysMap;
  todayKey: string;
  onlyPending: boolean;
  processing: string | null;
  onAction: OnAction;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const total = Object.values(days).reduce((s, l) => s + l.length, 0);
  const pending = Object.values(days).reduce((s, l) => s + pendingOf(l), 0);

  /** Los días por los que se pagina: los que tienen reservas (con «Pendientes», los que tienen una). */
  const keys = useMemo(
    () =>
      Object.keys(days)
        .filter((k) => !onlyPending || pendingOf(days[k]!) > 0)
        .sort(),
    [days, onlyPending],
  );
  // Arranca en el primer día con reservas; si el elegido ya no está (se decidió la última, cambió
  // la ventana o el filtro), vuelve al primero.
  const current = selected && keys.includes(selected) ? selected : keys[0];
  const index = current ? keys.indexOf(current) : -1;
  const list = current ? days[current]! : [];
  const dayPending = pendingOf(list);
  const conflicts = current
    ? spacesInConflictCount(list, resourceMetas(list), current)
    : 0;
  const date = current ? parseDateStringLocal(current) : null;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 text-base font-semibold"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              !collapsed && "rotate-90",
            )}
            aria-hidden="true"
          />
          {name}
        </button>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          {total === 0
            ? "Sin reservas en este período"
            : `${total} reserva${total === 1 ? "" : "s"}`}
          {pending > 0 ? (
            <ToneBadge tone="warning">
              {pending} pendiente{pending === 1 ? "" : "s"}
            </ToneBadge>
          ) : null}
        </p>
      </div>

      {collapsed ? null : keys.length === 0 ? (
        total > 0 ? (
          <p className="text-sm text-muted-foreground">
            Nada pendiente en este período.
          </p>
        ) : null
      ) : current && date ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Día anterior con reservas"
                disabled={index <= 0}
                onClick={() => setSelected(keys[index - 1]!)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Día siguiente con reservas"
                disabled={index >= keys.length - 1}
                onClick={() => setSelected(keys[index + 1]!)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm font-medium" aria-live="polite">
              {formateWeekday(date)} {formatDate(date)}
              {current === todayKey ? (
                <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-la-nube-selected dark:text-la-nube-secondary">
                  Hoy
                </span>
              ) : null}
            </p>
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {list.length} reserva{list.length === 1 ? "" : "s"}
              {dayPending > 0 ? (
                <ToneBadge tone="warning">{dayPending} pend.</ToneBadge>
              ) : null}
              {conflicts > 0 ? (
                <ToneBadge tone="danger">Se pisan</ToneBadge>
              ) : null}
            </span>
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              Día {index + 1} de {keys.length}
            </span>
          </div>
          <AdminServiceTimelineLegend />
          <AdminServiceDayTimeline
            dateKey={current}
            reservationsForCapacity={list}
            pendingOnly={false}
            processing={processing}
            onAction={onAction}
          />
        </div>
      ) : null}
    </div>
  );
}
