import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { actorLabelFor } from "@/lib/audit/diff";
import { createNewsPost, listAdminNewsPosts } from "@/lib/db/news";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import {
  newsPostAdminInputSchema,
  newsPostInputSchema,
} from "@/lib/schemas/news";
import { NextRequest } from "next/server";

// GET: paginated list. A Comunicador (news:manage only) sees just their own
// posts; Admin/Superadmin (news:approve) see everyone's — scoped server-side.
export async function GET(request: NextRequest) {
  const { error, session } = await requirePermission("news:manage");
  if (error) return error;

  const canApprove = hasPermission(session.role, "news:approve");
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const status = searchParams.get("status") ?? undefined;

  try {
    const result = await listAdminNewsPosts({
      authorId: canApprove ? undefined : session.userId,
      status,
      page,
    });
    return apiSuccess(result);
  } catch (err) {
    return apiCatch("admin/news GET", err);
  }
}

export async function POST(request: NextRequest) {
  const { error, session } = await requirePermission("news:manage");
  if (error) return error;

  const canApprove = hasPermission(session.role, "news:approve");
  const schema = canApprove ? newsPostAdminInputSchema : newsPostInputSchema;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400, {
      issues: parsed.error.issues,
    });
  }

  try {
    const actorUser = await prisma.registeredUser.findUnique({
      where: { id: session.userId },
      select: {
        name: true,
        lastName: true,
        user: { select: { email: true, displayEmail: true } },
      },
    });
    const label = actorUser
      ? actorLabelFor(actorUser)
      : `(usuario ${session.userId})`;
    const post = await createNewsPost(
      parsed.data,
      { id: session.userId, label },
      canApprove,
    );
    return apiSuccess(post, { status: 201 });
  } catch (err) {
    return apiCatch("admin/news POST", err);
  }
}
