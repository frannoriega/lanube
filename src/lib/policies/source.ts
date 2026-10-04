import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { diffText, type TextDiffLine } from "@/lib/audit/text-diff";
import type { PolicyDefinition } from "./registry";

/**
 * Texto fuente (markdown) de una versión de una política, leído del disco. Lo usan el diff
 * "Ver qué cambió" de `/policies/accept` y la tool MCP `get_policy`; para mostrar una política
 * en la web se usa el MDX compilado (`PolicyContent`). En Vercel, los archivos llegan al bundle por `outputFileTracingIncludes`
 * (`next.config.ts`).
 */
async function readPolicySource(file: string): Promise<string> {
  return readFile(
    path.join(process.cwd(), "src/assets/policies", file),
    "utf8",
  );
}

/**
 * El markdown de una versión de una política, tal como está publicado. Lo devuelve la tool MCP
 * `get_policy` (milestone 21). `null` si la versión no existe o no se pudo leer.
 */
export async function readPolicyMarkdown(
  policy: PolicyDefinition,
  version: string,
): Promise<string | null> {
  const v = policy.versions.find((x) => x.version === version);
  if (!v) return null;
  try {
    return await readPolicySource(v.file);
  } catch {
    return null;
  }
}

/**
 * El markdown sin las marcas que a quien lee solo le estorban en un diff (`**negrita**`,
 * `## ` de los títulos, las reglas `---`). Las viñetas (`- `) quedan: ayudan a ubicar.
 */
function readable(source: string): string {
  return source
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^-{3,}\s*$/gm, "");
}

/**
 * Diff por líneas y palabras entre dos versiones de una política (el mismo algoritmo que el
 * panel de auditoría, milestone 16). `null` si alguna versión no existe o no se pudo leer:
 * el diff es una ayuda, la pantalla funciona sin él (siempre está el resumen de cambios y el
 * texto completo).
 */
export async function diffPolicyVersions(
  policy: PolicyDefinition,
  fromVersion: string,
  toVersion: string,
): Promise<TextDiffLine[] | null> {
  const from = policy.versions.find((v) => v.version === fromVersion);
  const to = policy.versions.find((v) => v.version === toVersion);
  if (!from || !to) return null;
  try {
    const [a, b] = await Promise.all([
      readPolicySource(from.file),
      readPolicySource(to.file),
    ]);
    return diffText(readable(a), readable(b));
  } catch {
    return null;
  }
}
