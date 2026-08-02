import { requirePermission } from "@/lib/api-auth";
import {
  apiCatch,
  apiError,
  apiServerError,
  apiSuccess,
} from "@/lib/api/response";
import { deleteSpace, updateSpace } from "@/lib/db/spaces";
import { Prisma } from "@/generated/prisma/client";
import { spaceInputSchema } from "@/lib/schemas/config";
import { NextRequest } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("spaces:manage");
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
    const space = await updateSpace(id, parsed.data);
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
  const { error } = await requirePermission("spaces:manage");
  if (error) return error;

  const { id } = await params;
  try {
    await deleteSpace(id);
    return apiSuccess({ ok: true });
  } catch (e) {
    return apiCatch("admin/spaces/[id] DELETE", e);
  }
}
