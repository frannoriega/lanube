import { auth } from "@/lib/auth";
import { requireActiveSession } from "@/lib/api-auth";
import { updateOwnPersonalInfo } from "@/lib/db/users";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import {
  apiCatch,
  apiError,
  apiServerError,
  apiSuccess,
} from "@/lib/api/response";
import { personalInfoSchema } from "@/lib/schemas/profile";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.userId) {
      return apiError("No autorizado", 401);
    }

    const row = await prisma.registeredUser.findUnique({
      where: { id: session.userId },
      include: {
        user: { select: { email: true, displayEmail: true } },
        roleRef: { select: { name: true } },
      },
    });
    if (!row) {
      return apiError("Usuario no encontrado", 401);
    }

    const { user, roleRef, ...registered } = row;
    return apiSuccess({
      ...registered,
      email: user.email,
      displayEmail: user.displayEmail,
      // Antes la página leía `role` de una fila que no lo traía (solo `roleId`), así que
      // todos — superadmins incluidos — veían "Usuario". Ahora va el nombre del rol.
      role: roleRef?.name ?? null,
    });
  } catch (error) {
    return apiServerError("user/profile GET", error);
  }
}

/**
 * Actualiza los datos personales editables (nombre, apellido, institución).
 *
 * El DNI y el motivo para unirse **no** se aceptan acá desde el milestone 17: se cambian
 * con una solicitud que aprueba un admin (`/api/user/profile/change-requests`). Si un
 * cliente viejo los manda, se ignoran — el esquema solo toma los tres campos editables.
 */
export async function PUT(request: NextRequest) {
  try {
    // Escritura: un usuario suspendido no debe poder editar su perfil por API. El GET de
    // arriba sí queda accesible — es una lectura de sus propios datos, que la página
    // /banned puede necesitar (milestone-12 D24).
    const { session, error: authError } = await requireActiveSession();
    if (authError) return authError;

    const parsed = personalInfoSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Datos inválidos",
        400,
      );
    }

    try {
      const updatedUser = await updateOwnPersonalInfo(session.userId, {
        name: parsed.data.name,
        lastName: parsed.data.lastName,
        institution: parsed.data.institution || null,
      });
      return apiSuccess(updatedUser);
    } catch (error) {
      return apiCatch("user/profile PUT (update)", error);
    }
  } catch (error) {
    return apiServerError("user/profile PUT", error);
  }
}
