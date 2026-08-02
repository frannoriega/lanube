import { auth } from "@/lib/auth";
import { getRegisteredUserById } from "@/lib/db/users";
import { serializeJson } from "@/lib/json-bigint";
import { NextResponse } from "next/server";
import { apiServerError } from "@/lib/api/response";

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

    return NextResponse.json(serializeJson(user));
  } catch (error) {
    return apiServerError("session GET", error);
  }
}
