import { describe, expect, it } from "vitest";
import type { CalendarItem } from "./activity";
import {
  aggregateOccupancy,
  occupancyLabel,
  occupancyLevel,
} from "./occupancy";

const H = 3_600_000;
const res = (
  id: string,
  spaceId: string,
  from: number,
  to: number,
  extra: Partial<CalendarItem> = {},
): CalendarItem => ({
  id,
  kind: "reservation",
  startMs: from * H,
  endMs: to * H,
  allDay: false,
  title: id,
  spaceId,
  spaceName: spaceId.toUpperCase(),
  status: "APPROVED",
  actorSize: 1,
  capacity: 20,
  ...extra,
});

describe("aggregateOccupancy", () => {
  it("todo es un chip con su número, aun con una sola reserva", () => {
    const out = aggregateOccupancy([res("a", "s1", 9, 10)]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("occupancy");
    expect(occupancyLabel(out[0].occupancy!)).toBe("1/20");
  });

  it("con cardsForSingles, un tramo de una sola reserva queda como tarjeta", () => {
    const out = aggregateOccupancy(
      [res("a", "s1", 9, 10), res("b", "s1", 10, 11)],
      { cardsForSingles: true },
    );
    expect(out.map((i) => i.kind)).toEqual(["reservation", "reservation"]);
  });

  it("parte en tramos: cada hora lleva su propio número", () => {
    const out = aggregateOccupancy([
      res("a", "s1", 9, 12),
      res("b", "s1", 10, 11),
      res("c", "s1", 10, 12, { actorSize: 3 }),
      res("d", "s1", 11, 12, { status: "PENDING" }),
    ]);
    expect(
      out.map((i) => [
        i.startMs / H,
        i.endMs / H,
        occupancyLabel(i.occupancy!),
      ]),
    ).toEqual([
      [9, 10, "1/20"],
      [10, 11, "5/20"],
      [11, 12, "4/20 +1"],
    ]);
    expect(out[1].occupancy!.members.map((m) => m.id).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("une tramos contiguos con los mismos números", () => {
    const out = aggregateOccupancy([
      res("a", "s1", 9, 10),
      res("b", "s1", 10, 11),
    ]);
    expect(out).toHaveLength(1);
    expect([out[0].startMs / H, out[0].endMs / H]).toEqual([9, 11]);
  });

  it("no mezcla espacios ni toca lo que no es una reserva con espacio", () => {
    const event: CalendarItem = {
      id: "e",
      kind: "event",
      startMs: 9 * H,
      endMs: 12 * H,
      allDay: false,
      title: "Evento",
    };
    const out = aggregateOccupancy([
      res("a", "s1", 9, 11),
      res("b", "s2", 9, 11),
      event,
    ]);
    expect(out.map((i) => i.kind).sort()).toEqual([
      "event",
      "occupancy",
      "occupancy",
    ]);
  });
});

describe("aggregateOccupancy: mode building (todos los espacios)", () => {
  it("un bloque por tramo con cuántas reservas hay, sin importar cuántos espacios", () => {
    const out = aggregateOccupancy(
      [
        res("a", "s1", 9, 11),
        res("b", "s2", 10, 12),
        res("c", "s3", 10, 11, { status: "PENDING" }),
        res("d", "s4", 10, 11),
      ],
      { mode: "building" },
    );
    expect(
      out.map((i) => [
        i.startMs / H,
        i.endMs / H,
        i.occupancy!.approved,
        i.occupancy!.pending,
      ]),
    ).toEqual([
      [9, 10, 1, 0],
      [10, 11, 3, 1],
      [11, 12, 1, 0],
    ]);
    // Sin espacio en el bloque (el detalle por espacio está en los miembros).
    expect(out[1].spaceId).toBeUndefined();
    expect(out[1].occupancy!.mode).toBe("building");
    expect(out[1].occupancy!.members).toHaveLength(4);
  });
});

describe("occupancyLevel", () => {
  it("baja, media y completa", () => {
    expect(occupancyLevel(5, 20)).toBe("low");
    expect(occupancyLevel(14, 20)).toBe("mid");
    expect(occupancyLevel(20, 20)).toBe("full");
    expect(occupancyLevel(3, null)).toBe("low");
  });
});
