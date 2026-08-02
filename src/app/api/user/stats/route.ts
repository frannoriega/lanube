import { auth } from "@/lib/auth";
import { getDashboardStatsByUserId } from "@/lib/db/dashboardStats";
import { serializeJson } from "@/lib/json-bigint";
import { NextResponse } from "next/server";
import { apiServerError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.userId || !session.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    const stats = await getDashboardStatsByUserId(session.userId);

    return NextResponse.json(serializeJson(stats));
  } catch (error) {
    return apiServerError("user/stats GET", error);
  }
}
