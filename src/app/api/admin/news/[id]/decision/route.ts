import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";
import { decideNewsPost, getNewsPostById } from "@/lib/db/news";
import { notify } from "@/lib/notifications/dispatch";
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

    const audit = await beginAudit("NewsPost", id);
    const post = await decideNewsPost(
      id,
      parsed.data.decision,
      parsed.data.reason ?? null,
    );

    // Si se aprobó una edición pedida, el diff muestra el contenido que se aplicó.
    await audit.commit(session, AUDIT_ACTIONS.newsDecide, {
      reason: parsed.data.reason ?? null,
    });

    // A deleted-and-unreassigned author has no one to notify — SetNull leaves authorId
    // null rather than orphaning the decision.
    if (post.authorId) {
      try {
        await notify({
          type: "news.decided",
          recipient: { registeredUserId: post.authorId },
          data: {
            newsPostId: post.id,
            title: post.title,
            slug: post.slug,
            kind,
            decision: parsed.data.decision,
            reason: parsed.data.reason ?? null,
          },
        });
      } catch {
        // Never fail the decision over a notification problem.
      }
    }

    return apiSuccess(post);
  } catch (err) {
    return apiCatch("admin/news/[id]/decision POST", err);
  }
}
