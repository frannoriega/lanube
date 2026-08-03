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
