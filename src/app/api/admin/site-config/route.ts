import { requirePermission } from "@/lib/api-auth";
import { apiError, apiServerError, apiSuccess } from "@/lib/api/response";
import { getSiteConfig, updateSiteConfig } from "@/lib/db/siteConfig";
import { siteConfigInputSchema } from "@/lib/schemas/config";
import { NextRequest } from "next/server";

// GET: read the site config. Any admin may read; only site-config:manage may mutate.
export async function GET() {
  const { error } = await requirePermission("admin:access");
  if (error) return error;

  const config = await getSiteConfig();
  return apiSuccess(config);
}

export async function PUT(request: NextRequest) {
  const { error } = await requirePermission("site-config:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = siteConfigInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400, {
      issues: parsed.error.issues,
    });
  }

  try {
    const config = await updateSiteConfig(parsed.data);
    return apiSuccess(config);
  } catch (e) {
    return apiServerError("admin/site-config PUT", e);
  }
}
