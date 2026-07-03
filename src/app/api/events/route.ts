import { getUpcomingPublicEventsPage } from "@/lib/db/events";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    16,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "6", 10) || 6),
  );

  const result = await getUpcomingPublicEventsPage(page, pageSize);
  return NextResponse.json(result);
}
