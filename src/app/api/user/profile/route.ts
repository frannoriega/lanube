import { auth } from "@/lib/auth";
import { requireActiveSession } from "@/lib/api-auth";
import { updateRegisteredUserProfileByEmail } from "@/lib/db/users";
import { serializeJson } from "@/lib/json-bigint";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiCatch, apiServerError } from "@/lib/api/response";
import { dniInputSchema } from "@/lib/schemas/profile";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.userId) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    const row = await prisma.registeredUser.findUnique({
      where: { id: session.userId },
      include: {
        user: { select: { email: true, displayEmail: true } },
      },
    });
    if (!row) {
      return NextResponse.json(
        { message: "Usuario no encontrado" },
        { status: 401 },
      );
    }

    const { user, ...registered } = row;
    return NextResponse.json(
      serializeJson({
        ...registered,
        email: user.email,
        displayEmail: user.displayEmail,
      }),
    );
  } catch (error) {
    return apiServerError("user/profile GET", error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Escritura: un usuario suspendido no debe poder editar su perfil por API. El GET de
    // arriba sí queda accesible — es una lectura de sus propios datos, que la página
    // /banned puede necesitar (milestone-12 D24).
    const { session, error: authError } = await requireActiveSession();
    if (authError) return authError;
    // `requireActiveSession` garantiza `userId`, no el email; el helper de abajo busca por
    // email, así que se chequea explícitamente en lugar de asumirlo.
    const email = session.user?.email;
    if (!email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    const { name, lastName, dni, institution, reasonToJoin } =
      await request.json();

    const parsedDni = dniInputSchema.safeParse(dni);
    if (!parsedDni.success) {
      return NextResponse.json(
        { message: "Ingrese un DNI válido (solo números)" },
        { status: 400 },
      );
    }

    try {
      const updatedUser = await updateRegisteredUserProfileByEmail(email, {
        name,
        lastName,
        dni: parsedDni.data.toString(),
        institution,
        reasonToJoin,
      });
      return NextResponse.json(serializeJson(updatedUser));
    } catch (error) {
      return apiCatch("user/profile PUT (update)", error);
    }
  } catch (error) {
    return apiServerError("user/profile PUT", error);
  }
}
