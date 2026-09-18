import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { deleteNewsPost, getNewsPostById, updateNewsPost } from "@/lib/db/news";
import { hasPermission } from "@/lib/rbac";
import {
  newsPostAdminInputSchema,
  newsPostInputSchema,
} from "@/lib/schemas/news";
import { NextRequest } from "next/server";

async function assertOwnedOrPrivileged(
  id: string,
  userId: string,
  canApprove: boolean,
) {
  const post = await getNewsPostById(id);
  if (!post) return { post: null, error: apiError("Nota no encontrada", 404) };
  if (!canApprove && post.authorId !== userId) {
    return { post: null, error: apiError("Acceso denegado", 403) };
  }
  return { post, error: null };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requirePermission("news:manage");
  if (error) return error;

  const { id } = await params;
  const canApprove = hasPermission(session.role, "news:approve");
  const { post, error: ownErr } = await assertOwnedOrPrivileged(
    id,
    session.userId,
    canApprove,
  );
  if (ownErr) return ownErr;
  return apiSuccess(post);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requirePermission("news:manage");
  if (error) return error;

  const { id } = await params;
  const canApprove = hasPermission(session.role, "news:approve");
  const { error: ownErr } = await assertOwnedOrPrivileged(
    id,
    session.userId,
    canApprove,
  );
  if (ownErr) return ownErr;

  const schema = canApprove ? newsPostAdminInputSchema : newsPostInputSchema;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400, {
      issues: parsed.error.issues,
    });
  }

  try {
    const post = await updateNewsPost(id, parsed.data, canApprove);
    return apiSuccess(post);
  } catch (err) {
    return apiCatch("admin/news/[id] PUT", err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requirePermission("news:manage");
  if (error) return error;

  const { id } = await params;
  const canApprove = hasPermission(session.role, "news:approve");
  const { error: ownErr } = await assertOwnedOrPrivileged(
    id,
    session.userId,
    canApprove,
  );
  if (ownErr) return ownErr;

  try {
    await deleteNewsPost(id);
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiCatch("admin/news/[id] DELETE", err);
  }
}
