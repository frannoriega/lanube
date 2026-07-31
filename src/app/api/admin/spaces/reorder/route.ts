import { requirePermission } from "@/lib/api-auth";
import { reorderSpaces } from "@/lib/db/spaces";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

/** Persists a new top-to-bottom ordering for spaces (drives the up/down controls). */
export async function POST(request: NextRequest) {
  const { error } = await requirePermission("spaces:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  try {
    await reorderSpaces(parsed.data.orderedIds);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "No se pudo reordenar los espacios" },
      { status: 400 },
    );
  }
}
