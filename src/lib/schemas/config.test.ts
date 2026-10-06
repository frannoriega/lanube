import { describe, expect, it } from "vitest";
import { spaceInputSchema } from "./config";

const base = {
  name: "Cocina",
  slug: "cocina",
  description: "Para el mate y el almuerzo.",
  isExclusive: false,
  isReservable: false,
  isFeatured: false,
};

describe("spaceInputSchema (milestone 24)", () => {
  it("un espacio exige capacidad", () => {
    const r = spaceInputSchema.safeParse({
      ...base,
      kind: "SPACE",
      capacity: null,
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["capacity"]);
  });

  it("un área común puede no tener capacidad", () => {
    expect(
      spaceInputSchema.safeParse({ ...base, kind: "AMENITY", capacity: null })
        .success,
    ).toBe(true);
  });

  it("un área común puede tener capacidad", () => {
    expect(
      spaceInputSchema.safeParse({ ...base, kind: "AMENITY", capacity: 8 })
        .success,
    ).toBe(true);
  });

  it("un área común no se reserva ni es exclusiva", () => {
    for (const flag of ["isReservable", "isExclusive"] as const) {
      expect(
        spaceInputSchema.safeParse({
          ...base,
          kind: "AMENITY",
          capacity: null,
          [flag]: true,
        }).success,
      ).toBe(false);
    }
  });

  it("la capacidad, si está, sigue siendo positiva", () => {
    expect(
      spaceInputSchema.safeParse({ ...base, kind: "AMENITY", capacity: 0 })
        .success,
    ).toBe(false);
  });
});
