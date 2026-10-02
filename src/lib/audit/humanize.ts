/**
 * Convierte una entrada cruda de auditoría (id de acción + JSON before/after) en algo que una
 * persona no técnica pueda seguir: un chip de subsistema, un chip de verbo, una oración de
 * resumen y, en el panel de detalle, un diff por campo con el formato adecuado a cada tipo.
 * El JSON crudo sigue disponible en "Información del sistema"
 * (`src/components/organisms/admin/audit-log-table.tsx`); este módulo es solo la capa legible.
 *
 * Desde el milestone 16 los textos y los tipos de campo salen del registro
 * (`registry.ts`): cómo se llama cada campo y cómo se muestra (fecha, sí/no, markdown,
 * imagen, lista…) lo declara la entidad, no se adivina del valor. Para entradas viejas, o
 * campos que el registro no conoce, quedan las tablas `LEGACY_*` de abajo como respaldo.
 *
 * Puro y seguro para el cliente: la tabla de auditoría es un componente cliente para que
 * cada fila abra su detalle sin ida y vuelta al servidor.
 */

import {
  formatFieldValue,
  isEmptyValue,
  type FieldSpec,
  type FieldSpecs,
} from "@/lib/audit/fields";
import {
  AUDIT_ENTITIES,
  auditEntityDef,
  auditEventDef,
  auditFieldSpecs,
} from "@/lib/audit/registry";
import { diffText, type TextDiffLine } from "@/lib/audit/text-diff";
import { PERMISSION_LABELS } from "@/lib/rbac";

/** Chip del subsistema (primera etiqueta de cada fila). */
export function entityTypeLabel(entityType: string): string {
  return auditEntityDef(entityType)?.label ?? entityType;
}

/** Chip corto del verbo (segunda etiqueta de cada fila). */
export function actionVerbTag(action: string): string {
  return auditEventDef(action)?.verb ?? "Acción";
}

/** Texto que se muestra para un valor vacío. */
export const EMPTY_VALUE = "(vacío)";

// ---------------------------------------------------------------------------
// Respaldo para entradas viejas: campos y valores que el registro no describe
// ---------------------------------------------------------------------------

/** Rótulos de campos que aparecen en entradas escritas antes del registro. */
const LEGACY_FIELD_LABELS: Record<string, string> = {
  displayOrder: "Orden",
  featuredOrder: "Orden destacado",
  orderedIds: "Orden",
  priority: "Prioridad",
  startDate: "Fecha de inicio",
  endDate: "Fecha de fin",
};

/** Códigos del sistema traducidos, para valores sin campo registrado. */
const LEGACY_VALUE_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_REVIEW: "Pendiente de revisión",
  PUBLISHED: "Publicado",
  REJECTED: "Rechazado",
  PAUSED: "Pausado",
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  CANCELLED: "Cancelado",
  EDIT: "Editar",
  PAUSE: "Pausar",
  DELETE: "Eliminar",
  approve: "Aprobar",
  reject: "Rechazar",
};

/** Traducción de los elementos de una lista sin campo registrado. */
const LEGACY_LIST_ITEM_LABELS: Record<string, Record<string, string>> = {
  permissions: PERMISSION_LABELS,
};

/**
 * Último recurso para el rótulo de un campo sin spec: el primero que use esa clave en
 * cualquier entidad del registro ("name" → "Nombre").
 */
const ANY_ENTITY_FIELD_LABELS: Record<string, string> = Object.values(
  AUDIT_ENTITIES as Record<string, { fields: FieldSpecs }>,
).reduce<Record<string, string>>((acc, e) => {
  for (const [k, s] of Object.entries(e.fields)) acc[k] ??= s.label;
  return acc;
}, {});

function fieldLabel(key: string, spec: FieldSpec | undefined): string {
  return (
    spec?.label ??
    LEGACY_FIELD_LABELS[key] ??
    ANY_ENTITY_FIELD_LABELS[key] ??
    key
  );
}

function formatValue(spec: FieldSpec | undefined, v: unknown): string {
  if (spec) return formatFieldValue(spec, v);
  if (isEmptyValue(v)) return EMPTY_VALUE;
  if (typeof v === "string") return LEGACY_VALUE_LABELS[v] ?? v;
  if (Array.isArray(v))
    return v.map((x) => formatValue(undefined, x)).join(", ");
  return formatFieldValue(undefined, v);
}

// ---------------------------------------------------------------------------
// Tipos de cambio
// ---------------------------------------------------------------------------

/** Un elemento de una lista reordenable, tal como lo guardan las fotos de `snapshotOrder`. */
export interface OrderEntry {
  id: string;
  name: string;
}

/**
 * Una fila del diff de un reordenamiento: dónde estaba (`from`) y dónde quedó (`to`), ambas
 * posiciones 1-based. `from` es `null` si no hay foto anterior (entradas viejas) o si el
 * elemento entró a la lista; `to` es `null` si salió de ella.
 */
export interface OrderRow {
  id: string;
  name: string;
  from: number | null;
  to: number | null;
}

/** Un elemento de una lista de registros (`items`): qué le pasó y, si cambió, qué. */
export interface ItemRow {
  key: string;
  name: string;
  status: "added" | "removed" | "changed";
  /** Los campos que cambiaron dentro del elemento (solo `changed`). */
  changes: FieldChange[];
}

/**
 * Un cambio legible. Cada forma tiene su propio diff en el panel:
 * - `value`: un valor reemplaza a otro (línea roja tachada + línea verde, estilo git).
 * - `text`: un texto largo — diff por líneas con las palabras cambiadas resaltadas.
 * - `image`: miniaturas de la imagen anterior y la nueva.
 * - `set`: lista sin orden — solo lo agregado y lo quitado.
 * - `items`: lista de registros — qué se agregó, quitó o cambió (y qué dentro de cada uno).
 * - `order`: un reordenamiento — la lista final con cuánto subió o bajó cada elemento.
 */
export type FieldChange =
  | { kind: "value"; key: string; label: string; before: string; after: string }
  | {
      kind: "text";
      key: string;
      label: string;
      lines: TextDiffLine[];
      /** `true` si un lado está vacío: el texto se muestra entero, sin diff. */
      wholesale: boolean;
    }
  | {
      kind: "image";
      key: string;
      label: string;
      before: string | null;
      after: string | null;
    }
  | {
      kind: "set";
      key: string;
      label: string;
      added: string[];
      removed: string[];
    }
  | {
      kind: "items";
      key: string;
      label: string;
      rows: ItemRow[];
      /** Cuántos elementos quedaron igual (no se listan). */
      unchanged: number;
    }
  | {
      kind: "order";
      key: string;
      label: string;
      rows: OrderRow[];
      /** `false` en entradas escritas antes de guardar el orden anterior. */
      hasBefore: boolean;
    };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Campos que son ids del sistema (`roleId`, `participantIds`): no se muestran en la capa
 * legible — quien registra la entrada guarda al lado el equivalente con nombre (`role`), y
 * el id crudo sigue disponible en "Información del sistema". `orderedIds` es la excepción:
 * es el formato viejo de los reordenamientos y se traduce a nombres (ver `readOrder`).
 */
function isSystemIdKey(key: string): boolean {
  return key !== "orderedIds" && /Ids?$/.test(key);
}

/**
 * Lee una lista ordenada de cualquiera de los dos formatos: el nuevo
 * (`order: [{ id, name }]`, con el nombre de ese momento) o el viejo (`orderedIds: [id]`,
 * con nombres resueltos al leer — `names`, ver `resolveOrderNames`).
 */
function readOrder(
  value: unknown,
  names: Record<string, string> | undefined,
): OrderEntry[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((v) => {
    if (v && typeof v === "object") {
      const e = v as Partial<OrderEntry>;
      return { id: String(e.id ?? ""), name: String(e.name ?? "(sin nombre)") };
    }
    const id = String(v);
    return { id, name: names?.[id] ?? "(eliminado)" };
  });
}

/** Diff de posiciones: la lista final arriba, y al final lo que salió de la lista. */
function buildOrderRows(
  before: OrderEntry[] | null,
  after: OrderEntry[],
): OrderRow[] {
  const prevPos = new Map(before?.map((e, i) => [e.id, i + 1]) ?? []);
  const nextIds = new Set(after.map((e) => e.id));
  const rows: OrderRow[] = after.map((e, i) => ({
    id: e.id,
    name: e.name,
    from: prevPos.get(e.id) ?? null,
    to: i + 1,
  }));
  for (const [i, e] of (before ?? []).entries()) {
    if (!nextIds.has(e.id))
      rows.push({ id: e.id, name: e.name, from: i + 1, to: null });
  }
  return rows;
}

function buildSetChange(
  key: string,
  spec: FieldSpec | undefined,
  bv: unknown[],
  av: unknown[],
): FieldChange {
  const labels =
    spec?.kind === "set" ? spec.items : LEGACY_LIST_ITEM_LABELS[key];
  const fmt = (x: unknown) =>
    typeof x === "string" && labels?.[x]
      ? labels[x]
      : formatValue(undefined, x);
  const prev = new Set(bv.map((x) => JSON.stringify(x)));
  const next = new Set(av.map((x) => JSON.stringify(x)));
  return {
    kind: "set",
    key,
    label: fieldLabel(key, spec),
    added: av.filter((x) => !prev.has(JSON.stringify(x))).map(fmt),
    removed: bv.filter((x) => !next.has(JSON.stringify(x))).map(fmt),
  };
}

/**
 * Diff de una lista de registros. La identidad de cada elemento es su `id` (los campos de
 * un formulario lo tienen y sobrevive a las ediciones) o, si no tiene, su nombre (las
 * preguntas frecuentes de un espacio).
 */
function buildItemsChange(
  key: string,
  spec: Extract<FieldSpec, { kind: "items" }>,
  bv: unknown[],
  av: unknown[],
): FieldChange {
  const identity = (x: unknown) => {
    const r = asRecord(x);
    return String(r.id ?? r[spec.nameKey] ?? JSON.stringify(x));
  };
  const nameOf = (x: unknown) =>
    String(asRecord(x)[spec.nameKey] ?? "(sin nombre)");
  const prev = new Map(bv.map((x) => [identity(x), x]));
  const next = new Map(av.map((x) => [identity(x), x]));
  const rows: ItemRow[] = [];
  let unchanged = 0;
  for (const [k, item] of next) {
    const old = prev.get(k);
    if (old === undefined) {
      rows.push({ key: k, name: nameOf(item), status: "added", changes: [] });
      continue;
    }
    const changes = buildFieldChanges(old, item, undefined, spec.itemFields);
    if (changes.length === 0) unchanged++;
    else rows.push({ key: k, name: nameOf(item), status: "changed", changes });
  }
  for (const [k, item] of prev) {
    if (!next.has(k))
      rows.push({ key: k, name: nameOf(item), status: "removed", changes: [] });
  }
  return { kind: "items", key, label: spec.label, rows, unchanged };
}

/**
 * Solo los campos que realmente cambiaron, siempre como texto legible (nunca JSON ni ids).
 * `names` resuelve los ids de los reordenamientos viejos (ver `AuditLogListItem.names`);
 * `specs` son los campos registrados de la entrada (ver `entryFieldChanges`) — sin ellos se
 * usa el respaldo para entradas viejas. El orden de los cambios sigue el de `specs`.
 */
export function buildFieldChanges(
  before: unknown,
  after: unknown,
  names?: Record<string, string>,
  specs?: FieldSpecs,
): FieldChange[] {
  const b = asRecord(before);
  const a = asRecord(after);
  const present = new Set([...Object.keys(b), ...Object.keys(a)]);
  const keys = [
    ...Object.keys(specs ?? {}).filter((k) => present.has(k)),
    ...[...present].filter((k) => !specs || !(k in specs)),
  ];
  const changes: FieldChange[] = [];
  for (const key of keys) {
    if (isSystemIdKey(key)) continue;
    const spec = specs?.[key];
    const bv = b[key];
    const av = a[key];
    const label = fieldLabel(key, spec);

    if (spec?.kind === "order" || key === "order" || key === "orderedIds") {
      const next = readOrder(av, names);
      if (!next) continue;
      const prev = readOrder(bv, names);
      changes.push({
        kind: "order",
        key,
        label,
        rows: buildOrderRows(prev, next),
        hasBefore: prev !== null,
      });
      continue;
    }

    if (JSON.stringify(bv) === JSON.stringify(av)) continue;
    if (isEmptyValue(bv) && isEmptyValue(av)) continue;

    if (spec?.kind === "longText") {
      const bs = isEmptyValue(bv) ? "" : String(bv);
      const as = isEmptyValue(av) ? "" : String(av);
      changes.push({
        kind: "text",
        key,
        label,
        lines: diffText(bs, as),
        wholesale: bs === "" || as === "",
      });
      continue;
    }

    if (spec?.kind === "image") {
      changes.push({
        kind: "image",
        key,
        label,
        before: isEmptyValue(bv) ? null : String(bv),
        after: isEmptyValue(av) ? null : String(av),
      });
      continue;
    }

    const isList = (v: unknown) =>
      v === undefined || v === null || Array.isArray(v);
    if (spec?.kind === "items" && isList(bv) && isList(av)) {
      const change = buildItemsChange(
        key,
        spec,
        (bv as unknown[] | null) ?? [],
        (av as unknown[] | null) ?? [],
      );
      if (change.kind === "items" && change.rows.length === 0) continue;
      changes.push(change);
      continue;
    }

    // Una lista de valores simples (permisos, días) se compara como conjunto.
    if ((Array.isArray(bv) || Array.isArray(av)) && isList(bv) && isList(av)) {
      const change = buildSetChange(
        key,
        spec,
        (bv as unknown[] | null) ?? [],
        (av as unknown[] | null) ?? [],
      );
      // Mismo contenido en otro orden: para un conjunto no es un cambio.
      if (
        change.kind === "set" &&
        change.added.length + change.removed.length === 0
      )
        continue;
      changes.push(change);
      continue;
    }

    changes.push({
      kind: "value",
      key,
      label,
      before: formatValue(spec, bv),
      after: formatValue(spec, av),
    });
  }
  return changes;
}

/** "3º" — posición ordinal en castellano. */
export function ordinal(n: number): string {
  return `${n}º`;
}

/** Nombre aproximado del registro, entre comillas; si no hay, un id corto. */
export function entityDisplayLabel(
  before: unknown,
  after: unknown,
  entityId: string,
): string {
  const src = { ...asRecord(before), ...asRecord(after) };
  const name = src.name ?? src.title ?? src.key;
  if (typeof name === "string" && name.trim()) return `"${name.trim()}"`;
  return `#${entityId.slice(0, 8)}`;
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

export interface SummarizableEntry {
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  /** Datos rótulo→valor que identifican el registro — ver AuditLog.context. */
  context?: Record<string, string> | null;
  /** Nombres de los ids de un reordenamiento viejo — ver `AuditLogListItem.names`. */
  names?: Record<string, string> | null;
}

/** Los cambios legibles de una entrada, con los campos que declara el registro. */
export function entryFieldChanges(entry: SummarizableEntry): FieldChange[] {
  return buildFieldChanges(
    entry.before,
    entry.after,
    entry.names ?? undefined,
    auditFieldSpecs(entry.action, entry.entityType),
  );
}

/**
 * La mitad "identidad" del resumen — **cuál** registro. Prefiere el `context` que guardó la
 * ruta (siempre presente, cambie lo que cambie); para entradas viejas o tipos sin contexto,
 * busca un nombre/título/clave en before/after.
 *
 * Devuelve `null` para las entradas sobre una colección entera (`entityId: "*"`, los
 * reordenamientos): no hay un registro que nombrar, y el viejo fallback mostraba "#*".
 */
export function entitySubject(entry: SummarizableEntry): string | null {
  if (entry.context && Object.keys(entry.context).length > 0) {
    return Object.values(entry.context).join(", ");
  }
  if (entry.entityId === "*") return null;
  return entityDisplayLabel(entry.before, entry.after, entry.entityId);
}

const MAX_PREVIEW = 2;

/** "y N más" cuando la vista previa recorta. */
function moreSuffix(total: number): string {
  const rest = total - MAX_PREVIEW;
  return rest > 0 ? ` y ${rest} más` : "";
}

/** Un cambio en una línea, para el resumen de la tabla. */
function previewChange(c: FieldChange): string {
  const label = c.label.toLowerCase();
  switch (c.kind) {
    case "value":
      // Un alta no "cambia" desde vacío: se muestra solo el valor nuevo.
      if (c.before === EMPTY_VALUE) return `${label}: ${c.after}`;
      return `${label}: ${c.before} → ${c.after}`;
    case "text":
      return c.wholesale ? label : `${label} modificada`;
    case "image":
      return c.after === null
        ? `${label} quitada`
        : c.before === null
          ? label
          : `${label} nueva`;
    case "set": {
      const parts = [
        ...c.added.map((x) => `+${x}`),
        ...c.removed.map((x) => `−${x}`),
      ];
      return `${label}: ${parts.slice(0, MAX_PREVIEW).join(", ")}${moreSuffix(parts.length)}`;
    }
    case "items": {
      const count = (s: ItemRow["status"]) =>
        c.rows.filter((r) => r.status === s).length;
      const parts = [
        count("added") ? `${count("added")} agregada(s)` : null,
        count("removed") ? `${count("removed")} quitada(s)` : null,
        count("changed") ? `${count("changed")} modificada(s)` : null,
      ].filter(Boolean);
      return `${label}: ${parts.join(", ")}`;
    }
    case "order": {
      if (!c.hasBefore) {
        const names = c.rows.map((r) => r.name);
        return `nuevo orden: ${names.slice(0, MAX_PREVIEW).join(", ")}${moreSuffix(names.length)}`;
      }
      const moved = c.rows.filter((r) => r.from !== r.to);
      if (moved.length === 0) return "sin cambios en el orden";
      return (
        moved
          .slice(0, MAX_PREVIEW)
          .map((r) =>
            r.to === null
              ? `${r.name}: salió de la lista`
              : r.from === null
                ? `${r.name}: entró en ${ordinal(r.to)}`
                : `${r.name}: ${ordinal(r.from)} → ${ordinal(r.to)}`,
          )
          .join(", ") + moreSuffix(moved.length)
      );
    }
  }
}

/** Una oración que describe la entrada — la columna "Resumen" de la tabla. */
export function buildChangeSummary(entry: SummarizableEntry): string {
  const def = auditEventDef(entry.action);
  const phrase =
    auditEntityDef(entry.entityType)?.phrase ?? `de ${entry.entityType}`;
  const verb = actionVerbTag(entry.action);

  const subject = entitySubject(entry);
  // Sin registro puntual (reordenamientos) la etiqueta de la acción ya es una oración
  // completa: "Reordenó los espacios".
  const head = subject
    ? `${capitalize(verb)} ${phrase}: ${subject}`
    : (def?.label ?? entry.action);
  // Una baja ya lo dice todo en la cabeza; listar "nombre, capacidad, …" no agrega nada.
  if (def?.kind === "delete") return `${head}.`;

  const changes = entryFieldChanges(entry);
  if (changes.length === 0) return `${head}.`;
  const preview = changes.slice(0, MAX_PREVIEW).map(previewChange).join(", ");
  return `${head} — ${preview}${moreSuffix(changes.length)}.`;
}
