import { getPublicSpaces } from "@/lib/db/spaces";
import { NextResponse } from "next/server";

export async function GET() {
  const spaces = await getPublicSpaces();
  const options = spaces
    .filter((s) => s.isReservable && s.fungibleResourceId)
    .map((s) => ({ id: s.fungibleResourceId!, name: s.name }));
  return NextResponse.json(options);
}
