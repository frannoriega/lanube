import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { recordAuditFromSession } from "@/lib/audit/record";
import { decideNewsPost } from "@/lib/db/news";
import { notifyNewsDecision } from "@/lib/email/news-decision";
import { prisma } from "@/lib/prisma";
import { newsPostDecisionSchema } from "@/lib/schemas/news";
import { NextRequest } from "next/server";

/** Approve or reject a PENDING_REVIEW post. news:approve only (Admin/Superadmin). */
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
    const post = await decideNewsPost(
      id,
      parsed.data.decision,
      parsed.data.reason ?? null,
    );

    await recordAuditFromSession(session, {
      action: AUDIT_ACTIONS.newsDecide,
      entityType: "NewsPost",
      entityId: id,
      before: { status: "PENDING_REVIEW" },
      after: { status: post.status },
      reason: parsed.data.reason ?? null,
    });

    if (post.authorId) {
      const author = await prisma.registeredUser.findUnique({
        where: { id: post.authorId },
        select: { user: { select: { email: true, displayEmail: true } } },
      });
      const to = author?.user.displayEmail || author?.user.email;
      if (to) {
        await notifyNewsDecision(
          to,
          post.title,
          post.id,
          parsed.data.decision,
          parsed.data.reason ?? null,
        );
      }
    }

    return apiSuccess(post);
  } catch (err) {
    return apiCatch("admin/news/[id]/decision POST", err);
  }
}
