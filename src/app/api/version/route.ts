import { apiServerError, apiSuccess } from "@/lib/api/response";
import { getBuildInfo, readReleaseManifest } from "@/lib/build-info";
import type { NextRequest } from "next/server";

/**
 * Público (sin sesión, milestone 28): qué versión corre, de qué commit del repositorio público
 * salió y la huella de sus archivos estáticos. Es público a propósito: la licencia AGPL-3.0
 * existe para que cualquiera que use el sistema pueda saber qué código corre y obtenerlo; un
 * endpoint "oculto" no aporta nada (la información no es secreta) y le quita esa posibilidad
 * a quien no es superadmin.
 *
 * - `?files=1` agrega la lista completa `ruta → SHA-256` del manifiesto, que es lo que compara
 *   `scripts/verify-deployment.mjs` contra la imagen construida por CI.
 * - Lo que responde lo informa el propio servidor: ver la advertencia de `build-info.ts`.
 */
export async function GET(request: NextRequest) {
  try {
    const info = await getBuildInfo();
    const withFiles = request.nextUrl.searchParams.get("files") === "1";
    const files = withFiles
      ? ((await readReleaseManifest())?.files ?? null)
      : undefined;
    return apiSuccess(withFiles ? { ...info, files } : info, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    return apiServerError("version GET", err);
  }
}
