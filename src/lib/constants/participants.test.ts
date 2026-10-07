import { describe, expect, it } from "vitest";
import { ParticipantStatus } from "@/types/prisma";
import {
  blocksReRegistration,
  DECISION_SOURCE_STATUSES,
  reapprovalFits,
} from "./participants";

describe("blocksReRegistration (milestone 25, S5)", () => {
  it("una inscripción activa impide volver a inscribirse", () => {
    expect(blocksReRegistration(ParticipantStatus.PENDING)).toBe(true);
    expect(blocksReRegistration(ParticipantStatus.APPROVED)).toBe(true);
  });

  it("una rechazada por un admin no se reactiva reenviando el formulario", () => {
    expect(blocksReRegistration(ParticipantStatus.REJECTED)).toBe(true);
  });

  it("una cancelada por la propia persona sí puede volver a inscribirse", () => {
    expect(blocksReRegistration(ParticipantStatus.CANCELLED)).toBe(false);
  });
});

describe("DECISION_SOURCE_STATUSES", () => {
  it("aprobar toma pendientes y rechazadas; nunca canceladas", () => {
    expect(DECISION_SOURCE_STATUSES.approve).toEqual([
      ParticipantStatus.PENDING,
      ParticipantStatus.REJECTED,
    ]);
  });

  it("rechazar toma pendientes y aprobadas", () => {
    expect(DECISION_SOURCE_STATUSES.reject).toEqual([
      ParticipantStatus.PENDING,
      ParticipantStatus.APPROVED,
    ]);
  });
});

describe("reapprovalFits", () => {
  it("sin cupo (0) siempre entra", () => {
    expect(reapprovalFits({ capacity: 0, taken: 50, reapproving: 9 })).toEqual({
      fits: true,
      free: null,
    });
  });

  it("entran justo los lugares que quedan", () => {
    expect(reapprovalFits({ capacity: 10, taken: 8, reapproving: 2 })).toEqual({
      fits: true,
      free: 2,
    });
  });

  it("uno de más y no entra ninguno (todo o nada)", () => {
    expect(reapprovalFits({ capacity: 10, taken: 8, reapproving: 3 })).toEqual({
      fits: false,
      free: 2,
    });
  });

  it("con sobrecupo los lugares libres son 0, no negativos", () => {
    expect(reapprovalFits({ capacity: 5, taken: 7, reapproving: 1 })).toEqual({
      fits: false,
      free: 0,
    });
  });

  it("aprobar solo pendientes no necesita lugar", () => {
    expect(reapprovalFits({ capacity: 5, taken: 5, reapproving: 0 }).fits).toBe(
      true,
    );
  });
});
