import { apiServerError, apiSuccess } from "@/lib/api/response";
import { getMaintenanceSnapshot } from "@/lib/maintenance/server";
import type { NextRequest } from "next/server";

/**
 * Público (sin sesión): las ventanas de mantenimiento vigentes y las próximas. Lo leen el
 * aviso del sitio (cualquier visitante) y el middleware, que decide con esto si frena un
 * pedido (milestone 22).
 *
 * - Para el navegador se cachea 30 s en el CDN: el aviso no necesita ser instantáneo y la
 *   portada de un sitio caído no debería generar una consulta por visita.
 * - `?fresh=1` es la variante del middleware: nunca se cachea, así activar o apagar una
 *   ventana se nota en segundos y no en el vencimiento de un CDN.
 */
export async function GET(request: NextRequest) {
  try {
    const fresh = request.nextUrl.searchParams.get("fresh") === "1";
    const snapshot = await getMaintenanceSnapshot();
    return apiSuccess(snapshot, {
      headers: {
        "Cache-Control": fresh
          ? "no-store"
          : "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    return apiServerError("maintenance GET", err);
  }
}
