import { auth } from "@/lib/auth";
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
    const session = await auth();

    if (!session?.user?.email) {
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
      const updatedUser = await updateRegisteredUserProfileByEmail(
        session.user.email,
        {
          name,
          lastName,
          dni: parsedDni.data.toString(),
          institution,
          reasonToJoin,
        },
      );
      return NextResponse.json(serializeJson(updatedUser));
    } catch (error) {
      return apiCatch("user/profile PUT (update)", error);
    }
  } catch (error) {
    return apiServerError("user/profile PUT", error);
  }
}
