import { requirePermission } from "@/lib/api-auth";
import { updateUserRole } from "@/lib/db/users";
import { serializeJson } from "@/lib/json-bigint";
import { UserRole } from "@/types/prisma";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

const roleUpdateSchema = z.object({
  role: z.enum(UserRole),
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

  const { id } = await params;
  // Changing your own role could lock the last superadmin out — disallow.
  if (id === session.userId) {
    return NextResponse.json(
      { message: "No podés cambiar tu propio rol" },
      { status: 400 },
    );
  }

  try {
    const user = await updateUserRole(id, parsed.data.role);
    return NextResponse.json(serializeJson(user));
  } catch {
    return NextResponse.json(
      { message: "Usuario no encontrado" },
      { status: 404 },
    );
  }
}
