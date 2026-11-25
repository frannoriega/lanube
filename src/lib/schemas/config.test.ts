import { describe, expect, it } from "vitest";
import { EMPTY_LANDING_THEME } from "@/lib/landing-themes/form-values";
import { landingThemeInputSchema, spaceInputSchema } from "./config";

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

describe("landingThemeInputSchema (milestone 40, F1)", () => {
  const base = { ...EMPTY_LANDING_THEME, name: "Aniversario" };

  it("un tema no recurrente con mes-día vacío y fechas elegidas es válido", () => {
    const r = landingThemeInputSchema.safeParse({
      ...base,
      recurring: false,
      startDate: 1_000,
      endDate: 2_000,
    });
    expect(r.success).toBe(true);
  });

  it("no recurrente sin fechas: el error va a startDate", () => {
    const r = landingThemeInputSchema.safeParse({ ...base, recurring: false });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path.join("."))).toEqual(["startDate"]);
  });

  it("no recurrente con el rango invertido: el error va a endDate", () => {
    const r = landingThemeInputSchema.safeParse({
      ...base,
      recurring: false,
      startDate: 2_000,
      endDate: 1_000,
    });
    expect(r.error?.issues.map((i) => i.path.join("."))).toEqual(["endDate"]);
  });

  it("recurrente con mes-día y sin fechas es válido", () => {
    const r = landingThemeInputSchema.safeParse({
      ...base,
      startMonthDay: "12-20",
      endMonthDay: "01-06",
    });
    expect(r.success).toBe(true);
  });

  it("recurrente sin mes-día: el error va a startMonthDay", () => {
    const r = landingThemeInputSchema.safeParse(base);
    expect(r.error?.issues.map((i) => i.path.join("."))).toEqual([
      "startMonthDay",
    ]);
  });

  it("sin lluvia de emojis, la lista vacía no molesta", () => {
    const r = landingThemeInputSchema.safeParse({
      ...base,
      startMonthDay: "12-20",
      endMonthDay: "01-06",
      entranceEffect: "NONE",
      emojiList: "",
    });
    expect(r.success).toBe(true);
  });

  it("con lluvia de emojis, la lista es obligatoria", () => {
    const r = landingThemeInputSchema.safeParse({
      ...base,
      startMonthDay: "12-20",
      endMonthDay: "01-06",
      emojiList: "",
    });
    expect(r.error?.issues.map((i) => i.path.join("."))).toEqual(["emojiList"]);
  });

  it("un mes-día mal formado sigue fallando", () => {
    const r = landingThemeInputSchema.safeParse({
      ...base,
      startMonthDay: "13-40",
      endMonthDay: "01-06",
    });
    expect(r.success).toBe(false);
  });
});
