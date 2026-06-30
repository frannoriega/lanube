import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/db/adminReservations";
import { prisma } from "@/lib/prisma";
import { serializeJson } from "@/lib/json-bigint";
import { NextResponse } from "next/server";

// GET: list all resources (for the admin event resource picker).
export async function GET() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }
  if (!(await isAdminUser(session.userId))) {
    return NextResponse.json({ message: "Acceso denegado" }, { status: 403 });
  }

  const resources = await prisma.resource.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      fungibleResource: { select: { capacity: true } },
    },
  });

  return NextResponse.json(
    serializeJson(
      resources.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        capacity: r.fungibleResource?.capacity ?? 1,
      })),
    ),
  );
}
