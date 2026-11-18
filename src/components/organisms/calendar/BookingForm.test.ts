import { describe, expect, it } from "vitest";
import { bookingFormSchema, formatDuration } from "./BookingForm";

describe("formatDuration", () => {
  it("formatea minutos como se leen", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(90)).toBe("1 h 30 min");
    expect(formatDuration(0)).toBe("");
  });
});

describe("bookingFormSchema", () => {
  const base = {
    startTime: "10:00",
    endTime: "11:00",
    title: "Reunión de equipo",
    reason: "",
  };

  it("acepta una reserva válida", () => {
    expect(bookingFormSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza un fin anterior o igual al inicio, marcando endTime", () => {
    const r = bookingFormSchema.safeParse({ ...base, endTime: "10:00" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["endTime"]);
  });

  it("exige un título no vacío", () => {
    expect(bookingFormSchema.safeParse({ ...base, title: "   " }).success).toBe(
      false,
    );
  });

  it("la descripción es opcional", () => {
    expect(bookingFormSchema.safeParse({ ...base, reason: "" }).success).toBe(
      true,
    );
  });

  it("limita el largo del título", () => {
    expect(
      bookingFormSchema.safeParse({ ...base, title: "x".repeat(81) }).success,
    ).toBe(false);
  });
});
