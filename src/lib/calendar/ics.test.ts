import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText, foldIcsLine, icsUtc } from "./ics";
import {
  isUserFeedKind,
  registrationFeedSignature,
  subscribeLinks,
  userFeedSignature,
  verifyRegistrationFeedSignature,
  verifyUserFeedSignature,
} from "./feed-token";

describe("ics (milestone 45)", () => {
  it("escapa el texto según la RFC", () => {
    expect(escapeIcsText("a;b,c\\d\ne")).toBe("a\;b\\,c\\\\d\\ne");
  });

  it("horas en UTC", () => {
    expect(icsUtc(Date.UTC(2026, 11, 2, 13, 0))).toBe("20261202T130000Z");
  });

  it("pliega a 75 octetos sin cortar un carácter", () => {
    const line = `SUMMARY:${"á".repeat(60)}`;
    const folded = foldIcsLine(line);
    for (const l of folded.split("\r\n"))
      expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n ").join("")).toBe(line);
  });

  it("arma un calendario con color, estado y UID estable", () => {
    const ics = buildIcs({
      name: "La Nube — Mis reservas",
      color: "green",
      appleColorHex: "#15803D",
      nowMs: Date.UTC(2026, 10, 25),
      events: [
        {
          uid: "r1:123",
          startMs: Date.UTC(2026, 11, 2, 13),
          endMs: Date.UTC(2026, 11, 2, 14),
          summary: "⏳ Pendiente · Reunión",
          status: "TENTATIVE",
          color: "darkorange",
          location: "Sala de reuniones",
        },
        {
          uid: "c1",
          startMs: 0,
          endMs: 0,
          allDay: { startDate: "2026-12-08", endDateExclusive: "2026-12-09" },
          summary: "Cerrado: Feriado",
        },
      ],
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:La Nube — Mis reservas");
    expect(ics).toContain("COLOR:green");
    expect(ics).toContain("UID:r1:123@lanube");
    expect(ics).toContain("STATUS:TENTATIVE");
    expect(ics).toContain("COLOR:darkorange");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261208");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("firmas de los enlaces (milestone 45)", () => {
  const key = "secreto-de-prueba";

  it("la firma de una persona depende del feed y de la versión", () => {
    const s = userFeedSignature("u1", "reservations", 0, key);
    expect(verifyUserFeedSignature("u1", "reservations", 0, s, key)).toBe(true);
    // Regenerar (versión nueva) invalida el enlace viejo.
    expect(verifyUserFeedSignature("u1", "reservations", 1, s, key)).toBe(
      false,
    );
    expect(verifyUserFeedSignature("u1", "events", 0, s, key)).toBe(false);
    expect(verifyUserFeedSignature("u2", "reservations", 0, s, key)).toBe(
      false,
    );
    expect(verifyUserFeedSignature("u1", "reservations", 0, "x", key)).toBe(
      false,
    );
  });

  it("la de una inscripción no sirve para otra", () => {
    const s = registrationFeedSignature("p1", key);
    expect(verifyRegistrationFeedSignature("p1", s, key)).toBe(true);
    expect(verifyRegistrationFeedSignature("p2", s, key)).toBe(false);
  });

  it("tipos de feed válidos", () => {
    expect(isUserFeedKind("reservations")).toBe(true);
    expect(isUserFeedKind("space-abc123")).toBe(true);
    expect(isUserFeedKind("all")).toBe(false);
    expect(isUserFeedKind("space-../x")).toBe(false);
  });

  it("enlaces para suscribirse", () => {
    const l = subscribeLinks("https://lanube.example/api/calendar/x.ics");
    expect(l.webcal).toBe("webcal://lanube.example/api/calendar/x.ics");
    expect(l.google).toBe(
      "https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Flanube.example%2Fapi%2Fcalendar%2Fx.ics",
    );
  });
});
