import type { AdminReservationListResult } from "@/components/templates/admin/dashboard-recent-reservations";
import { TZDate } from "@date-fns/tz";
import { ADMIN_TIMEZONE } from "@/lib/admin/admin-timezone";

export const TIMELINE_FIRST_HOUR = 8;
export const TIMELINE_LAST_HOUR = 20;
export const SLOT_MINUTES = 15;
export const SLOT_WIDTH_PX = 16;

const SLOT_MS = SLOT_MINUTES * 60 * 1000;

export type LoadLevel = "none" | "safe" | "caution" | "overload";

export type ResourceCapacityMeta = {
  id: string;
  capacity: number;
  isExclusive: boolean;
};

export function adminDayTimelineStartMs(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new TZDate(
    y,
    m - 1,
    d,
    TIMELINE_FIRST_HOUR,
    0,
    0,
    0,
    ADMIN_TIMEZONE,
  ).getTime();
}

export function adminDayTimelineEndMs(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new TZDate(
    y,
    m - 1,
    d,
    TIMELINE_LAST_HOUR,
    0,
    0,
    0,
    ADMIN_TIMEZONE,
  ).getTime();
}

export function timelineSlotCount(): number {
  return ((TIMELINE_LAST_HOUR - TIMELINE_FIRST_HOUR) * 60) / SLOT_MINUTES;
}

function countsForCapacity(status: string): boolean {
  return status === "PENDING" || status === "APPROVED";
}

function compareLoad(a: LoadLevel, b: LoadLevel): LoadLevel {
  const rank: Record<LoadLevel, number> = {
    none: 0,
    safe: 1,
    caution: 2,
    overload: 3,
  };
  return rank[b] > rank[a] ? b : a;
}

function loadFromRatio(sum: number, capacity: number): LoadLevel {
  if (sum <= 0) return "none";
  const ratio = capacity > 0 ? sum / capacity : 0;
  if (ratio > 1) return "overload";
  if (ratio >= 0.8) return "caution";
  return "safe";
}

function slotLoadLevel(
  isExclusive: boolean,
  sum: number,
  overlapCount: number,
  capacity: number,
): LoadLevel {
  if (overlapCount === 0) return "none";
  if (isExclusive) {
    if (overlapCount >= 2 || sum > capacity) return "overload";
    return "safe";
  }
  return loadFromRatio(sum, capacity);
}

export function buildSlotLoadByResource(
  reservations: AdminReservationListResult[],
  resourceId: string,
  capacity: number,
  dateKey: string,
  isExclusive: boolean,
): LoadLevel[] {
  const slotCount = timelineSlotCount();
  const t0 = adminDayTimelineStartMs(dateKey);
  const t1 = adminDayTimelineEndMs(dateKey);
  const forRes = reservations.filter(
    (r) => r.resource.id === resourceId && countsForCapacity(r.status),
  );
  const out: LoadLevel[] = [];
  for (let i = 0; i < slotCount; i++) {
    const slotStart = t0 + i * SLOT_MS;
    const slotEnd = slotStart + SLOT_MS;
    if (slotStart >= t1) {
      out.push("none");
      continue;
    }
    const overlapping = forRes.filter(
      (r) => r.startTime < slotEnd && r.endTime > slotStart,
    );
    const sum = overlapping.reduce((s, r) => s + r.actorSize, 0);
    const overlapCount = overlapping.length;
    out.push(slotLoadLevel(isExclusive, sum, overlapCount, capacity));
  }
  return out;
}

export function heatmapRowLevels(
  reservations: AdminReservationListResult[],
  resourcesMeta: ResourceCapacityMeta[],
  dateKey: string,
): LoadLevel[] {
  const slotCount = timelineSlotCount();
  const levels: LoadLevel[] = [];
  for (let i = 0; i < slotCount; i++) {
    let worst: LoadLevel = "none";
    for (const meta of resourcesMeta) {
      const row = buildSlotLoadByResource(
        reservations,
        meta.id,
        meta.capacity,
        dateKey,
        meta.isExclusive,
      );
      worst = compareLoad(worst, row[i] ?? "none");
    }
    levels.push(worst);
  }
  return levels;
}

export function worstLoadForPendingReservation(
  reservation: AdminReservationListResult,
  allForCapacity: AdminReservationListResult[],
  dateKey: string,
): LoadLevel {
  const slotCount = timelineSlotCount();
  const t0 = adminDayTimelineStartMs(dateKey);
  const t1 = adminDayTimelineEndMs(dateKey);
  const cap = reservation.resource.capacity;
  const rid = reservation.resource.id;
  const isExclusive = reservation.resource.isExclusive;
  let worst: LoadLevel = "none";
  for (let i = 0; i < slotCount; i++) {
    const slotStart = t0 + i * SLOT_MS;
    const slotEnd = slotStart + SLOT_MS;
    if (slotStart >= t1) break;
    if (!(reservation.startTime < slotEnd && reservation.endTime > slotStart)) {
      continue;
    }
    const overlapping = allForCapacity.filter(
      (r) =>
        countsForCapacity(r.status) &&
        r.resource.id === rid &&
        r.startTime < slotEnd &&
        r.endTime > slotStart,
    );
    const sum = overlapping.reduce((s, r) => s + r.actorSize, 0);
    const overlapCount = overlapping.length;
    worst = compareLoad(
      worst,
      slotLoadLevel(isExclusive, sum, overlapCount, cap),
    );
  }
  return worst;
}

export function clipToTimeline(
  r: AdminReservationListResult,
  dateKey: string,
): { start: number; end: number } | null {
  const t0 = adminDayTimelineStartMs(dateKey);
  const t1 = adminDayTimelineEndMs(dateKey);
  const start = Math.max(r.startTime, t0);
  const end = Math.min(r.endTime, t1);
  if (end <= start) return null;
  return { start, end };
}

export function blockGridPosition(
  start: number,
  end: number,
  dateKey: string,
): { startBlock: number; spanBlocks: number } {
  const t0 = adminDayTimelineStartMs(dateKey);
  const slotCount = timelineSlotCount();
  const startBlock = Math.max(0, Math.floor((start - t0) / SLOT_MS));
  const endBlock = Math.min(slotCount, Math.ceil((end - t0) / SLOT_MS));
  const spanBlocks = Math.max(1, endBlock - startBlock);
  return { startBlock, spanBlocks };
}

export function spacesInConflictCount(
  reservations: AdminReservationListResult[],
  resourcesMeta: ResourceCapacityMeta[],
  dateKey: string,
): number {
  let n = 0;
  for (const meta of resourcesMeta) {
    const row = buildSlotLoadByResource(
      reservations,
      meta.id,
      meta.capacity,
      dateKey,
      meta.isExclusive,
    );
    if (row.some((L) => L === "overload")) n += 1;
  }
  return n;
}

export function peakOccupancyRatio(
  reservations: AdminReservationListResult[],
  resourcesMeta: ResourceCapacityMeta[],
  dateKey: string,
): number {
  let peak = 0;
  const slotCount = timelineSlotCount();
  for (const meta of resourcesMeta) {
    const t0 = adminDayTimelineStartMs(dateKey);
    const t1 = adminDayTimelineEndMs(dateKey);
    const forRes = reservations.filter(
      (r) => r.resource.id === meta.id && countsForCapacity(r.status),
    );
    for (let i = 0; i < slotCount; i++) {
      const slotStart = t0 + i * SLOT_MS;
      const slotEnd = slotStart + SLOT_MS;
      if (slotStart >= t1) break;
      let sum = 0;
      for (const r of forRes) {
        if (r.startTime < slotEnd && r.endTime > slotStart) {
          sum += r.actorSize;
        }
      }
      const ratio = meta.capacity > 0 ? sum / meta.capacity : 0;
      if (ratio > peak) peak = ratio;
    }
  }
  return peak;
}
