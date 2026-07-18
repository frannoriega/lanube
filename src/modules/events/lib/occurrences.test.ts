import { describe, expect, it } from "vitest";
import {
  ExistingException,
  detectDroppedExceptions,
  effectiveExceptions,
  expandAllEventOccurrences,
  expandEventOccurrences,
  weekdayOfRrule,
  type RawReservation,
} from "@/modules/events/lib/occurrences";
import {
  EventRecipe,
  dateKeyTimeToMs,
  planEventOccurrences,
} from "@/modules/events/lib/plan";

const WEEK = 7 * 24 * 60 * 60 * 1000;
// A Thursday event, 4 weekly occurrences 10:00–13:00 starting 2026-07-02.
const START = dateKeyTimeToMs("2026-07-02", "10:00");
const END = dateKeyTimeToMs("2026-07-02", "13:00");
const DURATION = END - START;

function makeRes(
  exceptions: RawReservation["exceptions"] = [],
): RawReservation {
  return {
    id: "res1",
    startMs: START,
    endMs: END,
    recurrenceEndMs: START + 3 * WEEK, // 4 occurrences (weeks 0..3)
    rrule: "FREQ=WEEKLY;BYDAY=TH",
    exceptions,
  };
}

describe("expandEventOccurrences", () => {
  it("expands a weekly reservation into one occurrence per week", () => {
    const occ = expandEventOccurrences([makeRes()], START - 1);
    expect(occ).toHaveLength(4);
    expect(occ.every((o) => o.status === "scheduled")).toBe(true);
    expect(occ[0].startMs).toBe(START);
    expect(occ[3].startMs).toBe(START + 3 * WEEK);
  });

  it("drops occurrences whose window already ended", () => {
    // now = just after the 2nd occurrence (week 1) ends
    const now = START + WEEK + DURATION + 1;
    const occ = expandEventOccurrences([makeRes()], now);
    expect(occ).toHaveLength(2); // weeks 2 and 3 remain
    expect(occ[0].startMs).toBe(START + 2 * WEEK);
  });

  it("marks a cancelled occurrence (kept for admin visibility)", () => {
    const occ = expandEventOccurrences(
      [
        makeRes([
          {
            id: "ex1",
            exceptionDateMs: START + 2 * WEEK,
            isCancelled: true,
            newStartMs: null,
            newEndMs: null,
            reason: "Feriado",
            createdAtMs: 1,
          },
        ]),
      ],
      START - 1,
    );
    const cancelled = occ.find((o) => o.occurrenceDateMs === START + 2 * WEEK);
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.reason).toBe("Feriado");
  });

  it("moves a rescheduled occurrence to its new window", () => {
    const newStart = dateKeyTimeToMs("2026-07-24", "14:00");
    const newEnd = dateKeyTimeToMs("2026-07-24", "17:00");
    const occ = expandEventOccurrences(
      [
        makeRes([
          {
            id: "ex1",
            exceptionDateMs: START + 3 * WEEK,
            isCancelled: false,
            newStartMs: newStart,
            newEndMs: newEnd,
            reason: "Se corre",
            createdAtMs: 1,
          },
        ]),
      ],
      START - 1,
    );
    const moved = occ.find((o) => o.occurrenceDateMs === START + 3 * WEEK);
    expect(moved?.status).toBe("rescheduled");
    expect(moved?.startMs).toBe(newStart);
    expect(moved?.endMs).toBe(newEnd);
  });

  it("applies the latest exception per date when several exist", () => {
    const occ = expandEventOccurrences(
      [
        makeRes([
          {
            id: "old",
            exceptionDateMs: START + WEEK,
            isCancelled: true,
            newStartMs: null,
            newEndMs: null,
            reason: "primero",
            createdAtMs: 1,
          },
          {
            id: "new",
            exceptionDateMs: START + WEEK,
            isCancelled: false,
            newStartMs: START + WEEK + 3_600_000,
            newEndMs: START + WEEK + 7_200_000,
            reason: "corregido",
            createdAtMs: 2,
          },
        ]),
      ],
      START - 1,
    );
    const target = occ.find((o) => o.occurrenceDateMs === START + WEEK);
    expect(target?.status).toBe("rescheduled");
    expect(target?.reason).toBe("corregido");
  });
});

describe("effectiveExceptions (saved overlaid by staged changes)", () => {
  const TH = 4; // Thursday
  const day = (k: string) => dateKeyTimeToMs(k, "10:00");

  it("stages a cancel where nothing was saved (batch reason applied)", () => {
    const out = effectiveExceptions(
      TH,
      [],
      [{ weekday: TH, occurrenceDateMs: day("2026-07-09"), kind: "cancel" }],
      "Feriado",
    );
    expect(out).toHaveLength(1);
    expect(out[0].isCancelled).toBe(true);
    expect(out[0].reason).toBe("Feriado");
  });

  it("a staged revert clears a saved exception", () => {
    const existing = [
      {
        weekday: TH,
        occurrenceDateMs: day("2026-07-09"),
        isCancelled: true,
        newStartMs: null,
        newEndMs: null,
        reason: "Feriado",
      },
    ];
    const out = effectiveExceptions(TH, existing, [
      { weekday: TH, occurrenceDateMs: day("2026-07-09"), kind: "revert" },
    ]);
    expect(out).toHaveLength(0);
  });

  it("a staged change overrides the saved one on the same date", () => {
    const existing = [
      {
        weekday: TH,
        occurrenceDateMs: day("2026-07-09"),
        isCancelled: true,
        newStartMs: null,
        newEndMs: null,
        reason: "vieja",
      },
    ];
    const ns = dateKeyTimeToMs("2026-07-10", "14:00");
    const ne = dateKeyTimeToMs("2026-07-10", "17:00");
    const out = effectiveExceptions(
      TH,
      existing,
      [
        {
          weekday: TH,
          occurrenceDateMs: day("2026-07-09"),
          kind: "reschedule",
          newStartMs: ns,
          newEndMs: ne,
        },
      ],
      "nueva",
    );
    expect(out).toHaveLength(1);
    expect(out[0].isCancelled).toBe(false);
    expect(out[0].newStartMs).toBe(ns);
    expect(out[0].reason).toBe("nueva");
  });

  it("ignores exceptions/actions for other weekdays", () => {
    const out = effectiveExceptions(
      TH,
      [
        {
          weekday: 1,
          occurrenceDateMs: day("2026-07-06"),
          isCancelled: true,
          newStartMs: null,
          newEndMs: null,
          reason: "otro día",
        },
      ],
      [{ weekday: 1, occurrenceDateMs: day("2026-07-06"), kind: "cancel" }],
      "x",
    );
    expect(out).toHaveLength(0);
  });
});

describe("detectDroppedExceptions", () => {
  it("flags exceptions on a removed weekday", () => {
    const res = makeRes([
      {
        id: "ex1",
        exceptionDateMs: START + WEEK,
        isCancelled: true,
        newStartMs: null,
        newEndMs: null,
        reason: "x",
        createdAtMs: 1,
      },
    ]);
    // Thursday (4) removed from the new weekday set.
    const { dropped, droppedIds } = detectDroppedExceptions(
      [res],
      new Set([1]),
      "2026-07-01",
      "2026-07-31",
    );
    expect(droppedIds).toEqual(["ex1"]);
    expect(dropped[0].kind).toBe("cancel");
  });

  it("flags exceptions outside the new date range but keeps in-range ones", () => {
    const res = makeRes([
      {
        id: "inRange",
        exceptionDateMs: START + WEEK, // 2026-07-09
        isCancelled: true,
        newStartMs: null,
        newEndMs: null,
        reason: "x",
        createdAtMs: 1,
      },
      {
        id: "outOfRange",
        exceptionDateMs: START + 3 * WEEK, // 2026-07-23
        isCancelled: true,
        newStartMs: null,
        newEndMs: null,
        reason: "y",
        createdAtMs: 2,
      },
    ]);
    // Thursday kept, but range shrunk so only 07-09 stays.
    const { droppedIds } = detectDroppedExceptions(
      [res],
      new Set([4]),
      "2026-07-01",
      "2026-07-15",
    );
    expect(droppedIds).toEqual(["outOfRange"]);
  });
});

describe("expandAllEventOccurrences", () => {
  it("includes past occurrences that expandEventOccurrences would drop", () => {
    // now = well after all 4 occurrences ended
    const farFuture = START + 10 * WEEK;
    // expandEventOccurrences with farFuture as now → drops everything
    expect(expandEventOccurrences([makeRes()], farFuture)).toHaveLength(0);
    // expandAllEventOccurrences → returns all 4
    const all = expandAllEventOccurrences([makeRes()]);
    expect(all).toHaveLength(4);
    expect(all[0].startMs).toBe(START);
  });

  it("still overlays exceptions on past occurrences", () => {
    const cancelled: RawReservation["exceptions"][number] = {
      id: "ex1",
      exceptionDateMs: START,
      isCancelled: true,
      newStartMs: null,
      newEndMs: null,
      reason: "sala ocupada",
      createdAtMs: START - 1,
    };
    const all = expandAllEventOccurrences([makeRes([cancelled])]);
    expect(all).toHaveLength(4);
    expect(all[0].status).toBe("cancelled");
    expect(all[0].reason).toBe("sala ocupada");
  });
});

/**
 * Mirrors the admin session editor's live recompute (`event-sessions.tsx`): plan the recipe's
 * weekly reservations, overlay the saved exceptions per weekday, then expand. Locks issue #2 —
 * the session list is derived from the current date range + existing exceptions, and sessions
 * outside the range are excluded (even if they carry an exception).
 */
describe("live session preview (recipe + existing exceptions)", () => {
  const TH = 4; // Thursday
  const nowBefore = dateKeyTimeToMs("2026-07-01", "00:00");

  function preview(recipe: EventRecipe, existing: ExistingException[]) {
    const raws: RawReservation[] = planEventOccurrences(recipe).map((p) => {
      const wd = weekdayOfRrule(p.rrule)!;
      return {
        id: `wd-${wd}`,
        startMs: p.startMs,
        endMs: p.endMs,
        recurrenceEndMs: p.recurrenceEndMs,
        rrule: p.rrule,
        exceptions: effectiveExceptions(wd, existing, []),
      };
    });
    return expandEventOccurrences(raws, nowBefore);
  }

  const recipe = (startDate: string, endDate: string): EventRecipe => ({
    weekdays: [TH],
    startDate,
    endDate,
    startTime: "10:00",
    endTime: "13:00",
  });

  it("recomputes the session count when the end date shrinks", () => {
    const full = preview(recipe("2026-07-02", "2026-07-30"), []);
    expect(full.map((o) => o.startMs)).toEqual([
      dateKeyTimeToMs("2026-07-02", "10:00"),
      dateKeyTimeToMs("2026-07-09", "10:00"),
      dateKeyTimeToMs("2026-07-16", "10:00"),
      dateKeyTimeToMs("2026-07-23", "10:00"),
      dateKeyTimeToMs("2026-07-30", "10:00"),
    ]);

    const shrunk = preview(recipe("2026-07-02", "2026-07-16"), []);
    expect(shrunk).toHaveLength(3); // 07-02, 07-09, 07-16
  });

  it("overlays an existing exception that falls in range, drops one that falls out", () => {
    const existing: ExistingException[] = [
      {
        weekday: TH,
        occurrenceDateMs: dateKeyTimeToMs("2026-07-09", "10:00"),
        isCancelled: true,
        newStartMs: null,
        newEndMs: null,
        reason: "Feriado",
      },
      {
        weekday: TH,
        occurrenceDateMs: dateKeyTimeToMs("2026-07-30", "10:00"),
        isCancelled: true,
        newStartMs: null,
        newEndMs: null,
        reason: "Fuera de rango",
      },
    ];
    // Range only covers 07-02 .. 07-16, so the 07-30 exception must not surface at all.
    const out = preview(recipe("2026-07-02", "2026-07-16"), existing);
    const cancelled = out.filter((o) => o.status === "cancelled");
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].occurrenceDateMs).toBe(
      dateKeyTimeToMs("2026-07-09", "10:00"),
    );
    expect(out.some((o) => o.reason === "Fuera de rango")).toBe(false);
  });
});
