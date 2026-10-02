import { requirePermission } from "@/lib/api-auth";
import { updateUserRole } from "@/lib/db/users";
import { serializeJson } from "@/lib/json-bigint";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { emitAudit } from "@/lib/audit/emit";
import { getPermissionSetForUser, getRoleById } from "@/lib/db/roles";
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

  // El rol superadmin nunca se asigna desde el panel, ni siquiera por otro superadmin — ese
  // tier se otorga a mano en la base de datos (ver Role.grantableRoleIds).
  if (nextRole?.isSuperadmin) {
    return NextResponse.json(
      {
        message:
          "El rol superadmin no se puede asignar desde el panel: se otorga manualmente en la base de datos",
      },
      { status: 403 },
    );
  }

  // Un superadmin puede asignar cualquier rol no-superadmin (o quitar uno, con roleId
  // null). Cualquier otro actor con `users:roles:manage` queda limitado a lo que SU PROPIO
  // rol tiene habilitado otorgar — defensa en profundidad además del filtro que ya aplica
  // GET /api/admin/roles/assignable, para quien llame a este endpoint directamente.
  if (!session.isSuperadmin && parsed.data.roleId) {
    const resolved = await getPermissionSetForUser(session.userId);
    const grantable = new Set(resolved?.role?.grantableRoleIds ?? []);
    if (!grantable.has(parsed.data.roleId)) {
      return NextResponse.json(
        { message: "No tenés permiso para asignar ese rol" },
        { status: 403 },
      );
    }
  }

  try {
    const before = await prisma.registeredUser.findUnique({
      where: { id },
      select: { roleId: true, roleRef: { select: { name: true } } },
    });
    const user = await updateUserRole(id, parsed.data.roleId);
    if (before && before.roleId !== user.roleId) {
      await emitAudit(session, AUDIT_ACTIONS.userRoleUpdate, {
        entityId: id,
        context: { Usuario: `${user.name} ${user.lastName}` },
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
