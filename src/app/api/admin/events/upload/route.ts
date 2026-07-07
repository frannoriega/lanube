import { requirePermission } from "@/lib/api-auth";
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

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await getStorage().upload({
      buffer,
      contentType: file.type,
      filename: file.name,
      prefix: "events",
    });
    return NextResponse.json({ url });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo subir la imagen";
    return NextResponse.json({ message }, { status: 500 });
  }
}
