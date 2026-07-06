import { getReservableSpaces } from "@/lib/db/spaces";
import { NextResponse } from "next/server";

export async function GET() {
  const spaces = await getReservableSpaces();
  return NextResponse.json(spaces.map((s) => ({ id: s.id, name: s.name })));
}
