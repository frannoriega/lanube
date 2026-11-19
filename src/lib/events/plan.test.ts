import { eventInputSchema } from "@/lib/schemas/events";
import { describe, expect, it } from "vitest";
import { dateKeyTimeToMs, endTimeToMs, planEventOccurrences } from "./plan";

describe("endTimeToMs", () => {
  it("un fin normal es la hora del mismo día", () => {
    expect(endTimeToMs("2026-11-18", "21:00")).toBe(
      dateKeyTimeToMs("2026-11-18", "21:00"),
    );
  });

  it("un fin 00:00 es la medianoche que cierra el día (00:00 del siguiente)", () => {
    expect(endTimeToMs("2026-11-18", "00:00")).toBe(
      dateKeyTimeToMs("2026-11-19", "00:00"),
    );
  });

  it("también cruza el fin de mes", () => {
    expect(endTimeToMs("2026-11-30", "00:00")).toBe(
      dateKeyTimeToMs("2026-12-01", "00:00"),
    );
  });
});

describe("planEventOccurrences con fin a medianoche", () => {
  it("la sesión dura hasta las 24:00, no -N horas", () => {
    const [plan] = planEventOccurrences({
      weekdays: [3],
      startDate: "2026-11-18",
      endDate: "2026-12-16",
      startTime: "21:00",
      endTime: "00:00",
    });
    expect(plan.endMs - plan.startMs).toBe(3 * 60 * 60 * 1000);
  });
});

describe("eventInputSchema: hora de fin 00:00", () => {
  const base = {
    name: "Evento de prueba",
    description: "x".repeat(120),
    summary: "",
    isFeatured: false,
    status: "DRAFT",
    requiresApproval: false,
    checkInEnabled: false,
    eventType: "WORKSHOP",
    spaceId: "space1",
    startDate: "2026-11-18",
    endDate: "2026-11-25",
    weekdays: [3],
    startTime: "21:00",
    endTime: "00:00",
    imageUrl: "https://example.com/a.png",
  };
  const issues = (over: object) => {
    const r = eventInputSchema.safeParse({ ...base, ...over });
    return r.success
      ? []
      : r.error.issues.filter((i) => i.path.includes("endTime"));
  };

  it("acepta 00:00 como fin", () => {
    expect(issues({})).toEqual([]);
  });

  it("rechaza empezar y terminar a las 00:00", () => {
    expect(issues({ startTime: "00:00" })).not.toEqual([]);
  });

  it("sigue rechazando un fin anterior al inicio", () => {
    expect(issues({ endTime: "20:00" })).not.toEqual([]);
  });
});
