import { describe, expect, it } from "vitest";
import { renderEmail } from "./email";

const START = Date.UTC(2026, 6, 9, 13, 0);
const HOUR = 3_600_000;

describe("renderEmail", () => {
  it("renders reservation approved/rejected emails", () => {
    const approved = renderEmail({
      type: "reservation.approved",
      recipient: { email: "a@x.com" },
      data: {
        reservationId: "r1",
        spaceName: "Sala A",
        reservationTypeName: "Reunión",
        startTime: START,
        endTime: START + HOUR,
      },
    });
    expect(approved?.subject).toContain("aprobada");
    expect(approved?.html).toContain("Sala A");

    const rejected = renderEmail({
      type: "reservation.rejected",
      recipient: { email: "a@x.com" },
      data: {
        reservationId: "r1",
        spaceName: "Sala A",
        reservationTypeName: "Reunión",
        startTime: START,
        endTime: START + HOUR,
        reason: "Mantenimiento",
      },
    });
    expect(rejected?.html).toContain("Mantenimiento");
  });

  it("returns null for event.sessionChanged — that event keeps its own batched sender", () => {
    const rendered = renderEmail({
      type: "event.sessionChanged",
      recipient: { email: "a@x.com" },
      data: {
        eventId: "ev1",
        eventName: "Taller",
        kind: "cancelled",
        originalStartTime: START,
        originalEndTime: START + HOUR,
      },
    });
    expect(rendered).toBeNull();
  });

  it("renders a news decision email with the reason when present", () => {
    const rendered = renderEmail({
      type: "news.decided",
      recipient: { email: "a@x.com" },
      data: {
        newsPostId: "n1",
        title: "Se viene el festival",
        slug: "se-viene-el-festival",
        kind: "SUBMISSION",
        decision: "REJECTED",
        reason: "Falta una fuente",
      },
    });
    expect(rendered?.subject).toContain("rechazada");
    expect(rendered?.html).toContain("Falta una fuente");
    expect(rendered?.html).toContain("Se viene el festival");
  });
});
