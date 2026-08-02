import { requirePermission } from "@/lib/api-auth";
import { apiServerError } from "@/lib/api/response";
import { getStorage } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Uploads an event image through the active storage provider, returning its public URL. */
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
      { message: "Formato no admitido. Usá JPG, PNG, WebP, AVIF o GIF." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { message: "La imagen supera el tamaño máximo de 5 MB" },
      { status: 400 },
    );
  }

  // Group each event's images under its id (falls back to a shared bucket pre-creation).
  const eventId = new URL(request.url).searchParams.get("eventId")?.trim();

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await getStorage().upload({
      buffer,
      contentType: file.type,
      filename: file.name,
      folder: ["events", eventId || "misc"],
    });
    return NextResponse.json({ url });
  } catch (e) {
    return apiServerError("admin/events/upload POST", e, { eventId });
  }
}
