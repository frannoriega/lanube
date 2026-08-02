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
