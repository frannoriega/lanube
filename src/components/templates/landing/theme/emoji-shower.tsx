"use client";

import { useEffect, useState } from "react";

interface Particle {
  id: number;
  emoji: string;
  leftPct: number;
  sizePx: number;
  durationS: number;
  delayS: number;
  rotateDeg: number;
}

/** Random float in [min, max). */
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function buildParticles(emojis: string[], count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    emoji: emojis[Math.floor(Math.random() * emojis.length)] ?? "🎉",
    leftPct: rand(0, 100),
    // Small/medium/large mix, not arbitrary px — keeps it a shower, not noise.
    sizePx: [20, 28, 36][Math.floor(Math.random() * 3)] ?? 28,
    durationS: rand(3.5, 6),
    delayS: rand(0, 1.8),
    rotateDeg: rand(-45, 45),
  }));
}

/**
 * A one-time "tada" shower of emoji, falling from the top of the viewport.
 * Plays at most once per browser per calendar day (localStorage-gated) for a
 * given `storageKey` (unique per theme, so a new theme next year plays again).
 * Renders nothing when reduced motion is preferred, still marking it as shown
 * so it doesn't keep trying.
 */
export function EmojiShower({
  emojis,
  particleCount,
  storageKey,
}: {
  emojis: string[];
  particleCount: number;
  /** Unique per theme + day, e.g. `landing-theme-shown:<themeId>:<YYYY-MM-DD>`. */
  storageKey: string;
}) {
  const [particles, setParticles] = useState<Particle[] | null>(null);

  useEffect(() => {
    if (emojis.length === 0) return;
    let alreadyShown = false;
    try {
      alreadyShown = window.localStorage.getItem(storageKey) === "1";
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Storage unavailable (private mode, blocked) — treat as not-yet-shown
      // and skip persisting; worst case it can replay on the next load.
    }
    if (alreadyShown) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion) return;

    const built = buildParticles(emojis, particleCount);
    setParticles(built);

    const maxLifetimeMs =
      (Math.max(...built.map((p) => p.delayS + p.durationS)) + 0.5) * 1000;
    const timeout = setTimeout(() => setParticles(null), maxLifetimeMs);
    return () => clearTimeout(timeout);
    // Intentionally runs once on mount: re-running on prop changes would risk
    // re-triggering the shower mid-visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!particles || particles.length === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute top-[-10%] select-none animate-emoji-fall"
          style={{
            left: `${p.leftPct}%`,
            fontSize: `${p.sizePx}px`,
            animationDuration: `${p.durationS}s`,
            animationDelay: `${p.delayS}s`,
            // @ts-expect-error -- custom property read by the keyframes below
            "--emoji-rotate": `${p.rotateDeg}deg`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
