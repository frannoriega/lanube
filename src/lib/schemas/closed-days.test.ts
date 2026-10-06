import { describe, expect, it } from "vitest";
import { closedDayInputSchema } from "./closed-days";

const base = {
  title: "Feriado",
  startDate: "2026-05-25",
  endDate: "2026-05-25",
  startTime: null,
  endTime: null,
};

const issue = (v: unknown) => {
  const r = closedDayInputSchema.safeParse(v);
  return r.success ? null : r.error.issues[0]?.message;
};

describe("closedDayInputSchema", () => {
  it("acepta un día completo", () => {
    expect(closedDayInputSchema.safeParse(base).success).toBe(true);
  });

  it("acepta un rango con franja", () => {
    expect(
      closedDayInputSchema.safeParse({
        ...base,
        endDate: "2026-05-29",
        startTime: 840,
        endTime: 1080,
      }).success,
    ).toBe(true);
  });

  it("exige el motivo", () => {
    expect(issue({ ...base, title: "   " })).toBe("El motivo es obligatorio");
  });

  it("rechaza una fecha que no existe", () => {
    expect(
      issue({ ...base, startDate: "2026-02-31", endDate: "2026-02-31" }),
    ).toBe("Fecha inválida");
  });

  it("rechaza un fin anterior al inicio", () => {
    expect(issue({ ...base, endDate: "2026-05-24" })).toBe(
      "La fecha de fin no puede ser anterior a la de inicio",
    );
  });

  it("rechaza más de un año", () => {
    expect(issue({ ...base, endDate: "2027-05-26" })).toBe(
      "Un cierre no puede abarcar más de un año",
    );
  });

  it("exige inicio y fin juntos", () => {
    expect(issue({ ...base, startTime: 840 })).toBe(
      "Indicá el inicio y el fin del horario, o dejá el día completo",
    );
  });

  it("rechaza una franja invertida o fuera de la grilla de 15 minutos", () => {
    expect(issue({ ...base, startTime: 1080, endTime: 840 })).toBe(
      "La hora de fin debe ser posterior a la de inicio",
    );
    expect(issue({ ...base, startTime: 841, endTime: 1080 })).toBe(
      "El horario debe ser en intervalos de 15 minutos",
    );
  });
});
