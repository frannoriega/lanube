import { now } from "@/lib/clock";
import { NextResponse } from "next/server";

/**
 * Dev-only: returns the server's idea of "now" (matches Docker faketime when enabled).
 * Handy for curl checks; the UI uses ServerTimeProvider from the root layout instead.
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const d = now();
  return NextResponse.json({
    iso: d.toISOString(),
    unixMs: d.getTime(),
  });
}
