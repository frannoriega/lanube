/**
 * Valores del formulario de tema del landing (milestone 14): compartidos por la página de
 * edición (Server Component, que convierte la fila con BigInt a valores serializables) y el
 * formulario cliente. Viven fuera del `"use client"` para poder llamarse desde el servidor.
 */
import type { LandingThemeInput } from "@/lib/schemas/config";
import type { LandingTheme } from "@/generated/prisma/client";

/** Valores iniciales de un tema nuevo. */
export const EMPTY_LANDING_THEME: LandingThemeInput = {
  name: "",
  isEnabled: true,
  recurring: true,
  startMonthDay: "",
  endMonthDay: "",
  startDate: null,
  endDate: null,
  entranceEffect: "EMOJI_SHOWER",
  emojiList: "🎉 🎊",
  particleCount: 40,
  heroEyebrowOverride: "",
  heroKeywords: "",
  heroKeywordsMode: "APPEND",
};

/** Fila de tema tal como la devuelve Prisma (fechas en `bigint`). */
type LandingThemeRow = LandingTheme;

/** Fila de la base → valores del formulario (BigInt → number, nulls → ""). */
export function landingThemeToFormValues(
  t: LandingThemeRow,
): LandingThemeInput {
  return {
    name: t.name,
    isEnabled: t.isEnabled,
    recurring: t.recurring,
    startMonthDay: t.startMonthDay ?? "",
    endMonthDay: t.endMonthDay ?? "",
    startDate: t.startDate == null ? null : Number(t.startDate),
    endDate: t.endDate == null ? null : Number(t.endDate),
    entranceEffect: t.entranceEffect,
    emojiList: t.emojiList ?? "",
    particleCount: t.particleCount ?? 40,
    heroEyebrowOverride: t.heroEyebrowOverride ?? "",
    heroKeywords: t.heroKeywords ?? "",
    heroKeywordsMode: t.heroKeywordsMode,
  };
}
