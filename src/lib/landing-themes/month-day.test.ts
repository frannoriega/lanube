import { describe, expect, it } from "vitest";
import {
  annualRangeToDates,
  dateToMonthDay,
  formatAnnualRange,
  formatMonthDay,
  wrapsYear,
} from "./month-day";

describe("ventanas anuales MM-DD", () => {
  it("formatea en castellano", () => {
    expect(formatMonthDay("12-20")).toBe("20 de diciembre");
    expect(formatMonthDay("basura")).toBe("basura");
    expect(formatAnnualRange("12-20", "01-06")).toBe(
      "20 de diciembre – 6 de enero (cada año)",
    );
    expect(formatAnnualRange("12-20", "")).toBeNull();
  });

  it("dibuja una ventana que cruza el fin de año en dos años seguidos", () => {
    expect(wrapsYear("12-20", "01-06")).toBe(true);
    const { from, to } = annualRangeToDates("12-20", "01-06");
    expect(from && to && to > from).toBe(true);
    expect(from && dateToMonthDay(from)).toBe("12-20");
    expect(to && dateToMonthDay(to)).toBe("01-06");
  });

  it("el 29 de febrero existe dentro del año y como fin de una ventana que cruza", () => {
    expect(dateToMonthDay(annualRangeToDates("02-29", "03-01").from!)).toBe(
      "02-29",
    );
    expect(dateToMonthDay(annualRangeToDates("12-01", "02-29").to!)).toBe(
      "02-29",
    );
  });

  it("sin inicio no hay rango", () => {
    expect(annualRangeToDates("", "01-06")).toEqual({});
  });
});
