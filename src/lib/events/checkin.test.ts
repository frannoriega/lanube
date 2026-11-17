import { describe, expect, it } from "vitest";
import {
  checkInRequiresAdmission,
  checkInSessions,
  defaultCheckInSession,
  isSessionOpenForCheckIn,
} from "./checkin";
import type { EventOccurrence } from "./occurrences";
import { ParticipantStatus } from "@/types/prisma";

/** Instante en la hora del predio (UTC-3): `at("2026-11-17", "10:00")`. */
function at(day: string, time: string): number {
  return new Date(`${day}T${time}:00-03:00`).getTime();
}

function occ(
  day: string,
  start: string,
  end: string,
  status: EventOccurrence["status"] = "scheduled",
): EventOccurrence {
  return {
    reservationId: "r1",
    occurrenceDateMs: at(day, start),
    startMs: at(day, start),
    endMs: at(day, end),
    status,
    reason: null,
  };
}

describe("isSessionOpenForCheckIn", () => {
  const now = at("2026-11-17", "09:00");
  it("admite una sesión de hoy aunque todavía no empezó", () => {
    expect(isSessionOpenForCheckIn(at("2026-11-17", "18:00"), now)).toBe(true);
  });
  it("admite una sesión pasada", () => {
    expect(isSessionOpenForCheckIn(at("2026-11-10", "18:00"), now)).toBe(true);
  });
  it("no admite una de mañana", () => {
    expect(isSessionOpenForCheckIn(at("2026-11-18", "08:00"), now)).toBe(false);
  });
  it("compara por el día del predio, no por UTC", () => {
    // 22:00 del 17 en Argentina ya es 18 en UTC: sigue siendo "hoy".
    const late = at("2026-11-17", "22:00");
    expect(isSessionOpenForCheckIn(late, at("2026-11-17", "08:00"))).toBe(true);
  });
});

describe("checkInSessions", () => {
  it("quita las canceladas, marca las futuras y ordena", () => {
    const now = at("2026-11-17", "12:00");
    const sessions = checkInSessions(
      [
        occ("2026-11-24", "10:00", "12:00"),
        occ("2026-11-10", "10:00", "12:00", "cancelled"),
        occ("2026-11-17", "10:00", "12:00", "rescheduled"),
      ],
      now,
    );
    expect(sessions.map((s) => [s.state, s.rescheduled])).toEqual([
      ["open", true],
      ["future", false],
    ]);
  });
});

describe("defaultCheckInSession", () => {
  const sessions = (now: number) =>
    checkInSessions(
      [
        occ("2026-11-10", "10:00", "12:00"),
        occ("2026-11-17", "10:00", "12:00"),
        occ("2026-11-17", "15:00", "17:00"),
        occ("2026-11-24", "10:00", "12:00"),
      ],
      now,
    );

  it("elige la de hoy que está en curso", () => {
    const now = at("2026-11-17", "11:00");
    expect(defaultCheckInSession(sessions(now), now)?.startMs).toBe(
      at("2026-11-17", "10:00"),
    );
  });
  it("si la de la mañana terminó, la de la tarde", () => {
    const now = at("2026-11-17", "13:00");
    expect(defaultCheckInSession(sessions(now), now)?.startMs).toBe(
      at("2026-11-17", "15:00"),
    );
  });
  it("si terminaron todas las de hoy, la última de hoy", () => {
    const now = at("2026-11-17", "20:00");
    expect(defaultCheckInSession(sessions(now), now)?.startMs).toBe(
      at("2026-11-17", "15:00"),
    );
  });
  it("un día sin sesión: la última que pasó", () => {
    const now = at("2026-11-20", "10:00");
    expect(defaultCheckInSession(sessions(now), now)?.startMs).toBe(
      at("2026-11-17", "15:00"),
    );
  });
  it("antes de la primera: la primera, aunque sea futura", () => {
    const now = at("2026-11-01", "10:00");
    const chosen = defaultCheckInSession(sessions(now), now);
    expect(chosen?.startMs).toBe(at("2026-11-10", "10:00"));
    expect(chosen?.state).toBe("future");
  });
  it("sin sesiones, null", () => {
    expect(defaultCheckInSession([], 0)).toBeNull();
  });
});

describe("checkInRequiresAdmission", () => {
  it("solo una aprobada pasa directo", () => {
    expect(checkInRequiresAdmission(ParticipantStatus.APPROVED)).toBe(false);
    for (const s of [
      ParticipantStatus.PENDING,
      ParticipantStatus.REJECTED,
      ParticipantStatus.CANCELLED,
    ]) {
      expect(checkInRequiresAdmission(s)).toBe(true);
    }
  });
});
