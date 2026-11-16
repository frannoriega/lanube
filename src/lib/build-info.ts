import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { APP_VERSION } from "@/lib/changelog/registry";

/**
 * Identidad del build que está corriendo (milestone 28): qué versión es, de qué commit del
 * repositorio público salió y cuándo se construyó. La lee el pie del sitio (enlace al código
 * fuente exacto) y `GET /api/version`, que es lo que consulta `scripts/verify-deployment.mjs`.
 *
 * ⚠️ Todo esto lo **informa el propio servidor**, así que sirve para detectar un despliegue
 * desprolijo, no para probar nada ante alguien que modificó el código: quien cambia el código
 * puede cambiar también lo que este módulo responde. Lo que sí se puede comprobar desde
 * afuera — y es lo que hace el script — es si los archivos JavaScript/CSS que el sitio le
 * sirve a cualquier navegador son byte a byte los del build de CI para ese commit. El límite
 * (el código que corre solo en el servidor no se puede ver desde afuera) y la parte legal
 * están en `docs/milestones/milestones-28-versioning-and-build-verification.md`.
 */

/** Repositorio público del código (AGPL-3.0). Un fork que se despliegue debe apuntar al suyo. */
export const SOURCE_REPOSITORY = "https://github.com/frannoriega/lanube";

/** Licencia del código, como identificador SPDX. */
export const SOURCE_LICENSE = "AGPL-3.0";

/** Un SHA de commit completo (40 hex). Cualquier otra cosa se descarta. */
const COMMIT_RE = /^[0-9a-f]{40}$/;

/**
 * El commit del build. En la imagen Docker lo pone el `Dockerfile` (`APP_COMMIT_SHA`, del
 * `--build-arg GIT_SHA` que pasa CI); en Vercel, `VERCEL_GIT_COMMIT_SHA`. En desarrollo no hay.
 */
export function buildCommit(): string | null {
  const raw = (
    process.env.APP_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    ""
  ).toLowerCase();
  return COMMIT_RE.test(raw) ? raw : null;
}

/** Enlace al código fuente de este build: el árbol del commit exacto, o el repo si no se sabe. */
export function sourceUrl(commit: string | null = buildCommit()): string {
  return commit ? `${SOURCE_REPOSITORY}/tree/${commit}` : SOURCE_REPOSITORY;
}

/**
 * El manifiesto que escribe `scripts/release-manifest.mjs` después de `next build`: el SHA-256
 * de cada archivo de `/_next/static` (lo único del build que cualquiera puede descargar) y un
 * resumen de todos. Solo existe en la imagen de producción.
 */
export interface ReleaseManifest {
  schema: 1;
  version: string;
  commit: string | null;
  builtAt: string;
  /** SHA-256 de las líneas `"<ruta> <sha256>\n"` ordenadas: una huella de todo `/_next/static`. */
  staticDigest: string;
  /** Ruta pública (`/_next/static/...`) → SHA-256 hex. */
  files: Record<string, string>;
}

let manifestPromise: Promise<ReleaseManifest | null> | null = null;

/**
 * El manifiesto del build (`release-manifest.json` junto al `server.js` del standalone), o
 * `null` si no existe (desarrollo, Vercel). Se lee una vez por proceso: no cambia sin redeploy.
 */
export function readReleaseManifest(): Promise<ReleaseManifest | null> {
  manifestPromise ??= readFile(
    path.join(process.cwd(), "release-manifest.json"),
    "utf8",
  )
    .then((raw) => JSON.parse(raw) as ReleaseManifest)
    .catch(() => null);
  return manifestPromise;
}

/** Lo que responde `GET /api/version` (sin la lista de archivos). */
export interface BuildInfo {
  version: string;
  commit: string | null;
  builtAt: string | null;
  staticDigest: string | null;
  staticFiles: number | null;
  repository: string;
  source: string;
  license: string;
}

/** La identidad del build, con lo que haya del manifiesto. */
export async function getBuildInfo(): Promise<BuildInfo> {
  const manifest = await readReleaseManifest();
  const commit = buildCommit();
  return {
    version: APP_VERSION,
    commit,
    builtAt: manifest?.builtAt ?? null,
    staticDigest: manifest?.staticDigest ?? null,
    staticFiles: manifest ? Object.keys(manifest.files).length : null,
    repository: SOURCE_REPOSITORY,
    source: sourceUrl(commit),
    license: SOURCE_LICENSE,
  };
}
