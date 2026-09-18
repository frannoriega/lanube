import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { decideNewsPost } from "@/lib/db/news";
import { newsPostDecisionSchema } from "@/lib/schemas/news";
import { NextRequest } from "next/server";

/** Approve or reject a PENDING_REVIEW post. news:approve only (Admin/Superadmin). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("news:approve");
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
    return apiSuccess(post);
  } catch (err) {
    return apiCatch("admin/news/[id]/decision POST", err);
  }
}
