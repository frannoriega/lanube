import { auth } from "@/lib/auth";
import { getRegisteredUserById } from "@/lib/db/users";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.userId) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    const user = await getRegisteredUserById(session.userId);
    if (!user) {
      return NextResponse.json(
        { message: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
