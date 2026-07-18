import { modules } from "@/modules";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const events = modules.events;
  if (!events) {
    // Events module disabled for this deployment.
    return NextResponse.json({ events: [], total: 0, page: 1, pageSize: 0 });
  }

  const { searchParams } = request.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    16,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "6", 10) || 6),
  );

  const result = await events.getUpcoming(page, pageSize);
  return NextResponse.json(result);
}
