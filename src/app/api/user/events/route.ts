import { auth } from "@/lib/auth";
import { getUserEvents } from "@/lib/db/participants";
import { serializeJson } from "@/lib/json-bigint";
import { NextResponse } from "next/server";

// GET: events the logged-in user participated in (matched by normalized email).
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const events = await getUserEvents(session.user.email);
  return NextResponse.json(serializeJson(events));
}
