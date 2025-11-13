import { auth } from "@/lib/auth";
import { getDashboardStatsByUserId } from "@/lib/db/dashboardStats";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.userId || !session.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    const stats = await getDashboardStatsByUserId(session.userId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("[GET /api/user/stats] Failed to load dashboard stats", error);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}


