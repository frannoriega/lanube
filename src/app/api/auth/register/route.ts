import { createUser } from "@/lib/db/users";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email, password, passwordConfirmation } = await request.json();
  if (password !== passwordConfirmation) {
    return NextResponse.json(
      { message: "Las contraseñas no coinciden" },
      { status: 400 },
    );
  }
  try {
    await createUser(email, password);
    return NextResponse.json(
      { message: "Usuario creado correctamente" },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { message: "El email ya está registrado" },
          { status: 409 },
        );
      }
    }
    return NextResponse.json(
      { message: "Error al crear la cuenta" },
      { status: 500 },
    );
  }
}
