/**
 * Shared handler for participant (public, unauthenticated) file uploads. Both the submit
 * (`/api/forms/[slug]/upload`) and edit (`/api/forms/response/[token]/upload`) routes call this:
 * rate-limit → resolve the FILE field → validate the file's metadata → store it **privately** →
 * return an UploadedFile descriptor for the client to place in the answer.
 *
 * Files are stored private (never publicly linkable); admins read them back through an
 * authenticated proxy (see /api/admin/events/[id]/participants/file).
 */

import { nowMs } from "@/lib/clock";
import { findFileNode, validateUploadMeta } from "@/modules/events/lib/form-files";
import type { FormSchema, UploadedFile } from "@/modules/events/lib/form-schema";
import { checkRateLimit } from "@/lib/ratelimit";
import { getStorage } from "@/lib/storage";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

async function getIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    (process.env.NODE_ENV === "development"
      ? (h.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1")
      : null)
  );
}

export async function handleParticipantUpload(
  request: NextRequest,
  schema: FormSchema,
  folder: string[],
): Promise<NextResponse> {
  const ip = await getIp();
  if (!ip) {
    return NextResponse.json({ message: "IP no encontrada" }, { status: 400 });
  }
  const { allowed, resetAt } = await checkRateLimit(ip, "/api/forms/upload", {
    maxAttempts: 12,
    windowMs: 60_000,
    blockDurationMs: 300_000,
  });
  if (!allowed) {
    return NextResponse.json(
      {
        message: `Demasiadas solicitudes. Intentá nuevamente en ${Math.ceil(
          (resetAt.getTime() - nowMs()) / 1000,
        )} segundos`,
      },
      { status: 429 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const fieldId = String(formData?.get("fieldId") ?? "");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: "No se recibió ningún archivo" },
      { status: 400 },
    );
  }

  const node = findFileNode(schema, fieldId);
  if (!node) {
    return NextResponse.json(
      { message: "Campo de archivo inválido" },
      { status: 400 },
    );
  }

  const error = validateUploadMeta(node, {
    name: file.name,
    size: file.size,
  });
  if (error) {
    return NextResponse.json({ message: error }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await getStorage().upload({
      buffer,
      contentType: file.type || "application/octet-stream",
      filename: file.name,
      folder,
      access: "private",
    });
    const descriptor: UploadedFile = {
      url,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
    };
    return NextResponse.json(descriptor, { status: 201 });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo subir el archivo";
    return NextResponse.json({ message }, { status: 500 });
  }
}
