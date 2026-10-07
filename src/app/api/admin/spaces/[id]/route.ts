import { PUBLIC_TAGS, revalidatePublic } from "@/lib/cache/public-reads";
import { requirePermission } from "@/lib/api-auth";
import {
  apiCatch,
  apiError,
  apiServerError,
  apiSuccess,
} from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";
import { deleteSpace, updateSpace } from "@/lib/db/spaces";
import { Prisma } from "@/generated/prisma/client";
import { spaceInputSchema } from "@/lib/schemas/config";
import { NextRequest } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission("spaces:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = spaceInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400, {
      issues: parsed.error.issues,
    });
  }

  const { id } = await params;
  try {
    // Qué campos se auditan (incluidos los textos largos y las preguntas frecuentes, con
    // su propio diff) lo decide el registro: `AUDIT_ENTITIES.Space`.
    const audit = await beginAudit("Space", id);
    const space = await updateSpace(id, parsed.data);
    await audit.commit(session, AUDIT_ACTIONS.spaceUpdate);
    // Invalida la caché pública: el sitio público muestra los espacios, y las tarjetas de eventos su nombre (milestone 25, P2).
    revalidatePublic(PUBLIC_TAGS.spaces);
    return apiSuccess(space);
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return apiError("Ya existe un espacio con ese slug", 409);
    }
    return apiServerError("admin/spaces/[id] PUT", e);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission("spaces:manage");
  if (error) return error;

  const { id } = await params;
  try {
    const audit = await beginAudit("Space", id);
    await deleteSpace(id);
    await audit.commit(session, AUDIT_ACTIONS.spaceDelete);
    // Invalida la caché pública: el sitio público muestra los espacios, y las tarjetas de eventos su nombre (milestone 25, P2).
    revalidatePublic(PUBLIC_TAGS.spaces);
    return apiSuccess({ ok: true });
  } catch (e) {
    return apiCatch("admin/spaces/[id] DELETE", e);
  }
}
