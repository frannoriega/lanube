import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { recordAuditFromSession } from "@/lib/audit/record";
import { decideNewsPost, getNewsPostById } from "@/lib/db/news";
import { newsPostDecisionSchema } from "@/lib/schemas/news";
import { NextRequest } from "next/server";

/**
 * Approve or reject whatever a post is currently waiting on — a PENDING_REVIEW submission,
 * or a pending EDIT/PAUSE/DELETE request against a PUBLISHED post. news:approve only
 * (Admin/Superadmin). `decideNewsPost` picks which; this route only needs to know there
 * *is* one, from before the decision, to refuse a decision on a post with nothing pending.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission("news:approve");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = newsPostDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400, {
      issues: parsed.error.issues,
    });
  }

  try {
    const { id } = await params;
    const before = await getNewsPostById(id);
    if (!before) return apiError("Nota no encontrada", 404);
    const kind =
      before.status === "PENDING_REVIEW" ? "SUBMISSION" : before.pendingAction;
    if (!kind) {
      return apiError(
        "Esta nota no tiene nada pendiente de aprobar o rechazar",
        409,
      );
    }

    const post = await decideNewsPost(
      id,
      parsed.data.decision,
      parsed.data.reason ?? null,
    );

    await recordAuditFromSession(session, {
      action: AUDIT_ACTIONS.newsDecide,
      entityType: "NewsPost",
      entityId: id,
      before: { status: before.status, pendingAction: before.pendingAction },
      after: { status: post.status, pendingAction: post.pendingAction },
      reason: parsed.data.reason ?? null,
    });

    return apiSuccess(post);
  } catch (err) {
    return apiCatch("admin/news/[id]/decision POST", err);
  }
}
