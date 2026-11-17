import { describe, expect, it } from "vitest";
import {
  defaultViewFor,
  hourBounds,
  layoutLanes,
  shiftAnchor,
  verticalPosition,
  viewDays,
  viewTitle,
} from "./calendar-view";

const at = (d: number, h: number, m = 0) =>
  new Date(2026, 10, d, h, m).getTime();

describe("viewDays / shiftAnchor", () => {
  it("cada vista muestra sus días", () => {
    const anchor = new Date(2026, 10, 18, 15); // miércoles 18/11/2026
    expect(viewDays("day", anchor).map((d) => d.getDate())).toEqual([18]);
    expect(viewDays("3days", anchor).map((d) => d.getDate())).toEqual([
      18, 19, 20,
    ]);
    expect(viewDays("week", anchor).map((d) => d.getDate())).toEqual([
      16, 17, 18, 19, 20, 21, 22,
    ]);
    const month = viewDays("month", anchor);
    expect(month).toHaveLength(42);
    expect(month[0]).toEqual(new Date(2026, 9, 26)); // lunes antes del 1/11
  });

  it("navega por página", () => {
    const anchor = new Date(2026, 10, 18);
    expect(shiftAnchor("3days", anchor, 1).getDate()).toBe(21);
    expect(shiftAnchor("week", anchor, -1).getDate()).toBe(11);
    expect(shiftAnchor("month", new Date(2026, 0, 31), 1)).toEqual(
      new Date(2026, 1, 1),
    );
  });

  it("títulos en español", () => {
    const a = new Date(2026, 10, 18);
    expect(viewTitle("month", viewDays("month", a), a)).toBe(
      "Noviembre de 2026",
    );
    expect(viewTitle("week", viewDays("week", a), a)).toBe(
      "16 – 22 de noviembre de 2026",
    );
  });

  it("vista por defecto según el ancho", () => {
    expect(defaultViewFor({ isSm: false, isMd: false })).toBe("day");
    expect(defaultViewFor({ isSm: true, isMd: false })).toBe("3days");
    expect(defaultViewFor({ isSm: true, isMd: true })).toBe("week");
  });
});

describe("layoutLanes", () => {
  it("pone lado a lado lo que se superpone y deja solo lo que no", () => {
    const lanes = layoutLanes([
      { id: "a", startMs: at(18, 9), endMs: at(18, 11) },
      { id: "b", startMs: at(18, 10), endMs: at(18, 12) },
      { id: "c", startMs: at(18, 11), endMs: at(18, 13) }, // usa el carril de "a"
      { id: "d", startMs: at(18, 14), endMs: at(18, 15) }, // grupo nuevo
    ]);
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("b")).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get("c")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("d")).toEqual({ lane: 0, lanes: 1 });
  });
});

describe("hourBounds / verticalPosition", () => {
  it("amplía la franja para que entre todo", () => {
    expect(hourBounds([])).toEqual({ start: 8, end: 19 });
    expect(
      hourBounds([{ id: "x", startMs: at(18, 7, 30), endMs: at(18, 20, 15) }]),
    ).toEqual({ start: 7, end: 21 });
  });

  it("ubica un ítem en % de la franja", () => {
    const pos = verticalPosition(
      { id: "x", startMs: at(18, 10), endMs: at(18, 12) },
      new Date(2026, 10, 18),
      { start: 8, end: 18 },
    );
    expect(pos.top).toBeCloseTo(20);
    expect(pos.height).toBeCloseTo(20);
  });
});
