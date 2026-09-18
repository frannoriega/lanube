import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  adminForwardWindowRange,
  enumerateDateKeysInclusive,
  isValidDateKey,
  todayDateKeyInAdminTz,
} from "./admin-timezone";

describe("admin-timezone", () => {
  it("enumerateDateKeysInclusive returns one day when from equals to", () => {
    expect(enumerateDateKeysInclusive("2025-04-04", "2025-04-04")).toEqual([
      "2025-04-04",
    ]);
  });

  it("enumerateDateKeysInclusive spans inclusive range", () => {
    const days = enumerateDateKeysInclusive("2025-04-01", "2025-04-14");
    expect(days).toHaveLength(14);
    expect(days[0]).toBe("2025-04-01");
    expect(days[13]).toBe("2025-04-14");
  });

  it("addDaysToDateKey advances calendar in admin TZ", () => {
    expect(addDaysToDateKey("2025-04-30", 1)).toBe("2025-05-01");
  });

  it("isValidDateKey rejects malformed strings", () => {
    expect(isValidDateKey("2025-4-4")).toBe(false);
    expect(isValidDateKey("25-04-04")).toBe(false);
    expect(isValidDateKey("2025-04-04")).toBe(true);
  });

  it("adminForwardWindowRange starts today and spans dayCount days inclusive", () => {
    const nowMs = new Date("2025-04-04T15:00:00Z").getTime();
    const { fromKey, toKey } = adminForwardWindowRange(14, nowMs);
    expect(fromKey).toBe(todayDateKeyInAdminTz(nowMs));
    expect(enumerateDateKeysInclusive(fromKey, toKey)).toHaveLength(14);
  });

  it("adminForwardWindowRange respects an arbitrary window length", () => {
    const nowMs = new Date("2025-04-04T15:00:00Z").getTime();
    const { fromKey, toKey } = adminForwardWindowRange(60, nowMs);
    expect(enumerateDateKeysInclusive(fromKey, toKey)).toHaveLength(60);
  });
});
