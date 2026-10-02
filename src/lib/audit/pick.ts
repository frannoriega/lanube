/**
 * Decide qué guarda una entrada de auditoría a partir de dos fotos completas de un registro
 * (milestone 16). Lo usa `beginAudit(...).commit(...)` (`emit.ts`); vive aparte, puro, para
 * poder testearlo sin base de datos.
 *
 * La regla: la ruta no elige campos — saca una foto antes y otra después, y el registro
 * (`registry.ts`) dice cuáles se auditan. Según el `kind` del evento:
 * - `create`: solo "después", sin vacíos (un alta no "cambia" de vacío a vacío).
 * - `update`: solo los campos que cambiaron, en los dos lados; `null` si nada cambió.
 * - `delete`: solo "antes", sin vacíos.
 */
import { isEmptyValue, type FieldSpecs } from "./fields";
import type { AuditEventKind } from "./registry";

type Snapshot = Record<string, unknown>;

/**
 * Lleva un valor a algo que se pueda comparar y guardar como JSON: `bigint` → número (los
 * timestamps en ms entran holgados en un double), `Date` → ms, recursivo en listas y objetos.
 */
export function normalizeAuditValue(v: unknown): unknown {
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Date) return v.getTime();
  if (Array.isArray(v)) return v.map(normalizeAuditValue);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, normalizeAuditValue(x)]),
    );
  }
  return v;
}

/** Vacíos equivalentes (`null`, `""`, `[]`) cuentan como iguales: no es un cambio real. */
function sameValue(a: unknown, b: unknown, orderless: boolean): boolean {
  if (isEmptyValue(a) && isEmptyValue(b)) return true;
  if (orderless && Array.isArray(a) && Array.isArray(b)) {
    const key = (x: unknown) => JSON.stringify(x);
    return (
      a.length === b.length &&
      [...a].map(key).sort().join("\u0000") ===
        [...b].map(key).sort().join("\u0000")
    );
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function nonEmpty(specs: FieldSpecs, snap: Snapshot): Snapshot {
  const out: Snapshot = {};
  for (const key of Object.keys(specs)) {
    const v = normalizeAuditValue(snap[key]);
    if (!isEmptyValue(v)) out[key] = v;
  }
  return out;
}

/**
 * Los lados `before`/`after` a guardar, filtrados por los campos registrados. Devuelve
 * `null` cuando no hay nada que registrar (una edición que no cambió ningún campo auditado).
 */
export function pickAuditSides(
  kind: Exclude<AuditEventKind, "custom">,
  specs: FieldSpecs,
  before: Snapshot | null,
  after: Snapshot | null,
): { before: Snapshot | null; after: Snapshot | null } | null {
  if (kind === "create") {
    return { before: null, after: after ? nonEmpty(specs, after) : null };
  }
  if (kind === "delete") {
    return { before: before ? nonEmpty(specs, before) : null, after: null };
  }
  const b: Snapshot = {};
  const a: Snapshot = {};
  let changed = false;
  for (const [key, spec] of Object.entries(specs)) {
    const bv = normalizeAuditValue(before?.[key]);
    const av = normalizeAuditValue(after?.[key]);
    if (sameValue(bv, av, spec.kind === "set")) continue;
    changed = true;
    b[key] = bv ?? null;
    a[key] = av ?? null;
  }
  return changed ? { before: b, after: a } : null;
}
