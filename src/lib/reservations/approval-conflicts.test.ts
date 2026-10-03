import { describe, expect, it } from "vitest";
import { classifyConflict, mergeWindows } from "./approval-conflicts";

const Q = 15 * 60 * 1000; // un bucket del ledger

describe("mergeWindows", () => {
  it("une buckets contiguos de 15 minutos en una sola franja", () => {
    expect(
      mergeWindows([
        { start: 2 * Q, end: 3 * Q },
        { start: 0, end: Q },
        { start: Q, end: 2 * Q },
      ]),
    ).toEqual([{ start: 0, end: 3 * Q }]);
  });

  it("mantiene separadas las franjas que no se tocan (fechas distintas)", () => {
    const day = 24 * 4 * Q;
    expect(
      mergeWindows([
        { start: day, end: day + Q },
        { start: 0, end: Q },
      ]),
    ).toEqual([
      { start: 0, end: Q },
      { start: day, end: day + Q },
    ]);
  });

  it("absorbe franjas duplicadas o contenidas", () => {
    expect(
      mergeWindows([
        { start: 0, end: 4 * Q },
        { start: Q, end: 2 * Q },
        { start: 0, end: 4 * Q },
      ]),
    ).toEqual([{ start: 0, end: 4 * Q }]);
  });

  it("no muta la entrada", () => {
    const input = [
      { start: 0, end: Q },
      { start: Q, end: 2 * Q },
    ];
    mergeWindows(input);
    expect(input).toEqual([
      { start: 0, end: Q },
      { start: Q, end: 2 * Q },
    ]);
  });

  it("devuelve vacío sin franjas", () => {
    expect(mergeWindows([])).toEqual([]);
  });
});

describe("classifyConflict", () => {
  it("otro espacio ⇒ misma persona en dos lugares", () => {
    expect(
      classifyConflict("lab", { spaceId: "cowork", isExclusive: false }),
    ).toBe("SAME_PERSON");
  });

  it("mismo espacio exclusivo ⇒ EXCLUSIVE", () => {
    expect(
      classifyConflict("sala", { spaceId: "sala", isExclusive: true }),
    ).toBe("EXCLUSIVE");
  });

  it("mismo espacio compartido ⇒ CAPACITY", () => {
    expect(
      classifyConflict("cowork", { spaceId: "cowork", isExclusive: false }),
    ).toBe("CAPACITY");
  });
});
