import { requirePermission } from "@/lib/api-auth";
import {
  apiCatch,
  apiError,
  apiServerError,
  apiSuccess,
} from "@/lib/api/response";
import { diffFields } from "@/lib/audit/diff";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { recordAuditFromSession } from "@/lib/audit/record";
import { deleteSpace, getSpaceById, updateSpace } from "@/lib/db/spaces";
import { Prisma } from "@/generated/prisma/client";
import { spaceInputSchema } from "@/lib/schemas/config";
import { NextRequest } from "next/server";

// Fields diffed into the audit trail — excludes free-text (description,
// longDescription, faqs) to keep entries small and readable.
const AUDITED_SPACE_FIELDS = [
  "name",
  "slug",
  "capacity",
  "isExclusive",
  "isReservable",
  "isFeatured",
  "displayOrder",
  "iconName",
  "imageUrl",
] as const;

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
    const before = await getSpaceById(id);
    const space = await updateSpace(id, parsed.data);
    if (before) {
      const diff = diffFields(before, space, [...AUDITED_SPACE_FIELDS]);
      if (diff) {
        await recordAuditFromSession(session, {
          action: AUDIT_ACTIONS.spaceUpdate,
          entityType: "Space",
          entityId: id,
          ...diff,
        });
      }
    }
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
    const before = await getSpaceById(id);
    await deleteSpace(id);
    if (before) {
      await recordAuditFromSession(session, {
        action: AUDIT_ACTIONS.spaceDelete,
        entityType: "Space",
        entityId: id,
        before: { name: before.name, slug: before.slug },
      });
    }
    return apiSuccess({ ok: true });
  } catch (e) {
    return apiCatch("admin/spaces/[id] DELETE", e);
  }
}
