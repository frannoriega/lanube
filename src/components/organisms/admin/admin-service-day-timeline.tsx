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

const LABEL_W = 132;
const HEADER_H = 44;
const RESOURCE_HEADER_H = 40;

/** Normalize API/status casing so styling branches stay correct. */
function reservationStatusKey(
  r: AdminReservationListResult,
): "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "OTHER" {
  const s = String(r.status ?? "")
    .trim()
    .toUpperCase();
  if (
    s === "PENDING" ||
    s === "APPROVED" ||
    s === "REJECTED" ||
    s === "CANCELLED"
  ) {
    return s;
  }
  return "OTHER";
}
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

function registeredUserBucketKey(res: AdminReservationListResult): string {
  const dni = res.registeredUser.dni?.trim();
  if (dni.length > 0) return `dni:${dni}`;
  return `email:${res.registeredUser.user.email}`;
}

function actorSizeLabelForBucket(
  reservations: AdminReservationListResult[],
): string {
  const sizes = [...new Set(reservations.map((r) => r.actorSize))].sort(
    (a, b) => a - b,
  );
  if (sizes.length === 0) return "";
  if (sizes.length === 1) return `${sizes[0]}p`;
  const lo = sizes[0]!;
  const hi = sizes[sizes.length - 1]!;
  return lo === hi ? `${lo}p` : `${lo}–${hi} p`;
}

type ClippedItem = {
  id: string;
  res: AdminReservationListResult;
  start: number;
  end: number;
};

function heatmapCellClass(L: LoadLevel): string {
  switch (L) {
    case "none":
      return "bg-transparent";
    case "safe":
      return "bg-green-300 dark:bg-green-900";
    case "caution":
      return "bg-amber-300 dark:bg-amber-900";
    case "overload":
      return "bg-red-300 dark:bg-red-900";
  }
}

function blockVisualClass(
  r: AdminReservationListResult,
  pendingLoad: LoadLevel,
  showAll: boolean,
): string {
  const st = reservationStatusKey(r);
  if (st === "APPROVED") {
    return cn(
      // !border-solid: avoid tailwind-merge / other utilities collapsing to dashed
      "!border-solid border-2 border-blue-700 bg-blue-300 text-neutral-950 shadow-sm",
      "dark:border-blue-400 dark:bg-blue-800 dark:text-blue-50",
    );
  }
  if ((st === "REJECTED" || st === "CANCELLED") && showAll) {
    return cn(
      "!border-solid border-2 border-neutral-600 bg-neutral-200 text-neutral-900",
      "dark:border-neutral-500 dark:bg-neutral-900 dark:text-neutral-100",
    );
  }
  if (pendingLoad === "overload") {
    return cn(
      "border-2 border-dashed border-red-800 bg-red-300 text-neutral-950",
      "dark:border-red-400 dark:bg-red-900 dark:text-red-50",
    );
  }
  if (pendingLoad === "caution") {
    return cn(
      "border-2 border-dashed border-amber-800 bg-amber-300 text-neutral-950",
      "dark:border-amber-400 dark:bg-amber-900 dark:text-amber-50",
    );
  }
  return cn(
    "border-2 border-dashed border-green-800 bg-green-300 text-neutral-950",
    "dark:border-green-400 dark:bg-green-900 dark:text-green-50",
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

function timelineGridBackground(metaId: string, slotCount: number) {
  return (
    <div
      className="absolute inset-0 flex pointer-events-none"
      aria-hidden
    >
      {Array.from({ length: slotCount }, (_, i) => (
        <div
          key={`g-${metaId}-${i}`}
          className={cn(
            "border-r border-neutral-300 h-full bg-muted/5 dark:border-border/50",
            i % 4 === 0 &&
              "border-l border-l-neutral-400 dark:border-l-border",
          )}
          style={{
            width: SLOT_WIDTH_PX,
            minWidth: SLOT_WIDTH_PX,
          }}
        />
      ))}
    </div>
  );
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
  /** When true, show service type under each space name (hall header). */
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

  const showPerResourceStrip = resourcesMeta.length > 1;
  const singleHeaderMeta =
    resourcesMeta.length === 1 ? resourcesMeta[0]! : null;

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
    <div className="w-full min-w-0 rounded-md border border-neutral-300 overflow-hidden bg-background dark:border-border">
      <div className="flex flex-col">
        <div className="flex min-h-0 border-b border-neutral-300 dark:border-border">
          <div
            className="shrink-0 border-r border-neutral-300 bg-muted/30 px-1.5 py-0.5 dark:border-border flex flex-col justify-center gap-0.5"
            style={{ width: LABEL_W, minHeight: HEADER_H }}
          >
            {singleHeaderMeta ? (
              <>
                <p className="text-[11px] font-semibold leading-tight line-clamp-2 text-neutral-950 dark:text-foreground">
                  {singleHeaderMeta.name}
                </p>
                {showResourceTypeLabels ? (
                  <p className="text-[9px] text-neutral-700 uppercase tracking-wide leading-tight dark:text-muted-foreground">
                    {resourceTypeLabel(singleHeaderMeta.type)}
                  </p>
                ) : null}
                <p className="text-[10px] text-neutral-800 tabular-nums leading-tight dark:text-muted-foreground">
                  Cap: {singleHeaderMeta.capacity}
                </p>
              </>
            ) : null}
          </div>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div
              className="relative flex border-b border-neutral-300 dark:border-border"
              style={{ width: gridWidth, minHeight: HEADER_H }}
            >
              {Array.from({ length: slotCount }, (_, i) => {
                const slot = new Date(t0 + i * SLOT_MS);
                return (
                  <div
                    key={`h-${i}`}
                    className={cn(
                      "flex flex-col justify-end border-r border-neutral-300 text-[11px] text-neutral-800 dark:border-border/60 dark:text-muted-foreground",
                      i % 4 === 0 &&
                        "border-l border-l-neutral-400 dark:border-l-border",
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

        <div className="flex border-b border-neutral-300 dark:border-border">
          <div
            className="flex shrink-0 items-center border-r border-neutral-300 bg-muted/20 px-2 text-[13px] font-medium text-neutral-900 dark:border-border dark:text-foreground"
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
                    "border-r border-neutral-300 h-8 dark:border-border/40",
                    i % 4 === 0 &&
                      "border-l border-l-neutral-400 dark:border-l-border",
                    heatmapCellClass(L),
                  )}
                  style={{ width: SLOT_WIDTH_PX, minWidth: SLOT_WIDTH_PX }}
                />
              ))}
            </div>
          </div>
        </div>

        {resourcesMeta.length === 0 ? (
          <div className="p-6 text-center text-sm text-neutral-700 dark:text-muted-foreground">
            No hay espacios con reservas en este rango.
          </div>
        ) : (
          resourcesMeta.map((meta) => {
            const visible = reservationsForCapacity.filter((r) => {
              if (r.resource.id !== meta.id) return false;
              if (!pendingOnly) return true;
              return r.status === "PENDING";
            });

            const clippedItems: ClippedItem[] = visible
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
              .filter((x): x is ClippedItem => x !== null);

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

            const byUser = new Map<string, ClippedItem[]>();
            for (const item of clippedItems) {
              const k = registeredUserBucketKey(item.res);
              const arr = byUser.get(k) ?? [];
              arr.push(item);
              byUser.set(k, arr);
            }

            const userBuckets = Array.from(byUser.entries())
              .map(([bucketKey, items]) => {
                const first = items[0]!.res;
                const displayName =
                  `${first.registeredUser.name} ${first.registeredUser.lastName}`.trim();
                const sortKey =
                  `${first.registeredUser.name}\0${first.registeredUser.lastName}`.toLowerCase();
                const actorLabel = actorSizeLabelForBucket(
                  items.map((i) => i.res),
                );
                return {
                  bucketKey,
                  items,
                  displayName,
                  sortKey,
                  actorLabel,
                };
              })
              .sort((a, b) => a.sortKey.localeCompare(b.sortKey, "es"));

            return (
              <div
                key={meta.id}
                className="flex flex-col border-b border-neutral-300 last:border-b-0 dark:border-border"
              >
                {showPerResourceStrip ? (
                  <div className="flex min-h-0 border-b border-neutral-300 bg-muted/10 dark:border-border">
                    <div
                      className="shrink-0 border-r border-neutral-300 py-1.5 pl-2 pr-1 dark:border-border"
                      style={{ width: LABEL_W, minHeight: RESOURCE_HEADER_H }}
                    >
                      <p className="text-[13px] font-semibold leading-tight line-clamp-2 text-neutral-950 dark:text-foreground">
                        {meta.name}
                      </p>
                      {showResourceTypeLabels ? (
                        <p className="text-[10px] text-neutral-700 uppercase tracking-wide mt-0.5 dark:text-muted-foreground">
                          {resourceTypeLabel(meta.type)}
                        </p>
                      ) : null}
                      <p className="text-[11px] text-neutral-800 mt-0.5 dark:text-muted-foreground">
                        Cap: {meta.capacity}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1 overflow-x-auto">
                      <div
                        style={{
                          width: gridWidth,
                          minHeight: RESOURCE_HEADER_H,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {userBuckets.length === 0 ? (
                  <div className="flex border-b border-neutral-300 last:border-b-0 dark:border-border">
                    <div
                      className="shrink-0 border-r border-neutral-300 py-2 pl-2 pr-1 text-[11px] text-neutral-700 dark:border-border dark:text-muted-foreground"
                      style={{ width: LABEL_W }}
                    >
                      —
                    </div>
                    <div className="min-w-0 flex-1 overflow-x-auto">
                      <div
                        className="relative"
                        style={{
                          width: gridWidth,
                          minHeight: TRACK_H + 8,
                        }}
                      >
                        {timelineGridBackground(meta.id, slotCount)}
                      </div>
                    </div>
                  </div>
                ) : (
                  userBuckets.map((bucket) => {
                    const tracks = assignTracks(
                      bucket.items.map((x) => ({
                        id: x.id,
                        start: x.start,
                        end: x.end,
                      })),
                    );
                    const nTracks =
                      bucket.items.length === 0
                        ? 1
                        : Math.max(1, Math.max(...tracks.values()) + 1);
                    const rowBodyH = Math.max(TRACK_H, nTracks * TRACK_H + 8);

                    return (
                      <div
                        key={bucket.bucketKey}
                        className="flex border-b border-neutral-300 last:border-b-0 dark:border-border"
                      >
                        <div
                          className="shrink-0 border-r border-neutral-300 py-2 pl-2 pr-1 dark:border-border"
                          style={{ width: LABEL_W }}
                        >
                          <p className="text-[13px] font-medium leading-tight line-clamp-2 text-neutral-950 dark:text-foreground">
                            {bucket.displayName}
                          </p>
                          <p className="text-[11px] text-neutral-800 mt-0.5 tabular-nums dark:text-muted-foreground">
                            {bucket.actorLabel}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1 overflow-x-auto">
                          <div
                            className="relative"
                            style={{
                              width: gridWidth,
                              minHeight: rowBodyH,
                            }}
                          >
                            {timelineGridBackground(meta.id, slotCount)}

                            {bucket.items.map(({ res, start, end }) => {
                              const { startBlock, spanBlocks } =
                                blockGridPosition(start, end, dateKey);
                              const leftPct = (startBlock / slotCount) * 100;
                              const widthPct = (spanBlocks / slotCount) * 100;
                              const track = tracks.get(res.id) ?? 0;
                              const top = BLOCK_TOP + track * TRACK_H;

                              const pendingLoad =
                                reservationStatusKey(res) === "PENDING"
                                  ? worstLoadForPendingReservation(
                                      res,
                                      reservationsForCapacity,
                                      dateKey,
                                    )
                                  : "safe";

                              const st = reservationStatusKey(res);
                              const statusEs =
                                st === "PENDING"
                                  ? "pendiente"
                                  : st === "APPROVED"
                                    ? "aprobada"
                                    : st === "REJECTED"
                                      ? "rechazada"
                                      : st === "CANCELLED"
                                        ? "cancelada"
                                        : res.status;
                              const aria = `${res.registeredUser.name} ${res.registeredUser.lastName}, ${formatTime(new Date(res.startTime))} a ${formatTime(new Date(res.endTime))}, ${res.actorSize} personas, ${statusEs}`;
                              const titleShort = `${formatTime(new Date(res.startTime))} – ${formatTime(new Date(res.endTime))}`;

                              return (
                                <button
                                  key={res.id}
                                  type="button"
                                  className={cn(
                                    "absolute z-[1] overflow-hidden rounded px-0 text-left",
                                    blockVisualClass(res, pendingLoad, !pendingOnly),
                                  )}
                                  style={{
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`,
                                    minWidth: widthPct < 8 ? 24 : undefined,
                                    top,
                                    height: BLOCK_H,
                                    ...(st === "APPROVED" ||
                                    ((st === "REJECTED" || st === "CANCELLED") &&
                                      !pendingOnly)
                                      ? { borderStyle: "solid" as const }
                                      : {}),
                                  }}
                                  aria-label={aria}
                                  title={titleShort}
                                  onClick={() => onSelectReservation(res)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-800 dark:text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-sm border border-green-700 bg-green-300 dark:border-green-400 dark:bg-green-900" />
        Seguro
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-sm border border-amber-700 bg-amber-300 dark:border-amber-400 dark:bg-amber-900" />
        Precaución (&gt;80%)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-sm border border-red-800 bg-red-300 dark:border-red-400 dark:bg-red-900" />
        Sobrecarga
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-sm !border-solid border-2 border-blue-700 bg-blue-300 dark:border-blue-400 dark:bg-blue-800" />
        Aprobada
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-sm !border-solid border-2 border-neutral-600 bg-neutral-200 dark:border-neutral-500 dark:bg-neutral-900" />
        Rechazada / cancelada
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-3 rounded border-2 border-dashed border-green-800 bg-green-300 dark:border-green-400 dark:bg-green-900" />
        Pendiente (borde discontinuo)
      </span>
    </div>
  );
}
