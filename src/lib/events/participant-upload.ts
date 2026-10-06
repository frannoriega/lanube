/**
 * Shared handler for participant (public, unauthenticated) file uploads. Both the submit
 * (`/api/forms/[slug]/upload`) and edit (`/api/forms/response/[token]/upload`) routes call this:
 * rate-limit (first, before any DB read) → resolve the FILE field → validate name/size → store it **privately** with a server-derived type →
 * return a **signed** UploadedFile descriptor for the client to place in the answer (milestone 25).
 *
 * Files are stored private (never publicly linkable); admins read them back through an
 * authenticated proxy (see /api/admin/events/[id]/participants/file).
 */

import { nowMs } from "@/lib/clock";
import {
  contentTypeForName,
  findFileNode,
  validateUploadMeta,
} from "@/lib/events/form-files";
import { signUploadedFile } from "@/lib/events/upload-signing";
import type { FormSchema, UploadedFile } from "@/lib/events/form-schema";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";
import { getStorage } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

/**
 * Límite por IP de las subidas públicas. Va **antes** de cualquier consulta (las rutas lo llaman
 * primero, antes de buscar el formulario o la inscripción): un pedido sin presupuesto no debe
 * costar ni una lectura de la base (milestone 25, DB8). Devuelve la respuesta de error, o `null`
 * si el pedido puede seguir.
 */
export async function participantUploadRateLimit(): Promise<NextResponse | null> {
  const ip = await getClientIp();
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
  return null;
}

/**
 * Guarda el archivo y devuelve el descriptor **firmado para `eventId`** (milestone 25, S2). El
 * tipo MIME lo decide el servidor por la extensión (S1); el que manda el navegador se ignora.
 * Quien llama ya aplicó {@link participantUploadRateLimit}.
 */
export async function handleParticipantUpload(
  request: NextRequest,
  schema: FormSchema,
  folder: string[],
  eventId: string,
): Promise<NextResponse> {
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
    const contentType = contentTypeForName(file.name);
    const { url } = await getStorage().upload({
      buffer,
      contentType,
      filename: file.name,
      folder,
      access: "private",
    });
    const descriptor: UploadedFile = signUploadedFile(
      { url, name: file.name, size: file.size, type: contentType },
      eventId,
    );
    return NextResponse.json(descriptor, { status: 201 });
  } catch (e) {
    // Loguear la falla real y devolver un mensaje controlado. Devolver `e.message` acá
    // filtraba internals del proveedor de storage a un llamador sin autenticar, en contra del
    // contrato de src/lib/api/response.ts (milestone-12, Parte 4).
    logger.error("participant upload failed", e, { folder: folder.join("/") });
    return NextResponse.json(
      { message: "No se pudo subir el archivo" },
      { status: 500 },
    );
  }
}
