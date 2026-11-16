import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Release } from "./registry";

/**
 * El markdown de una versión del registro de novedades, leído del disco (milestone 28).
 *
 * Las páginas de `/changelog` se generan completas en el build (no dependen del reloj ni de la
 * base), así que en la práctica esto corre en el build. Igual los `.md` viajan con el bundle
 * (`outputFileTracingIncludes` en `next.config.ts`) por si una página se regenera en el
 * servidor. `null` si no se pudo leer: la página muestra el resumen igual.
 */
export async function readReleaseMarkdown(
  release: Release,
): Promise<string | null> {
  try {
    return await readFile(
      path.join(process.cwd(), "src/assets/changelog", release.file),
      "utf8",
    );
  } catch {
    return null;
  }
}
