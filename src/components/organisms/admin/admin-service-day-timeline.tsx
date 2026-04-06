"use client";

import { AdminReservationListResult } from "@/components/templates/admin/dashboard-recent-reservations";
import { ResourceType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils/date";
import {
  type LoadLevel,
  SLOT_WIDTH_PX,
  adminDayTimelineStartMs,
  blockGridPosition,
  clipToTimeline,
  heatmapRowLevels,
  timelineSlotCount,
  worstLoadForPendingReservation,
} from "@/lib/admin/admin-timeline";
import { useMemo } from "react";

const LABEL_W = 120;
const HEADER_H = 44;
const TRACK_H = 32;
const BLOCK_H = 24;
const BLOCK_TOP = 4;

function resourceTypeLabel(t: ResourceType): string {
  switch (t) {
    case "COWORKING":
      return "Coworking";
    case "LAB":
      return "Laboratorio";
    case "AUDITORIUM":
      return "Auditorio";
    case "MEETING":
      return "Reuniones";
    default:
      return t;
  }
}

function uniqueResources(items: AdminReservationListResult[]) {
  const m = new Map<
    string,
    {
      id: string;
      name: string;
      capacity: number;
      type: ResourceType;
      isExclusive: boolean;
    }
  >();
  for (const r of items) {
    if (!m.has(r.resource.id)) {
      m.set(r.resource.id, {
        id: r.resource.id,
        name: r.resource.name,
        capacity: r.resource.capacity,
        type: r.resource.type,
        isExclusive: r.resource.isExclusive,
      });
    }
  }
  return Array.from(m.values()).sort((a, b) => {
    const byType = a.type.localeCompare(b.type);
    if (byType !== 0) return byType;
    return a.name.localeCompare(b.name, "es");
  });
}

function heatmapCellClass(L: LoadLevel): string {
  switch (L) {
    case "none":
      return "bg-transparent";
    case "safe":
      return "bg-green-500/15 dark:bg-green-600/20";
    case "caution":
      return "bg-amber-500/20 dark:bg-amber-600/25";
    case "overload":
      return "bg-red-500/25 dark:bg-red-600/30";
  }
}

function blockVisualClass(
  r: AdminReservationListResult,
  pendingLoad: LoadLevel,
  showAll: boolean,
): string {
  if (r.status === "APPROVED") {
    return cn(
      "border border-blue-400 bg-blue-50 text-blue-900 shadow-sm",
      "dark:bg-blue-950/55 dark:text-blue-100 dark:border-blue-600",
      "border-solid",
    );
  }
  if (r.status === "REJECTED" && showAll) {
    return cn(
      "border border-neutral-300 bg-neutral-100 text-neutral-700",
      "dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-300",
      "border-dashed",
    );
  }
  const dashed = "border-dashed";
  if (pendingLoad === "overload") {
    return cn(
      dashed,
      "border-red-400 bg-red-50 text-red-900 dark:bg-red-950/45 dark:text-red-100 dark:border-red-500",
    );
  }
  if (pendingLoad === "caution") {
    return cn(
      dashed,
      "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/45 dark:text-amber-100 dark:border-amber-500",
    );
  }
  return cn(
    dashed,
    "border-green-400 bg-green-50 text-green-900 dark:bg-green-950/45 dark:text-green-100 dark:border-green-500",
  );
}

function assignTracks(
  items: { id: string; start: number; end: number }[],
): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.start - b.start);
  const trackEnds: number[] = [];
  const map = new Map<string, number>();
  for (const item of sorted) {
    let placed = false;
    for (let t = 0; t < trackEnds.length; t++) {
      if (trackEnds[t] <= item.start) {
        map.set(item.id, t);
        trackEnds[t] = item.end;
        placed = true;
        break;
      }
    }
    if (!placed) {
      trackEnds.push(item.end);
      map.set(item.id, trackEnds.length - 1);
    }
  }
  return map;
}

export function AdminServiceDayTimeline({
  dateKey,
  reservationsForCapacity,
  pendingOnly,
  showResourceTypeLabels = false,
  onSelectReservation,
}: {
  dateKey: string;
  reservationsForCapacity: AdminReservationListResult[];
  pendingOnly: boolean;
  /** When true, show service type under each space name (all-services dashboard). */
  showResourceTypeLabels?: boolean;
  onSelectReservation: (r: AdminReservationListResult) => void;
}) {
  const slotCount = timelineSlotCount();
  const gridWidth = slotCount * SLOT_WIDTH_PX;

  const resourcesMeta = useMemo(
    () => uniqueResources(reservationsForCapacity),
    [reservationsForCapacity],
  );

  const capacityMeta = useMemo(
    () =>
      resourcesMeta.map((r) => ({
        id: r.id,
        capacity: r.capacity,
        isExclusive: r.isExclusive,
      })),
    [resourcesMeta],
  );

  const heatLevels = useMemo(
    () => heatmapRowLevels(reservationsForCapacity, capacityMeta, dateKey),
    [reservationsForCapacity, capacityMeta, dateKey],
  );

  const t0 = adminDayTimelineStartMs(dateKey);
  const t1End = t0 + slotCount * 15 * 60 * 1000;
  const SLOT_MS = 15 * 60 * 1000;

  if (process.env.NODE_ENV === "development" && reservationsForCapacity.length > 0) {
    const sample = reservationsForCapacity[0];
    console.info(
      "[AdminTimeline] dateKey=%s, timelineRange=[%s, %s], resources=%d, total=%d, sample: id=%s start=%d end=%d status=%s resource=%s",
      dateKey,
      new Date(t0).toISOString(),
      new Date(t1End).toISOString(),
      resourcesMeta.length,
      reservationsForCapacity.length,
      sample.id,
      sample.startTime,
      sample.endTime,
      sample.status,
      sample.resource.id,
    );
    const clipped = clipToTimeline(sample, dateKey);
    console.info(
      "[AdminTimeline] sample clipToTimeline => %o  (null = outside 8:00–20:00 window)",
      clipped,
    );
  }

  return (
    <div className="w-full min-w-0 rounded-md border border-border overflow-hidden bg-background">
      {/* Header + heatmap + space rows */}
      <div className="flex flex-col">
        {/* Time header */}
        <div className="flex min-h-0 border-b border-border">
          <div
            className="shrink-0 border-r border-border bg-muted/30"
            style={{ width: LABEL_W, minHeight: HEADER_H }}
          />
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div
              className="relative flex border-b border-border"
              style={{ width: gridWidth, minHeight: HEADER_H }}
            >
              {Array.from({ length: slotCount }, (_, i) => {
                const slot = new Date(t0 + i * SLOT_MS);
                return (
                  <div
                    key={`h-${i}`}
                    className={cn(
                      "flex flex-col justify-end border-r border-border/60 text-[11px] text-muted-foreground",
                      i % 4 === 0 && "border-l border-l-border",
                    )}
                    style={{
                      width: SLOT_WIDTH_PX,
                      minWidth: SLOT_WIDTH_PX,
                      height: HEADER_H,
                    }}
                  >
                    <div className="px-0.5 pb-0.5">
                      {i % 4 === 0 ? formatTime(slot) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Ocupación heatmap */}
        <div className="flex border-b border-border">
          <div
            className="flex shrink-0 items-center border-r border-border bg-muted/20 px-2 text-[13px] font-medium"
            style={{ width: LABEL_W }}
          >
            <span className="leading-tight">Ocupación</span>
          </div>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex" style={{ width: gridWidth }}>
              {heatLevels.map((L, i) => (
                <div
                  key={`hm-${i}`}
                  className={cn(
                    "border-r border-border/40 h-8",
                    i % 4 === 0 && "border-l border-l-border",
                    heatmapCellClass(L),
                  )}
                  style={{ width: SLOT_WIDTH_PX, minWidth: SLOT_WIDTH_PX }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Space rows */}
        {resourcesMeta.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No hay espacios con reservas en este rango.
          </div>
        ) : (
          resourcesMeta.map((meta) => {
            const visible = reservationsForCapacity.filter((r) => {
              if (r.resource.id !== meta.id) return false;
              if (!pendingOnly) return true;
              return r.status === "PENDING";
            });

            const clippedItems = visible
              .map((r) => {
                const c = clipToTimeline(r, dateKey);
                if (!c && process.env.NODE_ENV === "development") {
                  console.warn(
                    "[AdminTimeline] clipToTimeline returned null for reservation id=%s start=%d (%s) end=%d (%s) — outside timeline [%s, %s]",
                    r.id,
                    r.startTime,
                    new Date(r.startTime).toISOString(),
                    r.endTime,
                    new Date(r.endTime).toISOString(),
                    new Date(t0).toISOString(),
                    new Date(t1End).toISOString(),
                  );
                }
                if (!c) return null;
                return { id: r.id, res: r, start: c.start, end: c.end };
              })
              .filter(
                (x): x is NonNullable<typeof x> => x !== null,
              );

            if (process.env.NODE_ENV === "development") {
              console.info(
                "[AdminTimeline] resource=%s (%s) visible=%d clipped=%d pendingOnly=%s",
                meta.id,
                meta.name,
                visible.length,
                clippedItems.length,
                pendingOnly,
              );
            }

            const tracks = assignTracks(
              clippedItems.map((x) => ({
                id: x.id,
                start: x.start,
                end: x.end,
              })),
            );
            const nTracks =
              clippedItems.length === 0
                ? 1
                : Math.max(1, Math.max(...tracks.values()) + 1);
            const rowBodyH = Math.max(TRACK_H, nTracks * TRACK_H + 8);

            return (
              <div key={meta.id} className="flex border-b border-border last:border-b-0">
                <div
                  className="shrink-0 border-r border-border py-2 pl-2 pr-1"
                  style={{ width: LABEL_W }}
                >
                  <p className="text-[13px] font-medium leading-tight line-clamp-2">
                    {meta.name}
                  </p>
                  {showResourceTypeLabels ? (
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                      {resourceTypeLabel(meta.type)}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Cap: {meta.capacity}
                  </p>
                </div>
                <div className="min-w-0 flex-1 overflow-x-auto">
                  <div
                    className="relative"
                    style={{ width: gridWidth, minHeight: rowBodyH }}
                  >
                    {/* Grid background */}
                    <div
                      className="absolute inset-0 flex pointer-events-none"
                      aria-hidden
                    >
                      {Array.from({ length: slotCount }, (_, i) => (
                        <div
                          key={`g-${meta.id}-${i}`}
                          className={cn(
                            "border-r border-border/50 h-full bg-muted/5",
                            i % 4 === 0 && "border-l border-l-border",
                          )}
                          style={{
                            width: SLOT_WIDTH_PX,
                            minWidth: SLOT_WIDTH_PX,
                          }}
                        />
                      ))}
                    </div>

                    {clippedItems.map(({ res, start, end }) => {
                      const { startBlock, spanBlocks } = blockGridPosition(
                        start,
                        end,
                        dateKey,
                      );
                      const leftPct = (startBlock / slotCount) * 100;
                      const widthPct = (spanBlocks / slotCount) * 100;
                      const track = tracks.get(res.id) ?? 0;
                      const top = BLOCK_TOP + track * TRACK_H;

                      const pendingLoad =
                        res.status === "PENDING"
                          ? worstLoadForPendingReservation(
                              res,
                              reservationsForCapacity,
                              dateKey,
                            )
                          : "safe";

                      const label = `${res.registeredUser.name} · ${res.actorSize}p`;
                      const aria = `${res.registeredUser.name} ${res.registeredUser.lastName}, ${formatTime(new Date(res.startTime))} a ${formatTime(new Date(res.endTime))}, ${res.actorSize} personas, ${res.status === "PENDING" ? "pendiente" : res.status === "APPROVED" ? "aprobada" : "rechazada"}, ${res.reason || "sin descripción"}`;

                      return (
                        <button
                          key={res.id}
                          type="button"
                          className={cn(
                            "absolute z-[1] flex items-center overflow-hidden rounded px-1 text-left text-[11px] font-normal leading-tight",
                            blockVisualClass(res, pendingLoad, !pendingOnly),
                          )}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            minWidth: widthPct < 8 ? 24 : undefined,
                            top,
                            height: BLOCK_H,
                          }}
                          aria-label={aria}
                          title={res.reason}
                          onClick={() => onSelectReservation(res)}
                        >
                          {widthPct > 12 ? (
                            <span className="block truncate">{label}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function AdminServiceTimelineLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-sm bg-green-500/30 border border-green-500/50" />
        Seguro
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-sm bg-amber-500/30 border border-amber-500/50" />
        Precaución (&gt;80%)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-sm bg-red-500/30 border border-red-500/50" />
        Sobrecarga
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-sm bg-blue-500/30 border border-blue-500/50" />
        Aprobada
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-3 rounded border-2 border-dashed border-muted-foreground/60 bg-transparent" />
        Pendiente (borde discontinuo)
      </span>
    </div>
  );
}
