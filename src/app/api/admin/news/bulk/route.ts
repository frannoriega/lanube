import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";
import { deleteNewsPost, setNewsPostsFeatured } from "@/lib/db/news";
import { getPermissionSetForUser } from "@/lib/db/roles";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { bulkActionSchema, type BulkActionResult } from "@/lib/schemas/bulk";
import { createId } from "@paralleldrive/cuid2";
import { NextRequest } from "next/server";

/**
 * Acciones en lote sobre noticias (milestone 16): eliminar, destacar o quitar de destacadas
 * las notas marcadas en la lista.
 *
 * Se respetan **las mismas reglas que nota por nota** (`/api/admin/news/[id]` DELETE):
 * - Destacar es una decisión de portada: solo `news:approve`.
 * - Sin `news:approve`, solo se pueden eliminar notas propias que no estén publicadas (una
 *   publicada se pide eliminar, no se elimina). Las que no cumplen se saltean y se informan,
 *   en vez de rechazar todo el lote.
 *
 * Cada nota tocada deja su propia entrada de auditoría, todas con el mismo `requestId`.
 */
export async function POST(request: NextRequest) {
  const { error, session } = await requirePermission("news:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = bulkActionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
  }
  const { ids, action } = parsed.data;
  const canApprove = hasPermission(
    (await getPermissionSetForUser(session.userId))?.permissions,
    "news:approve",
  );
  if (action !== "delete" && !canApprove) {
    return apiError("Solo quien aprueba noticias puede destacarlas", 403);
  }

  const requestId = createId();
  const result: BulkActionResult = { done: 0, skipped: [] };

  try {
    if (action === "delete") {
      const posts = await prisma.newsPost.findMany({
        where: { id: { in: ids } },
        select: { id: true, authorId: true, status: true, deletedAt: true },
      });
      const byId = new Map(posts.map((p) => [p.id, p]));
      for (const id of ids) {
        const post = byId.get(id);
        const reason = !post
          ? "No existe"
          : post.deletedAt !== null
            ? "Ya estaba eliminada"
            : !canApprove && post.authorId !== session.userId
              ? "No es tuya"
              : !canApprove && post.status === "PUBLISHED"
                ? "Está publicada: pedí que la eliminen"
                : null;
        if (reason) {
          result.skipped.push({ id, reason });
          continue;
        }
        const audit = await beginAudit("NewsPost", id);
        await deleteNewsPost(id);
        await audit.commit(session, AUDIT_ACTIONS.newsDelete, { requestId });
        result.done++;
      }
      return apiSuccess(result);
    }

    const audits = await Promise.all(
      ids.map((id) => beginAudit("NewsPost", id)),
    );
    const changed = new Set(
      await setNewsPostsFeatured(ids, action === "feature"),
    );
    for (const [i, id] of ids.entries()) {
      if (!changed.has(id)) {
        result.skipped.push({
          id,
          reason:
            action === "feature"
              ? "Ya estaba destacada o está eliminada"
              : "No estaba destacada",
        });
        continue;
      }
      await audits[i].commit(session, AUDIT_ACTIONS.newsUpdate, { requestId });
      result.done++;
    }
    return apiSuccess(result);
  } catch (err) {
    return apiCatch("admin/news/bulk POST", err);
  }
}
