import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError } from "@/lib/api/response";
import { getWalkInUploadTarget } from "@/lib/db/event-checkin";
import { handleParticipantUpload } from "@/lib/events/participant-upload";
import { NextRequest } from "next/server";

/**
 * Sube un archivo de un campo FILE mientras se registra a alguien sin inscripción (milestone
 * 30). Es la misma subida que la del formulario público (mismo prefijo, misma firma atada al
 * evento), así `registerWalkIn` la verifica igual que una inscripción. Detrás de
 * `events:checkin`, sin el límite por IP de la ruta pública.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("events:checkin");
  if (error) return error;
  try {
    const { id } = await params;
    const target = await getWalkInUploadTarget(id);
    if (!target) return apiError("El evento no tiene formulario", 409);
    return handleParticipantUpload(
      request,
      target.schema,
      ["events", "participant-uploads", target.slug],
      id,
    );
  } catch (e) {
    return apiCatch("admin/events/[id]/checkin/upload POST", e);
  }
}
