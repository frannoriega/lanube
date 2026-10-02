import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { recordAuditFromSession } from "@/lib/audit/record";
import { getNewsPostById, requestNewsPostAction } from "@/lib/db/news";
import { newsPostRequestSchema } from "@/lib/schemas/news";
import { NextRequest } from "next/server";

/**
 * A plain `news:manage` author proposing an EDIT/PAUSE/DELETE against their own PUBLISHED
 * post — own post only, `news:approve` decides via `/decision` instead of calling this.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requirePermission("news:manage");
  if (error) return error;

  const { id } = await params;
  const existing = await getNewsPostById(id);
  if (!existing) return apiError("Nota no encontrada", 404);
  if (existing.authorId !== session.userId) {
    return apiError("Acceso denegado", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = newsPostRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400, {
      issues: parsed.error.issues,
    });
  }

  try {
    const post = await requestNewsPostAction(id, parsed.data.action, {
      reason: parsed.data.reason,
      content: parsed.data.content,
    });
    await recordAuditFromSession(session, {
      action: AUDIT_ACTIONS.newsRequest,
      entityType: "NewsPost",
      entityId: id,
      context: { Noticia: post.title },
      after: { pendingAction: post.pendingAction },
    });
    return apiSuccess(post);
  } catch (err) {
    return apiCatch("admin/news/[id]/request POST", err);
  }
}
