import { PUBLIC_TAGS, revalidatePublic } from "@/lib/cache/public-reads";
import { requirePermission } from "@/lib/api-auth";
import { reorderSpaces } from "@/lib/db/spaces";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { emitAudit } from "@/lib/audit/emit";
import { snapshotOrder } from "@/lib/db/auditOrder";

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

/** Persists a new top-to-bottom ordering for spaces (drives the up/down controls). */
export async function POST(request: NextRequest) {
  const { error, session } = await requirePermission("spaces:manage");
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
    // Fotos con nombre antes y después: la auditoría muestra qué se movió y adónde, no
    // una lista de ids (ver `src/lib/db/auditOrder.ts`).
    const before = await snapshotOrder("Space");
    await reorderSpaces(parsed.data.orderedIds);
    const after = await snapshotOrder("Space");
    await emitAudit(session, AUDIT_ACTIONS.spaceReorder, {
      // Not a single space: the entity is the ordering itself.
      entityId: "*",
      before: { order: before },
      after: { order: after },
    });
    // Invalida la caché pública: el sitio público muestra los espacios, y las tarjetas de eventos su nombre (milestone 25, P2).
    revalidatePublic(PUBLIC_TAGS.spaces);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "No se pudo reordenar los espacios" },
      { status: 400 },
    );
  }
}
