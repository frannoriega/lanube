import { PUBLIC_TAGS, revalidatePublic } from "@/lib/cache/public-reads";
import { requirePermission } from "@/lib/api-auth";
import { apiError, apiServerError, apiSuccess } from "@/lib/api/response";
import { getSiteConfig, updateSiteConfig } from "@/lib/db/siteConfig";
import { siteConfigInputSchema } from "@/lib/schemas/config";
import { NextRequest } from "next/server";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";

// GET: read the site config. Any admin may read; only site-config:manage may mutate.
export async function GET() {
  const { error } = await requirePermission("admin:access");
  if (error) return error;

  const config = await getSiteConfig();
  return apiSuccess(config);
}

export async function PUT(request: NextRequest) {
  const { error, session } = await requirePermission("site-config:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = siteConfigInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400, {
      issues: parsed.error.issues,
    });
  }

  try {
    // Fila única (`id = "site"`) editada entera: antes se guardaba el formulario completo
    // como "después", y la entrada no decía qué había cambiado. Ahora, solo lo que cambió.
    const audit = await beginAudit("SiteConfig", "site");
    const config = await updateSiteConfig(parsed.data);
    await audit.commit(session, AUDIT_ACTIONS.siteConfigUpdate);
    // Invalida la caché pública: el pie, la CTA y el botón de WhatsApp muestran estos datos (milestone 25, P2).
    revalidatePublic(PUBLIC_TAGS.siteConfig);
    return apiSuccess(config);
  } catch (e) {
    return apiServerError("admin/site-config PUT", e);
  }
}
