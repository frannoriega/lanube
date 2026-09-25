import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { diffFields } from "@/lib/audit/diff";
import { recordAuditFromSession } from "@/lib/audit/record";
import { deleteNewsPost, getNewsPostById, updateNewsPost } from "@/lib/db/news";
import { getPermissionSetForUser } from "@/lib/db/roles";
import { hasPermission } from "@/lib/rbac";
import {
  newsPostAdminInputSchema,
  newsPostAmendInputSchema,
  newsPostInputSchema,
} from "@/lib/schemas/news";
import { NextRequest } from "next/server";

const AUDITED_NEWS_FIELDS = [
  "title",
  "status",
  "isFeatured",
  "featuredOrder",
] as const;

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
  const canApprove = hasPermission(
    (await getPermissionSetForUser(session.userId))?.permissions,
    "news:approve",
  );
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
  const canApprove = hasPermission(
    (await getPermissionSetForUser(session.userId))?.permissions,
    "news:approve",
  );
  const { post: before, error: ownErr } = await assertOwnedOrPrivileged(
    id,
    session.userId,
    canApprove,
  );
  if (ownErr) return ownErr;

  // Un autor sin news:approve puede dejar publicada su propia nota ya publicada mientras la
  // corrige (milestone-12 D20), así que el conjunto de estados permitidos depende del estado
  // guardado de la nota. `assertAuthorTransition` vuelve a chequear la misma regla en la capa
  // de dominio — esto solo decide qué estados parsean.
  const schema = canApprove
    ? newsPostAdminInputSchema
    : before?.status === "PUBLISHED"
      ? newsPostAmendInputSchema
      : newsPostInputSchema;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400, {
      issues: parsed.error.issues,
    });
  }

  try {
    const post = await updateNewsPost(id, parsed.data, canApprove);
    if (before) {
      const diff = diffFields(before, post, [...AUDITED_NEWS_FIELDS]);
      if (diff) {
        await recordAuditFromSession(session, {
          action: AUDIT_ACTIONS.newsUpdate,
          entityType: "NewsPost",
          entityId: id,
          ...diff,
        });
      }
    }
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
  const canApprove = hasPermission(
    (await getPermissionSetForUser(session.userId))?.permissions,
    "news:approve",
  );
  const { post: before, error: ownErr } = await assertOwnedOrPrivileged(
    id,
    session.userId,
    canApprove,
  );
  if (ownErr) return ownErr;

  try {
    await deleteNewsPost(id);
    if (before) {
      await recordAuditFromSession(session, {
        action: AUDIT_ACTIONS.newsDelete,
        entityType: "NewsPost",
        entityId: id,
        before: { title: before.title },
      });
    }
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiCatch("admin/news/[id] DELETE", err);
  }
}
