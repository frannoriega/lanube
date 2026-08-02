/**
 * Flattens a form's (possibly nested) answers into stable tabular columns for the admin
 * participants view + CSV export. One column per input leaf; a repeating group's children become a
 * single column whose cell joins the per-item values. Depth-1 groups (what the builder authors) are
 * fully supported; deeper nesting is ignored for columns (the raw answers remain in the DB).
 */

import { collectUploadedFiles } from "@/lib/events/form-files";
import {
  type FormSchema,
  isUploadedFile,
  type UploadedFile,
} from "@/lib/events/form-schema";

export interface ExportColumn {
  /** Dot path key ("fieldId" or "groupId.childId"). */
  key: string;
  label: string;
  path: string[];
}

/** Renders any answer value to a flat string. */
export function answerToString(value: unknown): string {
  if (value == null) return "";
  if (isUploadedFile(value)) return value.name;
  if (Array.isArray(value)) return value.map(answerToString).join(", ");
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Stable leaf columns for a schema (top-level inputs + one-level group children). */
export function exportColumns(schema: FormSchema): ExportColumn[] {
  const cols: ExportColumn[] = [];
  for (const node of schema.nodes) {
    if (node.kind === "input") {
      cols.push({ key: node.id, label: node.label, path: [node.id] });
    } else {
      const groupLabel = node.label ?? "Grupo";
      for (const child of node.children) {
        if (child.kind === "input") {
          cols.push({
            key: `${node.id}.${child.id}`,
            label: `${groupLabel} — ${child.label}`,
            path: [node.id, child.id],
          });
        }
      }
    }
  }
  return cols;
}

/** The cell value for a column, given a participant's answers. */
export function exportCell(
  col: ExportColumn,
  answers: Record<string, unknown>,
): string {
  if (col.path.length === 1) return answerToString(answers[col.path[0]]);

  const [groupId, childId] = col.path;
  const group = answers[groupId];
  if (Array.isArray(group)) {
    // Repeating group: join each item's child answer.
    return group
      .map((item) =>
        answerToString((item as Record<string, unknown> | null)?.[childId]),
      )
      .filter((s) => s !== "")
      .join(" | ");
  }
  if (group && typeof group === "object") {
    return answerToString((group as Record<string, unknown>)[childId]);
  }
  return "";
}

/** Uploaded files referenced by a column (across repeating-group items). Empty for non-FILE. */
export function cellFiles(
  col: ExportColumn,
  answers: Record<string, unknown>,
): UploadedFile[] {
  if (col.path.length === 1) return collectUploadedFiles(answers[col.path[0]]);

  const [groupId, childId] = col.path;
  const group = answers[groupId];
  if (Array.isArray(group)) {
    return group.flatMap((item) =>
      collectUploadedFiles((item as Record<string, unknown> | null)?.[childId]),
    );
  }
  if (group && typeof group === "object") {
    return collectUploadedFiles((group as Record<string, unknown>)[childId]);
  }
  return [];
}
