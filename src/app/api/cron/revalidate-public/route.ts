import { NextRequest, NextResponse } from "next/server";

import { PUBLIC_TAGS, revalidatePublic } from "@/lib/cache/public-reads";
import { logger } from "@/lib/logger";

/**
 * Invalida **todo** lo que cachea el sitio público (milestone 26).
 *
 * Existe por el despliegue en VPS: el build de CI prerenderiza `/`, `/about`, `/spaces` y las
 * políticas leyendo una base **efímera** (la de CI), así que la imagen nace con datos de prueba
 * horneados. `deploy.sh` llama a esta ruta al terminar y después visita las páginas, para que el
 * primer visitante vea los datos reales y no los de CI.
 *
 * Misma autenticación que los otros crons (`Authorization: Bearer <CRON_SECRET>`). Vive bajo
 * `/api/cron` a propósito: ese prefijo está exento del portero de solo lectura, así que sigue
 * funcionando durante una ventana de mantenimiento (que es justo cuando se despliega).
 * Idempotente: invalidar de más solo cuesta regenerar.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tags = Object.values(PUBLIC_TAGS);
  revalidatePublic(...tags);
  logger.info("cron/revalidate-public", { tags });
  return NextResponse.json({ ok: true, tags });
}
