/**
 * Velocidad de lectura asumida para el tiempo estimado de una noticia. 200 palabras por
 * minuto es un valor conservador para texto en español en pantalla (los estudios rondan
 * 200–240); preferimos sobreestimar un poco antes que prometer "1 min" para una nota larga.
 */
const WORDS_PER_MINUTE = 200;

/**
 * Minutos estimados de lectura del cuerpo markdown de una noticia, redondeados y con un
 * mínimo de 1 (nunca mostramos "0 min").
 *
 * Es una estimación, no un parser: se descartan los bloques de código y las imágenes (no se
 * "leen" palabra por palabra), de los links se cuenta solo el texto visible, y una "palabra"
 * es cualquier token separado por espacios que contenga al menos una letra o un número — así
 * los marcadores sueltos de markdown (`#`, `-`, `>`, `1.`) no inflan la cuenta. Se calcula
 * al renderizar en el servidor: no hay columna en la base, así que nunca queda desfasado
 * respecto del cuerpo.
 */
export function readingMinutes(markdown: string): number {
  const text = markdown
    // Bloques de código cercados: no se leen como prosa.
    .replace(/```[\s\S]*?```/g, " ")
    // Imágenes `![alt](url)`: fuera, alt incluido.
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    // Links `[texto](url)`: solo cuenta el texto.
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  const words = text
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
