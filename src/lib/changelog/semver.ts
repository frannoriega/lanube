/**
 * Versionado semántico mínimo (milestone 28): lo justo para validar y ordenar las versiones
 * del registro de novedades. Sin dependencias, para que lo puedan importar el cliente, el
 * servidor, los tests y los scripts de `scripts/` (con `tsx`).
 *
 * Solo acepta `MAJOR.MINOR.PATCH` sin prefijo `v` ni sufijos (`-rc.1`, `+build`): la app no
 * publica prereleases — una versión existe cuando llega a producción — así que admitirlas
 * solo abriría la puerta a ordenarlas mal.
 */

/** Una versión ya separada en sus tres números. */
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

/** `1.2.3`, sin ceros a la izquierda (como exige semver 2.0.0 §2). */
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** La versión separada, o `null` si no es `MAJOR.MINOR.PATCH` válido. */
export function parseSemver(value: string): SemVer | null {
  const m = SEMVER_RE.exec(value);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** Si una cadena es una versión válida. */
export function isSemver(value: string): boolean {
  return parseSemver(value) !== null;
}

/**
 * Compara dos versiones: negativo si `a < b`, 0 si son iguales, positivo si `a > b`.
 * Lanza si alguna no es válida: comparar basura en silencio es justo el error que este
 * módulo existe para evitar.
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) throw new Error(`Versión inválida: ${!pa ? a : b}`);
  return pa.major - pb.major || pa.minor - pb.minor || pa.patch - pb.patch;
}

/**
 * Si `next` es un salto válido desde `prev`: exactamente uno de los tres números sube en 1 y
 * los de su derecha vuelven a 0 (`1.2.3` → `1.2.4`, `1.3.0` o `2.0.0`). Evita saltearse
 * versiones (`1.0.0` → `1.2.0`) o subir dos cosas a la vez (`1.0.0` → `1.1.1`).
 */
export function isNextVersion(prev: string, next: string): boolean {
  const p = parseSemver(prev);
  const n = parseSemver(next);
  if (!p || !n) return false;
  return (
    (n.major === p.major && n.minor === p.minor && n.patch === p.patch + 1) ||
    (n.major === p.major && n.minor === p.minor + 1 && n.patch === 0) ||
    (n.major === p.major + 1 && n.minor === 0 && n.patch === 0)
  );
}
