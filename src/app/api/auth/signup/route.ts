import { POLICIES_PENDING_CODE } from "@/lib/api/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeJson } from "@/lib/json-bigint";
import { NextRequest, NextResponse } from "next/server";
import { apiServerError } from "@/lib/api/response";
import { dniInputSchema } from "@/lib/schemas/profile";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    // Gate de políticas (milestone 19). Esta ruta no puede usar requireActiveSession() (todavía
    // no hay perfil), así que lo chequea a mano: sin esto, una cuenta vieja con políticas sin
    // aceptar podría completar el perfil por API salteándose el gate.
    if (session.policiesPending) {
      return NextResponse.json(
        {
          message:
            "Tenés que aceptar las políticas antes de completar tu perfil",
          code: POLICIES_PENDING_CODE,
        },
        { status: 403 },
      );
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

    // Check if user already exists
    const existingUser = await prisma.registeredUser.findFirst({
      include: { user: true },
      where: { user: { email: session.user.email } },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Usuario ya existe" },
        { status: 400 },
      );
    }

    // Create user
    const user = await prisma.registeredUser.create({
      data: {
        user: {
          connect: {
            email: session.user.email,
          },
        },
        name,
        lastName,
        dni: parsedDni.data.toString(),
        institution: institution || null,
        reasonToJoin,
      },
    });

    const body = JSON.stringify(serializeJson({ user }));
    return new NextResponse(body, {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return apiServerError("auth/signup POST", error);
  }
}
