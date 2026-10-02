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

  // Un autor sin news:approve no puede escribir sobre una nota ya PUBLISHED en absoluto —
  // propone un cambio por /request en su lugar (ver esa ruta). `assertAuthorTransition`
  // vuelve a chequear el estado destino en la capa de dominio; esto solo bloquea temprano.
  if (!canApprove && before?.status === "PUBLISHED") {
    return apiError(
      "Esta nota está publicada — pedí una edición, pausa o eliminación en su lugar",
      403,
    );
  }
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
    if (before) {
      const diff = diffFields(before, post, [...AUDITED_NEWS_FIELDS]);
      if (diff) {
        await recordAuditFromSession(session, {
          action: AUDIT_ACTIONS.newsUpdate,
          entityType: "NewsPost",
          entityId: id,
          context: { Noticia: post.title },
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

  // Same gate as PUT: a plain author can't take a live post down on their own, even by
  // deleting it — they request it and an admin decides.
  if (!canApprove && before?.status === "PUBLISHED") {
    return apiError(
      "Esta nota está publicada — pedí que la eliminen en su lugar",
      403,
    );
  }

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
