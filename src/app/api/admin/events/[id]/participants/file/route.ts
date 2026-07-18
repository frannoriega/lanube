import { requirePermission } from "@/lib/api-auth";
import { listEventParticipants } from "@/modules/events/db/participants";
import { collectUploadedFiles } from "@/modules/events/lib/form-files";
import { getStorage } from "@/lib/storage";
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
  const { id } = await params;
  const { error } = await requirePermission("events:manage");
  if (error) return error;

  const searchParams = new URL(request.url).searchParams;
  const target = searchParams.get("url");
  // "download=1" forces a save dialog; otherwise the browser renders inline (PDF/image preview).
  const asDownload = searchParams.get("download") === "1";
  if (!target) {
    return NextResponse.json({ message: "Falta el archivo" }, { status: 400 });
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

  const result = await getStorage().fetchPrivate(target);
  if (!result) {
    return NextResponse.json(
      { message: "Archivo no encontrado" },
      { status: 404 },
    );
  }

  // Encode the filename for the header (RFC 5987) to survive spaces/non-ASCII.
  const filename = encodeURIComponent(match.name);
  const disposition = asDownload ? "attachment" : "inline";
  return new Response(result.stream, {
    headers: {
      "Content-Type":
        match.type || result.contentType || "application/octet-stream",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
    },
  });
}
