import { describe, expect, it } from "vitest";
import {
  isThemeActive,
  monthDayInRecurringWindow,
  parseEmojiList,
  parseKeywordsList,
  resolveActiveTheme,
  resolveHeroKeywords,
  type LandingThemeRecord,
} from "./resolve";

function baseTheme(
  overrides: Partial<LandingThemeRecord> = {},
): LandingThemeRecord {
  return {
    id: "t1",
    isEnabled: true,
    priority: 0,
    recurring: true,
    startMonthDay: "09-25",
    endMonthDay: "09-25",
    startDate: null,
    endDate: null,
    entranceEffect: "EMOJI_SHOWER",
    emojiList: "🎉 🎊",
    particleCount: 40,
    heroEyebrowOverride: null,
    heroKeywords: null,
    heroKeywordsMode: "APPEND",
    ...overrides,
  };
}

describe("monthDayInRecurringWindow", () => {
  it("matches a single-day window", () => {
    expect(monthDayInRecurringWindow("09-25", "09-25", "09-25")).toBe(true);
    expect(monthDayInRecurringWindow("09-24", "09-25", "09-25")).toBe(false);
    expect(monthDayInRecurringWindow("09-26", "09-25", "09-25")).toBe(false);
  });

  it("matches a normal (non-wrapping) range", () => {
    expect(monthDayInRecurringWindow("09-25", "09-20", "09-30")).toBe(true);
    expect(monthDayInRecurringWindow("10-01", "09-20", "09-30")).toBe(false);
  });

  it("matches a range that wraps the year boundary", () => {
    // Christmas-style window: Dec 20 -> Jan 6.
    expect(monthDayInRecurringWindow("12-25", "12-20", "01-06")).toBe(true);
    expect(monthDayInRecurringWindow("01-01", "12-20", "01-06")).toBe(true);
    expect(monthDayInRecurringWindow("01-06", "12-20", "01-06")).toBe(true);
    expect(monthDayInRecurringWindow("06-15", "12-20", "01-06")).toBe(false);
    expect(monthDayInRecurringWindow("12-19", "12-20", "01-06")).toBe(false);
    expect(monthDayInRecurringWindow("01-07", "12-20", "01-06")).toBe(false);
  });
});

describe("isThemeActive", () => {
  it("is false when disabled, even inside the window", () => {
    const theme = baseTheme({ isEnabled: false });
    const nowMs = new Date("2026-09-25T15:00:00Z").getTime();
    expect(isThemeActive(theme, nowMs)).toBe(false);
  });

  it("is true for a recurring theme on its anniversary day (admin TZ)", () => {
    const theme = baseTheme();
    // Noon UTC on 2026-09-25 is still 2026-09-25 in America/Argentina/Buenos_Aires (UTC-3).
    const nowMs = new Date("2026-09-25T12:00:00Z").getTime();
    expect(isThemeActive(theme, nowMs)).toBe(true);
  });

  it("is false for a recurring theme the day before/after its window", () => {
    const theme = baseTheme();
    expect(
      isThemeActive(theme, new Date("2026-09-24T12:00:00Z").getTime()),
    ).toBe(false);
    expect(
      isThemeActive(theme, new Date("2026-09-26T12:00:00Z").getTime()),
    ).toBe(false);
  });

  it("is false for a recurring theme missing its window fields", () => {
    const theme = baseTheme({ startMonthDay: null });
    expect(
      isThemeActive(theme, new Date("2026-09-25T12:00:00Z").getTime()),
    ).toBe(false);
  });

  it("uses startDate/endDate for a one-off theme", () => {
    const start = new Date("2026-10-01T00:00:00Z").getTime();
    const end = new Date("2026-10-03T00:00:00Z").getTime();
    const theme = baseTheme({
      recurring: false,
      startMonthDay: null,
      endMonthDay: null,
      startDate: start,
      endDate: end,
    });
    expect(isThemeActive(theme, start)).toBe(true);
    expect(isThemeActive(theme, end)).toBe(true);
    expect(isThemeActive(theme, start - 1)).toBe(false);
    expect(isThemeActive(theme, end + 1)).toBe(false);
  });
});

describe("resolveActiveTheme", () => {
  const nowMs = new Date("2026-09-25T12:00:00Z").getTime();

  it("returns null when nothing is active", () => {
    expect(resolveActiveTheme([], nowMs)).toBeNull();
    expect(
      resolveActiveTheme([baseTheme({ isEnabled: false })], nowMs),
    ).toBeNull();
  });

  it("returns the single active theme", () => {
    const theme = baseTheme();
    expect(resolveActiveTheme([theme], nowMs)).toEqual(theme);
  });

  it("picks the higher-priority theme when two windows overlap", () => {
    const low = baseTheme({ id: "low", priority: 0 });
    const high = baseTheme({ id: "high", priority: 5 });
    expect(resolveActiveTheme([low, high], nowMs)?.id).toBe("high");
    expect(resolveActiveTheme([high, low], nowMs)?.id).toBe("high");
  });

  it("breaks priority ties by id for a stable result", () => {
    const a = baseTheme({ id: "a", priority: 1 });
    const b = baseTheme({ id: "b", priority: 1 });
    expect(resolveActiveTheme([b, a], nowMs)?.id).toBe("a");
  });
});

describe("parseEmojiList", () => {
  it("splits on whitespace and caps at 12", () => {
    expect(parseEmojiList("🎉 🎊 🥳")).toEqual(["🎉", "🎊", "🥳"]);
  });

  it("returns an empty array for null/empty input", () => {
    expect(parseEmojiList(null)).toEqual([]);
    expect(parseEmojiList("   ")).toEqual([]);
  });

  it("caps the list at 12 entries", () => {
    const many = Array.from({ length: 20 }, () => "🎉").join(" ");
    expect(parseEmojiList(many)).toHaveLength(12);
  });
});

describe("parseKeywordsList", () => {
  it("splits on commas and trims each entry", () => {
    expect(parseKeywordsList("10 años, celebración,  fiesta ")).toEqual([
      "10 años",
      "celebración",
      "fiesta",
    ]);
  });

  it("supports a single keyword with no commas", () => {
    expect(parseKeywordsList("celebración")).toEqual(["celebración"]);
  });

  it("drops empty entries from stray/trailing commas", () => {
    expect(parseKeywordsList("uno,, dos,")).toEqual(["uno", "dos"]);
  });

  it("returns an empty array for null/blank input", () => {
    expect(parseKeywordsList(null)).toEqual([]);
    expect(parseKeywordsList("   ")).toEqual([]);
  });

  it("caps the list at 20 entries", () => {
    const many = Array.from({ length: 30 }, (_, i) => `k${i}`).join(",");
    expect(parseKeywordsList(many)).toHaveLength(20);
  });
});

describe("resolveHeroKeywords", () => {
  const defaults = ["innovación", "talento"];

  it("falls back to defaults when the theme has no keywords", () => {
    expect(resolveHeroKeywords(defaults, null, "APPEND")).toEqual(defaults);
    expect(resolveHeroKeywords(defaults, "", "REPLACE")).toEqual(defaults);
  });

  it("APPEND prepends the theme keywords ahead of the defaults", () => {
    expect(resolveHeroKeywords(defaults, "10 años, fiesta", "APPEND")).toEqual([
      "10 años",
      "fiesta",
      "innovación",
      "talento",
    ]);
  });

  it("REPLACE swaps the defaults out entirely", () => {
    expect(resolveHeroKeywords(defaults, "10 años, fiesta", "REPLACE")).toEqual(
      ["10 años", "fiesta"],
    );
  });
});
