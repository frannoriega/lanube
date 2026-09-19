/** Default rotating keyword list for the landing hero's "un espacio de …" line.
 * Lives outside HeroSection (a "use client" module) so a Server Component (the
 * landing page, resolving a theme's keyword override) can import it directly —
 * named exports from a "use client" file become opaque client references when
 * imported server-side, not the actual value. */
export const BASE_KEYWORDS = [
  "innovación",
  "talento",
  "conocimiento",
  "aprendizaje",
  "colaboración",
  "creación",
];
