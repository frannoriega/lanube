import { apiCatch } from "@/lib/api/response";
import { requireActiveSession } from "@/lib/api-auth";
import { getUserEvents } from "@/lib/db/participants";
import { serializeJson } from "@/lib/json-bigint";
import { NextResponse } from "next/server";

// GET: events the logged-in user participated in (matched by normalized email).
export async function GET() {
  try {
    // requireActiveSession y no auth() a pelo: también corta a suspendidos y a cuentas con
    // políticas sin aceptar (milestone-12 D24, milestone 19).
    const { session, error } = await requireActiveSession();
    if (error) return error;
    if (!session.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    const events = await getUserEvents(session.user.email);
    return NextResponse.json(serializeJson(events));
  } catch (err) {
    return apiCatch("user/events GET", err);
  }
}
