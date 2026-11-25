import { describe, expect, it } from "vitest";
import { formSchemaZod } from "@/lib/events/form-schema";
import { dateKeyTimeToMs } from "@/lib/events/plan";
import {
  RESERVATION_REASON_MAX,
  RESERVATION_TITLE_MAX,
  titleFromDescription,
  validateReservationReason,
  validateReservationTitle,
} from "@/lib/reservations/user-rules";
import { sessionActionSchema } from "@/lib/schemas/events";
import { signupProfileSchema } from "@/lib/schemas/profile";

/**
 * Restricciones que antes solo aplicaba la UI y ahora también valida el servidor (auditoría
 * de restricciones de UI, milestone 26). Cada caso es un pedido que un POST/PUT directo
 * colaba antes y que la pantalla nunca habría mandado.
 */

describe("descripción de la reserva", () => {
  it("es opcional y rechaza más de RESERVATION_REASON_MAX caracteres", () => {
    expect(validateReservationReason("")).toBe(null);
    expect(validateReservationReason("x".repeat(RESERVATION_REASON_MAX))).toBe(
      null,
    );
    expect(
      validateReservationReason("x".repeat(RESERVATION_REASON_MAX + 1)),
    ).toContain(String(RESERVATION_REASON_MAX));
  });
});

describe("título de la reserva (milestone 35)", () => {
  it("es obligatorio y tiene tope", () => {
    expect(validateReservationTitle("")).toBe("Falta el título de la reserva");
    expect(validateReservationTitle("x".repeat(RESERVATION_TITLE_MAX))).toBe(
      null,
    );
    expect(
      validateReservationTitle("x".repeat(RESERVATION_TITLE_MAX + 1)),
    ).toContain(String(RESERVATION_TITLE_MAX));
  });

  it("sale de la primera línea de la descripción si un cliente viejo no lo manda", () => {
    expect(titleFromDescription("Taller de IA\nTraer notebook")).toBe(
      "Taller de IA",
    );
    expect(titleFromDescription("  ")).toBe("");
    expect(titleFromDescription("x".repeat(200))).toHaveLength(
      RESERVATION_TITLE_MAX,
    );
  });
});

describe("signupProfileSchema (alta del perfil)", () => {
  const valid = {
    name: "Ana",
    lastName: "Pérez",
    dni: "30123456",
    institution: "",
    reasonToJoin: "Quiero usar el coworking para mi proyecto.",
  };

  it("acepta un alta válida (DNI como texto o número)", () => {
    expect(signupProfileSchema.safeParse(valid).success).toBe(true);
    expect(
      signupProfileSchema.safeParse({ ...valid, dni: 30123456 }).success,
    ).toBe(true);
    expect(
      signupProfileSchema.safeParse({ ...valid, institution: undefined })
        .success,
    ).toBe(true);
  });

  it("rechaza nombre/apellido cortos y motivo fuera de 20..500", () => {
    expect(signupProfileSchema.safeParse({ ...valid, name: "A" }).success).toBe(
      false,
    );
    expect(
      signupProfileSchema.safeParse({ ...valid, lastName: "  " }).success,
    ).toBe(false);
    expect(
      signupProfileSchema.safeParse({ ...valid, reasonToJoin: "corto" })
        .success,
    ).toBe(false);
    expect(
      signupProfileSchema.safeParse({
        ...valid,
        reasonToJoin: "x".repeat(501),
      }).success,
    ).toBe(false);
    expect(
      signupProfileSchema.safeParse({ ...valid, dni: "abc" }).success,
    ).toBe(false);
  });
});

describe("formSchemaZod (plantillas de formulario)", () => {
  const input = (constraints: { min?: number; max?: number }) => ({
    version: 1,
    nodes: [
      {
        kind: "input",
        id: "n",
        type: "INTEGER",
        label: "Edad",
        required: true,
        constraints,
      },
    ],
  });

  it("rechaza mínimo > máximo en un campo numérico", () => {
    expect(formSchemaZod.safeParse(input({ min: 1, max: 5 })).success).toBe(
      true,
    );
    expect(formSchemaZod.safeParse(input({ min: 5, max: 5 })).success).toBe(
      true,
    );
    expect(formSchemaZod.safeParse(input({ min: 6, max: 5 })).success).toBe(
      false,
    );
  });

  it("rechaza un grupo sin campos", () => {
    const group = (children: unknown[]) => ({
      version: 1,
      nodes: [{ kind: "group", id: "g", children }],
    });
    expect(formSchemaZod.safeParse(group([])).success).toBe(false);
    expect(
      formSchemaZod.safeParse(
        group([
          {
            kind: "input",
            id: "c",
            type: "SHORT_TEXT",
            label: "Nombre",
            required: false,
          },
        ]),
      ).success,
    ).toBe(true);
  });
});

describe("sessionActionSchema (reprogramar una sesión)", () => {
  const base = {
    kind: "reschedule" as const,
    weekday: 4,
    occurrenceDateMs: dateKeyTimeToMs("2026-07-02", "10:00"),
    reason: "Feriado",
  };

  it("acepta un horario del mismo día en cuartos de hora", () => {
    expect(
      sessionActionSchema.safeParse({
        ...base,
        newStartMs: dateKeyTimeToMs("2026-07-03", "14:15"),
        newEndMs: dateKeyTimeToMs("2026-07-03", "16:00"),
      }).success,
    ).toBe(true);
  });

  it("rechaza horarios fuera de la grilla de 15 minutos", () => {
    expect(
      sessionActionSchema.safeParse({
        ...base,
        newStartMs: dateKeyTimeToMs("2026-07-03", "14:15") + 7 * 60_000,
        newEndMs: dateKeyTimeToMs("2026-07-03", "16:00"),
      }).success,
    ).toBe(false);
  });

  it("rechaza una sesión que termina otro día", () => {
    expect(
      sessionActionSchema.safeParse({
        ...base,
        newStartMs: dateKeyTimeToMs("2026-07-03", "22:00"),
        newEndMs: dateKeyTimeToMs("2026-07-04", "01:00"),
      }).success,
    ).toBe(false);
  });
});

describe("sessionActionSchema: motivo por sesión (milestone 44)", () => {
  const occurrenceDateMs = dateKeyTimeToMs("2026-07-02", "10:00");

  it("cancelar sin motivo (o con solo espacios) se rechaza en esa acción", () => {
    const r = sessionActionSchema.safeParse({
      kind: "cancel",
      weekday: 4,
      occurrenceDateMs,
      reason: "   ",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["reason"]);
    expect(
      sessionActionSchema.safeParse({
        kind: "cancel",
        weekday: 4,
        occurrenceDateMs,
      }).success,
    ).toBe(false);
  });

  it("reprogramar sin motivo se rechaza", () => {
    expect(
      sessionActionSchema.safeParse({
        kind: "reschedule",
        weekday: 4,
        occurrenceDateMs,
        newStartMs: dateKeyTimeToMs("2026-07-03", "14:00"),
        newEndMs: dateKeyTimeToMs("2026-07-03", "16:00"),
      }).success,
    ).toBe(false);
  });

  it("revertir no lleva motivo", () => {
    expect(
      sessionActionSchema.safeParse({
        kind: "revert",
        weekday: 4,
        occurrenceDateMs,
      }).success,
    ).toBe(true);
  });

  it("el motivo tiene tope de 500", () => {
    expect(
      sessionActionSchema.safeParse({
        kind: "cancel",
        weekday: 4,
        occurrenceDateMs,
        reason: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});
