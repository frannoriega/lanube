import { auth } from "@/lib/auth";
import { getDashboardStatsByUserId } from "@/lib/db/dashboardStats";
import { serializeJson } from "@/lib/json-bigint";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.userId || !session.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    const stats = await getDashboardStatsByUserId(session.userId);

    return NextResponse.json(serializeJson(stats));
  } catch {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}





