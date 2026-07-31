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

/** Uploads a space image through the active storage provider, returning its public URL. */
export async function POST(request: NextRequest) {
  const { error } = await requirePermission("spaces:manage");
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

  // Group each space's images under its slug (falls back to a shared bucket pre-creation).
  const slug = new URL(request.url).searchParams.get("slug")?.trim();

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await getStorage().upload({
      buffer,
      contentType: file.type,
      filename: file.name,
      folder: ["spaces", slug || "misc"],
    });
    return NextResponse.json({ url });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo subir la imagen";
    return NextResponse.json({ message }, { status: 500 });
  }
}
