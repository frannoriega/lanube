import type { AdminReservationListResult } from "@/components/templates/admin/dashboard-recent-reservations";
import { ResourceType } from "@/generated/prisma/enums";
import { describe, expect, it } from "vitest";
import {
  TIMELINE_FIRST_HOUR,
  adminDayTimelineStartMs,
  buildSlotLoadByResource,
  heatmapRowLevels,
  worstLoadForPendingReservation,
} from "./admin-timeline";

const registeredUserStub = {
  name: "A",
  lastName: "B",
  dni: "1",
  institution: null as string | null,
  user: { email: "a@b.c" },
};

function baseReservation(
  overrides: Partial<AdminReservationListResult> & {
    id: string;
    startTime: number;
    endTime: number;
    resource: AdminReservationListResult["resource"];
  },
): AdminReservationListResult {
  return {
    reason: "",
    status: "PENDING",
    createdAt: 0,
    actorSize: 1,
    registeredUser: registeredUserStub,
    ...overrides,
  };
}

describe("admin-timeline exclusive resources", () => {
  const dateKey = "2025-06-15";
  const t0 = adminDayTimelineStartMs(dateKey);
  const hour = 60 * 60 * 1000;
  const tenAm = t0 + (10 - TIMELINE_FIRST_HOUR) * hour;
  const elevenAm = tenAm + hour;

  it("exclusive: single booking near capacity is safe, not caution", () => {
    const rid = "res-1";
    const reservations = [
      baseReservation({
        id: rid,
        startTime: tenAm,
        endTime: elevenAm,
        actorSize: 9,
        resource: {
          id: "space-1",
          name: "S",
          type: ResourceType.COWORKING,
          capacity: 10,
          isExclusive: true,
        },
      }),
    ];
    const levels = buildSlotLoadByResource(
      reservations,
      "space-1",
      10,
      dateKey,
      true,
    );
    expect(levels.some((L) => L === "caution")).toBe(false);
    expect(levels.some((L) => L === "safe")).toBe(true);
    expect(levels.some((L) => L === "overload")).toBe(false);
  });

  it("exclusive: two overlapping reservations yield overload", () => {
    const reservations = [
      baseReservation({
        id: "a",
        startTime: tenAm,
        endTime: elevenAm,
        actorSize: 1,
        resource: {
          id: "space-1",
          name: "S",
          type: ResourceType.LAB,
          capacity: 10,
          isExclusive: true,
        },
      }),
      baseReservation({
        id: "b",
        startTime: tenAm,
        endTime: elevenAm,
        actorSize: 1,
        resource: {
          id: "space-1",
          name: "S",
          type: ResourceType.LAB,
          capacity: 10,
          isExclusive: true,
        },
      }),
    ];
    const levels = buildSlotLoadByResource(
      reservations,
      "space-1",
      10,
      dateKey,
      true,
    );
    expect(levels.some((L) => L === "overload")).toBe(true);
  });

  it("non-exclusive: high ratio without overload uses caution", () => {
    const reservations = [
      baseReservation({
        id: "x",
        startTime: tenAm,
        endTime: elevenAm,
        actorSize: 9,
        resource: {
          id: "space-2",
          name: "T",
          type: ResourceType.COWORKING,
          capacity: 10,
          isExclusive: false,
        },
      }),
    ];
    const levels = buildSlotLoadByResource(
      reservations,
      "space-2",
      10,
      dateKey,
      false,
    );
    expect(levels.some((L) => L === "caution")).toBe(true);
  });

  it("heatmap and pending worst load respect exclusive flag", () => {
    const pending = baseReservation({
      id: "p",
      startTime: tenAm,
      endTime: elevenAm,
      actorSize: 9,
      status: "PENDING",
      resource: {
        id: "ex",
        name: "E",
        type: ResourceType.AUDITORIUM,
        capacity: 10,
        isExclusive: true,
      },
    });
    const all = [pending];
    const meta = [{ id: "ex", capacity: 10, isExclusive: true }];
    const heat = heatmapRowLevels(all, meta, dateKey);
    expect(heat.some((L) => L === "caution")).toBe(false);
    const worst = worstLoadForPendingReservation(pending, all, dateKey);
    expect(worst).toBe("safe");
  });
});
