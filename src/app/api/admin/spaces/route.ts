import { PUBLIC_TAGS, revalidatePublic } from "@/lib/cache/public-reads";
import { requirePermission } from "@/lib/api-auth";
import { apiError, apiServerError, apiSuccess } from "@/lib/api/response";
import { createSpace, getPublicSpaces } from "@/lib/db/spaces";
import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { spaceInputSchema } from "@/lib/schemas/config";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";

// GET: list spaces. `?reservable=1` narrows to reservable ones (event-form picker);
// any admin can read, mutations need spaces:manage.
export async function GET(request: NextRequest) {
  const { error } = await requirePermission("admin:access");
  if (error) return error;

  const reservableOnly =
    new URL(request.url).searchParams.get("reservable") === "1";
  const spaces = await getPublicSpaces();
  return apiSuccess(
    reservableOnly ? spaces.filter((s) => s.isReservable) : spaces,
  );
}

/** Prisma unique-constraint violation (e.g. duplicate slug). */
function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

export async function POST(request: NextRequest) {
  const { error, session } = await requirePermission("spaces:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = spaceInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400, {
      issues: parsed.error.issues,
    });
  }

  try {
    const audit = await beginAudit("Space", null);
    const space = await createSpace(parsed.data);
    await audit.commit(session, AUDIT_ACTIONS.spaceCreate, {
      entityId: space.id,
    });
    // Invalida la caché pública: el sitio público muestra los espacios, y las tarjetas de eventos su nombre (milestone 25, P2).
    revalidatePublic(PUBLIC_TAGS.spaces);
    return apiSuccess(space, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return apiError("Ya existe un espacio con ese slug", 409);
    }
    return apiServerError("admin/spaces POST", e);
  }
}
