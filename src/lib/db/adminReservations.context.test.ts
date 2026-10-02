import { describe, expect, it, vi } from "vitest";

// adminReservations.ts pulls in prisma (→ "server-only") transitively; stub both so this
// stays a focused test of the pure `buildReservationAuditContext` helper.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { buildReservationAuditContext } from "./adminReservations";

const START = Date.UTC(2026, 6, 9, 13, 0); // 2026-07-09 10:00 ART
const HOUR = 3_600_000;

describe("buildReservationAuditContext", () => {
  it("labels a space reservation by its space, time and owner", () => {
    const context = buildReservationAuditContext({
      id: "r1",
      reservableType: "USER",
      reservableId: "u1",
      spaceName: "Sala A",
      reservationTypeName: "Reunión",
      startTime: START,
      endTime: START + HOUR,
      deniedReason: null,
      ownerName: "Juan Pérez",
    });
    expect(context).toEqual({
      Espacio: "Sala A",
      Horario: "jueves, 9 de julio, 10:00–11:00",
      "Reservado por": "Juan Pérez",
    });
  });

  it("falls back to the reservation type when there's no space, and omits owner for non-USER actors", () => {
    const context = buildReservationAuditContext({
      id: "r2",
      reservableType: "TEAM",
      reservableId: "t1",
      spaceName: null,
      reservationTypeName: "Evento especial",
      startTime: START,
      endTime: START + HOUR,
      deniedReason: null,
      ownerName: null,
    });
    expect(context).toEqual({
      "Tipo de reserva": "Evento especial",
      Horario: "jueves, 9 de julio, 10:00–11:00",
    });
  });
});
