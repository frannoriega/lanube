import { requirePermission } from "@/lib/api-auth";
import { getStorage } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

// The document a BOOLEAN "acknowledgement" field links to (e.g. terms & conditions). Public,
// since it's shown to every participant filling out the form.
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** Uploads a form attachment (e.g. a terms-and-conditions PDF) and returns its public URL. */
export async function POST(request: NextRequest) {
  const { error } = await requirePermission("forms:manage");
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
      { message: "Formato no admitido. Usá un PDF o una imagen." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { message: "El archivo supera el tamaño máximo de 10 MB" },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await getStorage().upload({
      buffer,
      contentType: file.type,
      filename: file.name,
      folder: ["forms", "attachments"],
    });
    return NextResponse.json({ url, name: file.name });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo subir el archivo";
    return NextResponse.json({ message }, { status: 500 });
  }
}
