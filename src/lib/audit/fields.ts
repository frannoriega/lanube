/**
 * Tipos de campo de la auditoría: cómo se **muestra** y cómo se **compara** cada dato que
 * guarda una entrada (milestone 16).
 *
 * Por qué existe: antes, `humanize.ts` adivinaba el formato a partir del valor crudo — un
 * número podía ser una capacidad o una fecha en ms, un string podía ser un nombre o un
 * markdown de 2000 caracteres. El resultado era "Fecha de inicio: 1767225600000" o una
 * descripción entera tachada en rojo y repetida en verde. Ahora cada entidad declara, en el
 * registro (`registry.ts`), qué campos audita y de qué tipo es cada uno; el panel elige el
 * diff adecuado a partir del tipo, no del valor.
 *
 * Puro y seguro para el cliente: el panel de `/admin/audit` lo importa.
 */
import { formatMonthDay } from "@/lib/landing-themes/month-day";

export { formatMonthDay };

/**
 * Especificación de un campo auditable. `kind` decide el formato y el diff:
 * - `text`: texto corto, se muestra tal cual (línea roja tachada + línea verde).
 * - `longText`: texto largo o markdown — diff por líneas con las palabras cambiadas
 *   resaltadas, como un diff de git, en vez de repetir el párrafo entero.
 * - `bool`: "Sí"/"No".
 * - `number`: número, con unidad opcional ("12 personas").
 * - `enum`: un código del sistema traducido con `values` (`"DRAFT"` → "Borrador").
 * - `date` / `dateTime`: ms UNIX formateados en la zona y el idioma de quien mira.
 * - `monthDay`: `"MM-DD"` de una ventana anual → "20 de diciembre".
 * - `image`: URL de una imagen — el panel muestra las miniaturas de antes y después.
 * - `set`: lista sin orden (permisos, días) — solo lo agregado y lo quitado.
 * - `items`: lista de registros con id (los campos de un formulario) — qué se agregó, qué se
 *   quitó y qué cambió dentro de cada uno, con `itemFields` describiendo esos campos.
 * - `order`: un reordenamiento `[{ id, name }]` — cuánto subió o bajó cada elemento.
 */
export type FieldSpec =
  | { kind: "text"; label: string }
  | { kind: "longText"; label: string }
  | { kind: "bool"; label: string }
  | { kind: "number"; label: string; unit?: string }
  | { kind: "enum"; label: string; values: Record<string, string> }
  | { kind: "date"; label: string }
  | { kind: "dateTime"; label: string }
  | { kind: "monthDay"; label: string }
  | { kind: "image"; label: string }
  | { kind: "set"; label: string; items?: Record<string, string> }
  | {
      kind: "items";
      label: string;
      /** Clave del nombre de cada elemento (p. ej. `"label"` en un campo de formulario). */
      nameKey: string;
      itemFields: Record<string, FieldSpec>;
    }
  | { kind: "order"; label: string };

export type FieldSpecs = Record<string, FieldSpec>;

// Constructores cortos, para que el registro se lea como una tabla.
export const text = (label: string): FieldSpec => ({ kind: "text", label });
export const longText = (label: string): FieldSpec => ({
  kind: "longText",
  label,
});
export const bool = (label: string): FieldSpec => ({ kind: "bool", label });
export const num = (label: string, unit?: string): FieldSpec => ({
  kind: "number",
  label,
  unit,
});
export const enumOf = (
  label: string,
  values: Record<string, string>,
): FieldSpec => ({ kind: "enum", label, values });
export const date = (label: string): FieldSpec => ({ kind: "date", label });
export const dateTime = (label: string): FieldSpec => ({
  kind: "dateTime",
  label,
});
export const monthDay = (label: string): FieldSpec => ({
  kind: "monthDay",
  label,
});
export const image = (label: string): FieldSpec => ({ kind: "image", label });
export const setOf = (
  label: string,
  items?: Record<string, string>,
): FieldSpec => ({ kind: "set", label, items });
export const itemsOf = (
  label: string,
  nameKey: string,
  itemFields: FieldSpecs,
): FieldSpec => ({ kind: "items", label, nameKey, itemFields });
export const order = (label: string): FieldSpec => ({ kind: "order", label });

/** Valor vacío para la auditoría: `null`, `undefined`, `""` o una lista vacía. */
export function isEmptyValue(v: unknown): boolean {
  return (
    v === null ||
    v === undefined ||
    v === "" ||
    (Array.isArray(v) && v.length === 0)
  );
}

/**
 * Fechas en la zona horaria y el idioma de quien mira (principio del proyecto: se guardan
 * ms UTC y se formatean del lado del cliente, dd/mm/aaaa).
 */
const dateFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toMs(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  return null;
}

/** Texto legible de un valor según su campo. Los vacíos se muestran como "(vacío)". */
export function formatFieldValue(
  spec: FieldSpec | undefined,
  v: unknown,
): string {
  if (isEmptyValue(v)) return "(vacío)";
  switch (spec?.kind) {
    case "bool":
      return v ? "Sí" : "No";
    case "number":
      return spec.unit ? `${String(v)} ${spec.unit}` : String(v);
    case "enum":
      return spec.values[String(v)] ?? String(v);
    case "date": {
      const ms = toMs(v);
      return ms === null ? String(v) : dateFmt.format(new Date(ms));
    }
    case "dateTime": {
      const ms = toMs(v);
      return ms === null ? String(v) : dateTimeFmt.format(new Date(ms));
    }
    case "monthDay":
      return formatMonthDay(String(v));
    case "set":
      return (v as unknown[])
        .map((x) => spec.items?.[String(x)] ?? String(x))
        .join(", ");
    default:
      if (typeof v === "boolean") return v ? "Sí" : "No";
      if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
  }
}
