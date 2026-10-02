import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";
import { restoreNewsPost } from "@/lib/db/news";
import { NextRequest } from "next/server";

/** Clears a soft delete. news:approve only (Admin/Superadmin). */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requirePermission("news:approve");
  if (error) return error;

  const { id } = await params;
  try {
    const audit = await beginAudit("NewsPost", id);
    const post = await restoreNewsPost(id);
    await audit.commit(session, AUDIT_ACTIONS.newsRestore);
    return apiSuccess(post);
  } catch (err) {
    return apiCatch("admin/news/[id]/restore POST", err);
  }
}
