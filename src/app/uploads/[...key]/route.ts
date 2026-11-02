import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { PUBLIC_ROOT } from "@/lib/storage/local";
import { isCanonicalKey } from "@/lib/storage/types";

/**
 * Sirve las imágenes públicas del proveedor de almacenamiento `local` (VPS).
 *
 * En Vercel no se usa (las URLs son de Blob). En desarrollo, `public/uploads` ya lo sirve Next
 * como estático, que tiene prioridad sobre esta ruta. En un VPS `next start` no sirve de forma
 * fiable lo que aparece en `public/` después del build, y el optimizador de `next/image` pide
 * `/uploads/…` a esta misma app, así que tiene que existir como ruta.
 *
 * Solo imágenes ráster por extensión (nunca SVG/HTML): el tipo lo decide el servidor, no el
 * archivo ni el cliente. Las claves llevan un cuid, así que el contenido es inmutable.
 */
const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  const key = segments.join("/");
  const contentType = IMAGE_TYPES[path.extname(key).slice(1).toLowerCase()];
  if (!contentType || !isCanonicalKey(key)) {
    return new NextResponse("Not found", { status: 404 });
  }
  // Defensa en profundidad: la ruta resuelta tiene que seguir adentro de la raíz.
  const abs = path.resolve(PUBLIC_ROOT, key);
  if (!abs.startsWith(PUBLIC_ROOT + path.sep)) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const info = await stat(abs);
    if (!info.isFile()) throw new Error("not a file");
    return new NextResponse(
      Readable.toWeb(createReadStream(abs)) as ReadableStream<Uint8Array>,
      {
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(info.size),
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      },
    );
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
