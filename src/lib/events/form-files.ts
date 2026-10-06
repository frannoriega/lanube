/**
 * Server-side helpers for participant file uploads (the FILE field type). Shared by the public
 * upload endpoints (submit + edit) so a file is validated against its field's constraints *before*
 * it's stored, and by nothing else. Answers are re-validated on submit by the form engine.
 */

import { extensionAllowed } from "@/lib/events/form-engine";
import {
  type FormNode,
  type FormSchema,
  type InputNode,
  isGroupNode,
  isUploadedFile,
  type UploadedFile,
} from "@/lib/events/form-schema";

/** Absolute ceiling for any participant upload, regardless of a field's own (lower) cap. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/** Finds the FILE input node with the given id anywhere in the tree (groups included). */
export function findFileNode(
  schema: FormSchema,
  fieldId: string,
): InputNode | null {
  const walk = (nodes: FormNode[]): InputNode | null => {
    for (const node of nodes) {
      if (isGroupNode(node)) {
        const hit = walk(node.children);
        if (hit) return hit;
      } else if (node.id === fieldId && node.type === "FILE") {
        return node;
      }
    }
    return null;
  };
  return walk(schema.nodes);
}

/** Validates an upload's metadata against a FILE node's constraints. Returns an error, or null. */
export function validateUploadMeta(
  node: InputNode,
  meta: { name: string; size: number },
): string | null {
  if (meta.size > MAX_UPLOAD_BYTES) {
    return "El archivo supera el tamaño máximo de 10 MB";
  }
  const cap = node.constraints?.maxSizeMb;
  if (typeof cap === "number" && meta.size > cap * 1024 * 1024) {
    return `Cada archivo debe pesar menos de ${cap} MB`;
  }
  if (!extensionAllowed(meta.name, node.constraints?.accept)) {
    return `Formato no permitido (${(node.constraints?.accept ?? []).join(", ")})`;
  }
  return null;
}

/**
 * Tipo MIME de un archivo de participante, decidido por el servidor a partir de la extensión
 * (milestone 25, S1). Nunca se usa el tipo que declara el navegador: lo elige quien sube, y el
 * proxy de admin lo servía tal cual en el origen de la app — un `cv.pdf` declarado `text/html`
 * corría su script con la sesión del admin. Lo que no está en la lista es binario opaco.
 */
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  zip: "application/zip",
};

export const OPAQUE_CONTENT_TYPE = "application/octet-stream";

export function contentTypeForName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  return CONTENT_TYPE_BY_EXTENSION[ext] ?? OPAQUE_CONTENT_TYPE;
}

/**
 * Tipos que el proxy de admin puede mostrar en el navegador (vista previa). Ninguno ejecuta
 * código: PDF e imágenes rasterizadas. SVG queda afuera a propósito (es un documento con
 * `<script>`), igual que todo `text/*`. Lo demás se descarga siempre.
 */
const INLINE_SAFE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export function isInlineSafe(contentType: string): boolean {
  return INLINE_SAFE_TYPES.has(contentType);
}

/**
 * Recorre una respuesta (arrays y grupos) y reemplaza cada descriptor de archivo por lo que
 * devuelve `fn`; si `fn` devuelve `null` para alguno, el resultado entero es `null` (la
 * respuesta tiene un archivo que no se acepta). Lo usa el envío/edición para cambiar cada
 * descriptor del cliente por uno verificado (milestone 25, S2).
 */
export function mapUploadedFiles(
  value: unknown,
  fn: (file: UploadedFile) => UploadedFile | null,
): unknown | null {
  let rejected = false;
  const walk = (v: unknown): unknown => {
    if (rejected) return v;
    if (isUploadedFile(v)) {
      const next = fn(v);
      if (!next) rejected = true;
      return next;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v).map(([k, child]) => [k, walk(child)]),
      );
    }
    return v;
  };
  const out = walk(value);
  return rejected ? null : out;
}

/** Collects every uploaded-file descriptor anywhere in an answers value (arrays + groups). */
export function collectUploadedFiles(value: unknown): UploadedFile[] {
  const out: UploadedFile[] = [];
  const walk = (v: unknown) => {
    if (isUploadedFile(v)) {
      out.push(v);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return out;
}
