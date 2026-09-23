/**
 * WCAG 2.1 relative-luminance contrast math, plus just enough color parsing to read the
 * design tokens back out of `globals.css`.
 *
 * This exists because milestone 10 found that `--muted-foreground` had drifted to a value
 * failing AA across ~220 usages with nothing to catch it. The numbers in that audit were
 * computed by a throwaway script; `contrast.test.ts` turns them into an assertion.
 */

export type Rgb = [number, number, number];

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance. */
export function relativeLuminance([r, g, b]: Rgb): number {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

/** WCAG contrast ratio, 1–21. Order-independent. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

export function parseHex(value: string): Rgb {
  let hex = value.trim().replace("#", "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`Not a hex color: ${value}`);
  }
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

/** oklch(L C H) → sRGB, clamped. L is 0–1 (a trailing `%` is accepted). */
export function oklchToRgb(L: number, C: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const encode = (v: number) => {
    const g = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(g * 255)));
  };
  return [encode(lr), encode(lg), encode(lb)];
}

/** Composite a translucent foreground over an opaque background. */
export function over(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as Rgb;
}

/**
 * Parse a CSS color as written in `globals.css`: `#rgb`, `#rrggbb`, or
 * `oklch(L C H)` / `oklch(L C H / A%)`. Translucent colors return their alpha so the
 * caller can composite them over whatever they actually sit on.
 */
export function parseCssColor(value: string): { rgb: Rgb; alpha: number } {
  const input = value.trim();
  if (input.startsWith("#")) return { rgb: parseHex(input), alpha: 1 };

  const match = input.match(/^oklch\(([^)]+)\)$/);
  if (!match) throw new Error(`Unsupported color syntax: ${value}`);

  const [components, alphaPart] = match[1].split("/").map((p) => p.trim());
  const [lRaw, cRaw, hRaw] = components.split(/\s+/);
  const L = lRaw.endsWith("%") ? parseFloat(lRaw) / 100 : parseFloat(lRaw);
  const alpha = alphaPart
    ? alphaPart.endsWith("%")
      ? parseFloat(alphaPart) / 100
      : parseFloat(alphaPart)
    : 1;

  return {
    rgb: oklchToRgb(L, parseFloat(cRaw ?? "0"), parseFloat(hRaw ?? "0")),
    alpha,
  };
}
