import { requirePermission } from "@/lib/api-auth";
import { updateUserRole } from "@/lib/db/users";
import { serializeJson } from "@/lib/json-bigint";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { recordAuditFromSession } from "@/lib/audit/record";
import { getRoleById } from "@/lib/db/roles";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

// Roles are data now: the client sends a Role id (or null for the base tier), not an
// enum value. Existence is checked below so an unknown id 400s instead of surfacing a
// raw FK error from Prisma.
const roleUpdateSchema = z.object({
  roleId: z.string().min(1).nullable(),
});

// PATCH: change a user's role (superadmin only).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission("users:roles:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = roleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Rol inválido" }, { status: 400 });
  }

  const nextRole = parsed.data.roleId
    ? await getRoleById(parsed.data.roleId)
    : null;
  if (parsed.data.roleId && !nextRole) {
    return NextResponse.json({ message: "El rol no existe" }, { status: 400 });
  }

  const { id } = await params;
  // Changing your own role could lock the last superadmin out — disallow.
  if (id === session.userId) {
    return NextResponse.json(
      { message: "No podés cambiar tu propio rol" },
      { status: 400 },
    );
  }

  // Solo un superadmin puede otorgar el tier superadmin. Hoy `users:roles:manage` lo tiene
  // únicamente el rol SUPERADMIN, así que esto no es explotable tal como está sembrado —
  // pero `users:roles:manage` es un permiso asignable del catálogo, así que un superadmin
  // podría delegar la asignación de roles a alguien que no lo es, y esa persona podría
  // otorgarse superadmin a través de una cuenta títere. Defensa en profundidad: quien no es
  // superadmin no puede crear superadmins (milestone-12 D27).
  if (nextRole?.isSuperadmin && !session.isSuperadmin) {
    return NextResponse.json(
      { message: "Solo un superadmin puede asignar el rol de superadmin" },
      { status: 403 },
    );
  }

  try {
    const before = await prisma.registeredUser.findUnique({
      where: { id },
      select: { roleId: true, roleRef: { select: { name: true } } },
    });
    const user = await updateUserRole(id, parsed.data.roleId);
    if (before && before.roleId !== user.roleId) {
      await recordAuditFromSession(session, {
        action: AUDIT_ACTIONS.userRoleUpdate,
        entityType: "RegisteredUser",
        entityId: id,
        // Log the readable name alongside the id — the id alone is unreadable in the
        // audit view, and a role can be renamed after the fact.
        before: { roleId: before.roleId, role: before.roleRef?.name ?? null },
        after: { roleId: user.roleId, role: user.roleRef?.name ?? null },
      });
    }
    return NextResponse.json(serializeJson(user));
  } catch {
    return NextResponse.json(
      { message: "Usuario no encontrado" },
      { status: 404 },
    );
  }
}
