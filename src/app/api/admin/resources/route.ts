import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/db/adminReservations";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET: list all reservable spaces (for the admin event space picker).
export async function GET() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }
  if (!(await isAdminUser(session.userId))) {
    return NextResponse.json({ message: "Acceso denegado" }, { status: 403 });
  }

  const spaces = await prisma.space.findMany({
    where: { isReservable: true },
    orderBy: [{ displayOrder: "asc" }],
    select: {
      id: true,
      name: true,
      capacity: true,
    },
  });

  return NextResponse.json(
    spaces.map((s) => ({
      id: s.id,
      name: s.name,
      capacity: s.capacity,
    })),
  );
}
