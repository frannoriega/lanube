import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, over, parseCssColor, type Rgb } from "./contrast";

/**
 * Milestone 10, slice A. The audit found `--muted-foreground` had drifted to a value
 * failing AA across ~220 usages, `--ring` measuring 1.20:1 (an invisible focus ring) and
 * `--border` 1.26:1 (inputs reading as borderless) — none of it caught by anything. These
 * assertions read the tokens straight out of `globals.css`, so a future edit that
 * regresses one fails here rather than shipping.
 *
 * Thresholds: 4.5:1 for body text (WCAG 1.4.3 AA), 3:1 for UI component boundaries and
 * focus indicators (1.4.11).
 */

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** Pull a token's value from a given block (`:root` for light, `.dark` for dark). */
function token(name: string, theme: "light" | "dark"): string {
  const selector = theme === "light" ? ":root" : "\\.dark";
  const block = CSS.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!block) throw new Error(`Could not find the ${theme} token block`);
  const line = block[1].match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  if (!line) throw new Error(`Token --${name} not found in the ${theme} block`);
  return line[1].trim();
}

/** Resolve a token to an opaque color, compositing over `backdrop` when translucent. */
function color(name: string, theme: "light" | "dark", backdrop?: Rgb): Rgb {
  const { rgb, alpha } = parseCssColor(token(name, theme));
  if (alpha === 1) return rgb;
  if (!backdrop) {
    throw new Error(`--${name} is translucent; a backdrop is required`);
  }
  return over(rgb, alpha, backdrop);
}

const surfaces = {
  light: {
    background: color("background", "light"),
    card: color("card", "light"),
  },
  dark: {
    background: color("background", "dark"),
    card: color("card", "dark"),
  },
} as const;

describe("contrast helpers", () => {
  it("matches known WCAG reference ratios", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5);
    // #767676 on white is the canonical "just passes AA" gray.
    expect(contrastRatio([118, 118, 118], [255, 255, 255])).toBeGreaterThan(
      4.5,
    );
  });

  it("parses both token syntaxes used in globals.css", () => {
    expect(parseCssColor("#4e87c2")).toEqual({ rgb: [78, 135, 194], alpha: 1 });
    expect(parseCssColor("oklch(1 0 0)").rgb).toEqual([255, 255, 255]);
    expect(parseCssColor("oklch(1 0 0 / 35%)").alpha).toBeCloseTo(0.35, 5);
    expect(parseCssColor("oklch(92.9% 0.013 255.508)").rgb).toEqual([
      226, 232, 240,
    ]);
  });
});

describe("design tokens meet WCAG AA", () => {
  it.each(["light", "dark"] as const)(
    "%s: --muted-foreground clears 4.5:1 on both surfaces",
    (theme) => {
      const fg = color("muted-foreground", theme);
      // Both, because secondary text sits on the page ground and inside cards.
      expect(contrastRatio(fg, surfaces[theme].card)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrastRatio(fg, surfaces[theme].background),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(["light", "dark"] as const)(
    "%s: --foreground clears 4.5:1 on both surfaces",
    (theme) => {
      const fg = color("foreground", theme);
      expect(contrastRatio(fg, surfaces[theme].card)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrastRatio(fg, surfaces[theme].background),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(["light", "dark"] as const)(
    "%s: --ring clears 3:1 as a focus indicator",
    (theme) => {
      // The `/50` opacity modifier was removed from the primitives in slice A, so the
      // token's own ratio is what actually renders.
      const ring = color("ring", theme, surfaces[theme].card);
      expect(contrastRatio(ring, surfaces[theme].card)).toBeGreaterThanOrEqual(
        3,
      );
      expect(
        contrastRatio(ring, surfaces[theme].background),
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(["light", "dark"] as const)(
    "%s: --border and --input clear 3:1 against --card",
    (theme) => {
      for (const name of ["border", "input"]) {
        const value = color(name, theme, surfaces[theme].card);
        expect(
          contrastRatio(value, surfaces[theme].card),
          `--${name} (${theme})`,
        ).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it("the brand text pair clears 4.5:1, and la-nube-primary does not", () => {
    // Documents *why* the codebase must use `text-la-nube-selected
    // dark:text-la-nube-secondary` for text rather than `text-la-nube-primary`.
    const brand = (name: string) => {
      const line = CSS.match(
        new RegExp(`--color-la-nube-${name}\\s*:\\s*([^;]+);`),
      );
      if (!line) throw new Error(`--color-la-nube-${name} not found`);
      return parseCssColor(line[1]).rgb;
    };

    expect(
      contrastRatio(brand("selected"), surfaces.light.background),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(brand("secondary"), surfaces.dark.background),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(brand("primary"), surfaces.light.background),
    ).toBeLessThan(4.5);
  });
});
