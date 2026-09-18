export function toCapitalCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** "Charla de Robótica" -> "charla-de-robotica" (lowercase, ASCII, hyphen-separated). */
export function slugify(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
