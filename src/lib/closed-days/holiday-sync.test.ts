import { describe, expect, it } from "vitest";
import {
  holidayFeedSchema,
  holidaysFromFeed,
  planHolidaySync,
  type ExistingSyncRow,
  type SyncHoliday,
} from "./holiday-sync";

const feed = [
  {
    fecha: "2026-05-25",
    tipo: "inamovible",
    nombre: "Día de la Revolución de Mayo",
  },
  {
    fecha: "2026-06-15",
    tipo: "trasladable",
    nombre: "Paso a la Inmortalidad de Güemes (17/6)",
  },
];

describe("holidayFeedSchema", () => {
  it("acepta la forma de ArgentinaDatos", () => {
    expect(holidayFeedSchema.safeParse(feed).success).toBe(true);
  });

  it("rechaza fechas mal formadas y respuestas que no son una lista", () => {
    expect(
      holidayFeedSchema.safeParse([{ ...feed[0], fecha: "25/05/2026" }])
        .success,
    ).toBe(false);
    expect(holidayFeedSchema.safeParse({ error: "x" }).success).toBe(false);
  });
});

describe("holidaysFromFeed", () => {
  it("arma la clave externa y conserva el nombre y el tipo", () => {
    expect(holidaysFromFeed(feed, 2026)[0]).toEqual({
      externalKey: "ar:2026-05-25",
      title: "Día de la Revolución de Mayo",
      date: "2026-05-25",
      kind: "inamovible",
    });
  });

  it("descarta lo que no es del año pedido y las fechas repetidas", () => {
    const withNoise = [
      ...feed,
      { fecha: "2027-01-01", tipo: "inamovible", nombre: "Año nuevo" },
      { ...feed[0], nombre: "Repetido" },
    ];
    const out = holidaysFromFeed(withNoise, 2026);
    expect(out.map((h) => h.date)).toEqual(["2026-05-25", "2026-06-15"]);
    expect(out[0].title).toBe("Día de la Revolución de Mayo");
  });
});

const holiday = (
  date: string,
  title = "Feriado",
  kind = "inamovible",
): SyncHoliday => ({
  externalKey: `ar:${date}`,
  title,
  date,
  kind,
});

const row = (
  date: string,
  status: ExistingSyncRow["status"],
  title = "Feriado",
  kind: string | null = "inamovible",
): ExistingSyncRow => ({
  id: `id-${date}`,
  externalKey: `ar:${date}`,
  title,
  holidayKind: kind,
  status,
  startDate: date,
});

describe("planHolidaySync", () => {
  const today = "2026-10-06";

  it("crea lo nuevo", () => {
    const plan = planHolidaySync([], [holiday("2026-11-23")], [2026], today);
    expect(plan.create).toHaveLength(1);
    expect(plan.refresh).toEqual([]);
    expect(plan.missing).toEqual([]);
  });

  it("no propone feriados que ya pasaron", () => {
    const plan = planHolidaySync(
      [],
      [holiday("2026-05-25"), holiday("2026-10-06"), holiday("2026-11-23")],
      [2026],
      today,
    );
    expect(plan.create.map((h) => h.date)).toEqual([
      "2026-10-06",
      "2026-11-23",
    ]);
  });

  it("es idempotente: sincronizar dos veces no crea nada nuevo", () => {
    const plan = planHolidaySync(
      [row("2026-11-23", "PENDING_REVIEW")],
      [holiday("2026-11-23")],
      [2026],
      today,
    );
    expect(plan).toEqual({ create: [], refresh: [], missing: [] });
  });

  it("refresca una propuesta sin revisar cuyo nombre cambió", () => {
    const plan = planHolidaySync(
      [row("2026-11-23", "PENDING_REVIEW", "Viejo nombre")],
      [holiday("2026-11-23", "Nuevo nombre")],
      [2026],
      today,
    );
    expect(plan.refresh).toEqual([
      { id: "id-2026-11-23", holiday: holiday("2026-11-23", "Nuevo nombre") },
    ]);
  });

  it("no toca lo que una persona ya decidió", () => {
    for (const status of ["ACTIVE", "DISMISSED"] as const) {
      const plan = planHolidaySync(
        [row("2026-11-23", status, "Viejo nombre")],
        [holiday("2026-11-23", "Nuevo nombre")],
        [2026],
        today,
      );
      expect(plan.refresh).toEqual([]);
      expect(plan.create).toEqual([]);
    }
  });

  it("no vuelve a proponer un feriado descartado", () => {
    const plan = planHolidaySync(
      [row("2026-11-23", "DISMISSED")],
      [holiday("2026-11-23")],
      [2026],
      today,
    );
    expect(plan.create).toEqual([]);
  });

  it("informa, sin tocar, un feriado futuro que el origen ya no trae", () => {
    const plan = planHolidaySync(
      [row("2026-11-09", "ACTIVE")],
      [holiday("2026-11-23")],
      [2026],
      today,
    );
    expect(plan.missing.map((m) => m.startDate)).toEqual(["2026-11-09"]);
  });

  it("no informa lo pasado, lo descartado ni lo de un año que no se pudo pedir", () => {
    const plan = planHolidaySync(
      [
        row("2026-05-25", "ACTIVE"),
        row("2026-11-09", "DISMISSED"),
        row("2027-01-01", "ACTIVE"),
      ],
      [],
      [2026],
      today,
    );
    expect(plan.missing).toEqual([]);
  });
});
