import { describe, expect, it } from "vitest";
import { renderInApp } from "./in-app";
import type { NotificationEvent } from "../types";

const START = Date.UTC(2026, 6, 9, 13, 0); // 2026-07-09 10:00 ART
const HOUR = 3_600_000;

describe("renderInApp", () => {
  it("renders a reservation approval with the space/time, no mention of a reason", () => {
    const event: NotificationEvent = {
      type: "reservation.approved",
      recipient: { registeredUserId: "u1" },
      data: {
        reservationId: "r1",
        spaceName: "Sala A",
        reservationTypeName: "Reunión",
        startTime: START,
        endTime: START + HOUR,
      },
    };
    const rendered = renderInApp(event);
    expect(rendered.title).toBe("Reserva aprobada");
    expect(rendered.body).toContain("Sala A");
    expect(rendered.body).toContain("fue aprobada");
    expect(rendered.data).toEqual({ reservationId: "r1" });
  });

  it("appends the reason only when a reservation rejection carries one", () => {
    const withReason = renderInApp({
      type: "reservation.rejected",
      recipient: { registeredUserId: "u1" },
      data: {
        reservationId: "r1",
        spaceName: "Sala A",
        reservationTypeName: "Reunión",
        startTime: START,
        endTime: START + HOUR,
        reason: "Mantenimiento",
      },
    });
    expect(withReason.body).toContain("Mantenimiento");

    const withoutReason = renderInApp({
      type: "reservation.rejected",
      recipient: { registeredUserId: "u1" },
      data: {
        reservationId: "r1",
        spaceName: "Sala A",
        reservationTypeName: "Reunión",
        startTime: START,
        endTime: START + HOUR,
      },
    });
    expect(withoutReason.body.endsWith(".")).toBe(true);
  });

  it("falls back to the reservation type name when there's no space", () => {
    const rendered = renderInApp({
      type: "reservation.approved",
      recipient: { registeredUserId: "u1" },
      data: {
        reservationId: "r1",
        spaceName: null,
        reservationTypeName: "Evento especial",
        startTime: START,
        endTime: START + HOUR,
      },
    });
    expect(rendered.body).toContain("Evento especial");
  });

  it.each(["cancelled", "restored", "rescheduled"] as const)(
    "renders an event.sessionChanged %s",
    (kind) => {
      const rendered = renderInApp({
        type: "event.sessionChanged",
        recipient: { registeredUserId: "u1" },
        data: {
          eventId: "ev1",
          eventName: "Taller",
          kind,
          originalStartTime: START,
          originalEndTime: START + HOUR,
          newStartTime: kind === "rescheduled" ? START + 24 * HOUR : undefined,
          newEndTime:
            kind === "rescheduled" ? START + 24 * HOUR + HOUR : undefined,
        },
      });
      expect(rendered.title).toContain("Taller");
      expect(rendered.data).toEqual({ eventId: "ev1" });
    },
  );

  it("renders a news decision for each pending-action kind", () => {
    const approved = renderInApp({
      type: "news.decided",
      recipient: { registeredUserId: "u1" },
      data: {
        newsPostId: "n1",
        title: "Se viene el festival",
        slug: "se-viene-el-festival",
        kind: "SUBMISSION",
        decision: "APPROVED",
      },
    });
    expect(approved.title).toBe("Noticia aprobada");
    expect(approved.body).toContain("Se viene el festival");
    expect(approved.data).toEqual({
      newsPostId: "n1",
      slug: "se-viene-el-festival",
    });

    const rejectedEdit = renderInApp({
      type: "news.decided",
      recipient: { registeredUserId: "u1" },
      data: {
        newsPostId: "n1",
        title: "Se viene el festival",
        slug: "se-viene-el-festival",
        kind: "EDIT",
        decision: "REJECTED",
        reason: "Falta una fuente",
      },
    });
    expect(rejectedEdit.body).toContain("pedido de edición");
    expect(rejectedEdit.body).toContain("Falta una fuente");
  });

  it("renders a profile-change approval naming the requested DNI", () => {
    const rendered = renderInApp({
      type: "profileChange.decided",
      recipient: { registeredUserId: "r1" },
      data: {
        requestId: "q1",
        field: "DNI",
        requestedValue: "20000999",
        decision: "APPROVED",
      },
    });
    expect(rendered.title).toBe("Cambio de datos aprobado");
    expect(rendered.body).toBe(
      "Tu pedido de cambio de DNI a 20000999 fue aprobado.",
    );
  });

  it("renders a reason-to-join rejection with its reason", () => {
    const rendered = renderInApp({
      type: "profileChange.decided",
      recipient: { registeredUserId: "r1" },
      data: {
        requestId: "q2",
        field: "REASON_TO_JOIN",
        requestedValue: "Otro motivo cualquiera, largo",
        decision: "REJECTED",
        reason: "Necesitamos más detalle",
      },
    });
    expect(rendered.body).toBe(
      "Tu pedido de cambio del motivo para unirte fue rechazado: Necesitamos más detalle",
    );
  });
});
