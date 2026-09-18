import { prisma } from "@/lib/prisma";
import type { LandingTheme } from "@/generated/prisma/client";
import {
  resolveActiveTheme,
  type LandingThemeRecord,
} from "@/lib/landing-themes/resolve";

export type { LandingTheme };

function toRecord(t: LandingTheme): LandingThemeRecord {
  return {
    id: t.id,
    isEnabled: t.isEnabled,
    priority: t.priority,
    recurring: t.recurring,
    startMonthDay: t.startMonthDay,
    endMonthDay: t.endMonthDay,
    startDate: t.startDate == null ? null : Number(t.startDate),
    endDate: t.endDate == null ? null : Number(t.endDate),
    entranceEffect: t.entranceEffect,
    emojiList: t.emojiList,
    particleCount: t.particleCount,
    heroEyebrowOverride: t.heroEyebrowOverride,
    heroExtraKeyword: t.heroExtraKeyword,
  };
}

/** All themes, newest first — for the superadmin manager. */
export async function listLandingThemes(): Promise<LandingTheme[]> {
  return prisma.landingTheme.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getLandingTheme(
  id: string,
): Promise<LandingTheme | null> {
  return prisma.landingTheme.findUnique({ where: { id } });
}

export interface LandingThemeInput {
  name: string;
  isEnabled: boolean;
  priority: number;
  recurring: boolean;
  startMonthDay?: string | null;
  endMonthDay?: string | null;
  startDate?: number | null;
  endDate?: number | null;
  entranceEffect: "NONE" | "EMOJI_SHOWER";
  emojiList?: string | null;
  particleCount?: number | null;
  heroEyebrowOverride?: string | null;
  heroExtraKeyword?: string | null;
}

/** Normalizes the input so only the fields matching `recurring` are persisted. */
function toWriteData(input: LandingThemeInput) {
  return {
    name: input.name,
    isEnabled: input.isEnabled,
    priority: input.priority,
    recurring: input.recurring,
    startMonthDay: input.recurring ? (input.startMonthDay ?? null) : null,
    endMonthDay: input.recurring ? (input.endMonthDay ?? null) : null,
    startDate: input.recurring
      ? null
      : input.startDate != null
        ? BigInt(input.startDate)
        : null,
    endDate: input.recurring
      ? null
      : input.endDate != null
        ? BigInt(input.endDate)
        : null,
    entranceEffect: input.entranceEffect,
    emojiList:
      input.entranceEffect === "EMOJI_SHOWER"
        ? (input.emojiList ?? null)
        : null,
    particleCount:
      input.entranceEffect === "EMOJI_SHOWER"
        ? (input.particleCount ?? null)
        : null,
    heroEyebrowOverride: input.heroEyebrowOverride ?? null,
    heroExtraKeyword: input.heroExtraKeyword ?? null,
  };
}

export async function createLandingTheme(
  input: LandingThemeInput,
): Promise<LandingTheme> {
  return prisma.landingTheme.create({ data: toWriteData(input) });
}

export async function updateLandingTheme(
  id: string,
  input: LandingThemeInput,
): Promise<LandingTheme> {
  return prisma.landingTheme.update({
    where: { id },
    data: toWriteData(input),
  });
}

export async function deleteLandingTheme(id: string): Promise<void> {
  await prisma.landingTheme.delete({ where: { id } });
}

/** The theme active right now (public, auth-free), or `null` if none applies. */
export async function getActiveLandingTheme(
  nowMs: number,
): Promise<LandingThemeRecord | null> {
  const themes = await prisma.landingTheme.findMany({
    where: { isEnabled: true },
  });
  return resolveActiveTheme(themes.map(toRecord), nowMs);
}
