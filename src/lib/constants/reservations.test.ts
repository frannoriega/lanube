import { describe, expect, it } from "vitest";
import { LEDGER_SLOT_MS, isOnLedgerGrid } from "@/lib/constants/reservations";

describe("isOnLedgerGrid", () => {
  it("accepts UTC quarter-hours", () => {
    // 2026-09-24T12:00:00Z and the three quarters after it.
    const noon = Date.UTC(2026, 8, 24, 12, 0, 0, 0);
    for (const offset of [0, 1, 2, 3]) {
      expect(isOnLedgerGrid(noon + offset * LEDGER_SLOT_MS)).toBe(true);
    }
  });

  it("rejects the off-by-one-millisecond case that defeated the capacity check", () => {
    // The concrete milestone-12 D4 exploit: aligned + 1ms produced ledger buckets that
    // no equality-based capacity sum could ever match.
    const noon = Date.UTC(2026, 8, 24, 12, 0, 0, 0);
    expect(isOnLedgerGrid(noon + 1)).toBe(false);
    expect(isOnLedgerGrid(noon - 1)).toBe(false);
  });

  it("rejects off-grid minutes", () => {
    expect(isOnLedgerGrid(Date.UTC(2026, 8, 24, 10, 7, 0, 0))).toBe(false);
    expect(isOnLedgerGrid(Date.UTC(2026, 8, 24, 10, 1, 0, 0))).toBe(false);
    expect(isOnLedgerGrid(Date.UTC(2026, 8, 24, 10, 30, 0, 1))).toBe(false);
  });

  it("rejects non-finite input rather than throwing", () => {
    expect(isOnLedgerGrid(Number.NaN)).toBe(false);
    expect(isOnLedgerGrid(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
