import { apiCatch } from "@/lib/api/response";
import { requirePermission } from "@/lib/api-auth";
import { listEventParticipants } from "@/lib/db/participants";
import {
  collectUploadedFiles,
  contentTypeForName,
  isInlineSafe,
} from "@/lib/events/form-files";
import { getStorage } from "@/lib/storage";
import { participantUploadsPrefix } from "@/lib/storage/types";
import { NextRequest, NextResponse } from "next/server";

/**
 * Streams a participant-uploaded (private) file to an authorized admin. The requested `url` must
 * actually belong to a participant of this event — this both authorizes the read and prevents the
 * route from being used to fetch arbitrary blobs.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { error } = await requirePermission("events:manage");
    if (error) return error;

    const searchParams = new URL(request.url).searchParams;
    const target = searchParams.get("url");
    // "download=1" forces a save dialog; otherwise the browser renders inline (PDF/image preview).
    const asDownload = searchParams.get("download") === "1";
    if (!target) {
      return NextResponse.json(
        { message: "Falta el archivo" },
        { status: 400 },
      );
    }

    const participants = await listEventParticipants(id);
    const match = participants
      .flatMap((p) => collectUploadedFiles(p.answers))
      .find((f) => f.url === target);
    if (!match) {
      return NextResponse.json(
        { message: "Archivo no encontrado" },
        { status: 404 },
      );
    }

    // La URL viene de una respuesta de participante (entrada de un desconocido): además de estar
    // en este evento, tiene que ser una clave canónica bajo la carpeta de subidas de
    // participantes de este entorno (milestone 25, S2).
    const storage = getStorage();
    const key = storage.privateKeyOf(target);
    if (!key || !key.startsWith(participantUploadsPrefix())) {
      return NextResponse.json(
        { message: "Archivo no encontrado" },
        { status: 404 },
      );
    }

    const result = await storage.fetchPrivate(target);
    if (!result) {
      return NextResponse.json(
        { message: "Archivo no encontrado" },
        { status: 404 },
      );
    }

    // El tipo se deriva del nombre, nunca de `match.type` ni del guardado en el storage: los dos
    // los eligió quien subió el archivo. Servir su `text/html` inline en nuestro origen era un XSS
    // almacenado contra el admin (milestone 25, S1). Solo PDF e imágenes rasterizadas se muestran
    // en el navegador; todo lo demás se descarga.
    const contentType = contentTypeForName(match.name);
    const inline = !asDownload && isInlineSafe(contentType);
    // Encode the filename for the header (RFC 5987) to survive spaces/non-ASCII.
    const filename = encodeURIComponent(match.name);
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };
    // Cinturón y tiradores: lo que no es PDF corre en un origen opaco sin scripts. El PDF queda
    // afuera porque el visor de Chrome no abre documentos con `sandbox`. `img-src 'self'`: el
    // navegador muestra una imagen suelta dentro de un documento sintético al que también se le
    // aplica esta CSP; sin eso la vista previa saldría rota.
    if (contentType !== "application/pdf") {
      headers["Content-Security-Policy"] =
        "sandbox; default-src 'none'; img-src 'self'";
    }
    return new Response(result.stream, { headers });
  } catch (err) {
    return apiCatch("admin/events/[id]/participants/file GET", err);
  }
}
