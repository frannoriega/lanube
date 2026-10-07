import { describe, expect, it } from "vitest";
import { ParticipantStatus } from "@/types/prisma";
import { blocksReRegistration } from "./participants";

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
