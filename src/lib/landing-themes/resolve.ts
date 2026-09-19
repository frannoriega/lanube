import { dateKeyFromUnixMs } from "@/lib/admin/admin-timezone";

export type LandingThemeEffect = "NONE" | "EMOJI_SHOWER";
export type LandingThemeKeywordMode = "APPEND" | "REPLACE";

/**
 * The subset of `LandingTheme` fields the resolution logic needs. Kept separate
 * from the Prisma type so this stays a pure, easily unit-tested function.
 */
export interface LandingThemeRecord {
  id: string;
  isEnabled: boolean;
  priority: number;
  recurring: boolean;
  startMonthDay: string | null;
  endMonthDay: string | null;
  startDate: number | null;
  endDate: number | null;
  entranceEffect: LandingThemeEffect;
  emojiList: string | null;
  particleCount: number | null;
  heroEyebrowOverride: string | null;
  /** Comma-separated words/phrases, e.g. "10 años, celebración". */
  heroKeywords: string | null;
  heroKeywordsMode: LandingThemeKeywordMode;
}

/** "MM-DD" for the calendar day containing `nowMs`, in the admin timezone. */
export function monthDayInAdminTz(nowMs: number): string {
  return dateKeyFromUnixMs(nowMs).slice(5);
}

/**
 * Whether `monthDay` falls in [start, end] (inclusive), where the window may wrap
 * the year boundary (e.g. start="12-20", end="01-06" spans New Year's).
 */
export function monthDayInRecurringWindow(
  monthDay: string,
  start: string,
  end: string,
): boolean {
  if (start <= end) return monthDay >= start && monthDay <= end;
  return monthDay >= start || monthDay <= end;
}

export function isThemeActive(
  theme: LandingThemeRecord,
  nowMs: number,
): boolean {
  if (!theme.isEnabled) return false;
  if (theme.recurring) {
    if (!theme.startMonthDay || !theme.endMonthDay) return false;
    return monthDayInRecurringWindow(
      monthDayInAdminTz(nowMs),
      theme.startMonthDay,
      theme.endMonthDay,
    );
  }
  if (theme.startDate == null || theme.endDate == null) return false;
  return nowMs >= theme.startDate && nowMs <= theme.endDate;
}

/**
 * The single active theme (highest `priority` wins; ties broken by id for a
 * stable result), or `null` when none of the enabled themes' windows contain
 * `nowMs`. Only one theme is ever "active" — themes don't compose.
 */
export function resolveActiveTheme(
  themes: LandingThemeRecord[],
  nowMs: number,
): LandingThemeRecord | null {
  const active = themes.filter((t) => isThemeActive(t, nowMs));
  if (active.length === 0) return null;
  active.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  return active[0] ?? null;
}

/** Parses the admin-authored space-separated emoji list into an array, capped. */
export function parseEmojiList(emojiList: string | null): string[] {
  if (!emojiList) return [];
  return [...emojiList.trim().matchAll(/\S+/g)].map((m) => m[0]).slice(0, 12);
}

/** Parses the admin-authored comma-separated keyword list into a trimmed array. */
export function parseKeywordsList(heroKeywords: string | null): string[] {
  if (!heroKeywords) return [];
  return heroKeywords
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
    .slice(0, 20);
}

/**
 * Combines a theme's keywords with the default rotation per `heroKeywordsMode`:
 * `APPEND` adds them ahead of the defaults, `REPLACE` swaps the defaults out
 * entirely for the duration of the theme. Falls back to `defaults` unchanged
 * when the theme has no keywords configured (even in REPLACE mode — an empty
 * rotation would break the hero's typewriter effect).
 */
export function resolveHeroKeywords(
  defaults: string[],
  heroKeywords: string | null,
  heroKeywordsMode: LandingThemeKeywordMode,
): string[] {
  const themeKeywords = parseKeywordsList(heroKeywords);
  if (themeKeywords.length === 0) return defaults;
  return heroKeywordsMode === "REPLACE"
    ? themeKeywords
    : [...themeKeywords, ...defaults];
}
