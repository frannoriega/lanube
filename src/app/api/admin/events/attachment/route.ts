import { requirePermission } from "@/lib/api-auth";
import { getStorage } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

// Assets embedded in an event's (public) markdown description: inline images + a "terms &
// conditions" style PDF. Stored public since the description is shown to everyone.
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "application/pdf",
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** Uploads a description attachment (image or PDF) and returns its public URL. */
export async function POST(request: NextRequest) {
  const { error } = await requirePermission("events:manage");
  if (error) return error;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: "No se recibió ningún archivo" },
      { status: 400 },
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { message: "Formato no admitido. Usá una imagen o un PDF." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { message: "El archivo supera el tamaño máximo de 10 MB" },
      { status: 400 },
    );
  }

  const eventId = new URL(request.url).searchParams.get("eventId")?.trim();

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await getStorage().upload({
      buffer,
      contentType: file.type,
      filename: file.name,
      folder: ["events", eventId || "misc", "description"],
    });
    return NextResponse.json({ url });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo subir el archivo";
    return NextResponse.json({ message }, { status: 500 });
  }
}
