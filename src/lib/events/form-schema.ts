/**
 * Form definition as a recursive node tree.
 *
 * This is the source-of-truth shape stored on `Form.schema` (JSONB). It supersedes the flat
 * `FormField` table: a form is a tree of nodes so it can express branching (`visibleWhen`) and
 * repeating groups (`GroupNode.repeat`). Answers mirror the tree (see `form-engine.ts`).
 *
 * Because field types now live inside JSON (not the `form_field_types` Postgres enum), adding a
 * new field type is a code change here — no DB enum migration.
 */

import { z } from "zod";

/**
 * Every answerable field type. Numeric answers are INTEGER (whole numbers) or FLOAT (decimals);
 * MONEY is a decimal with a currency affordance. FILE holds uploaded file descriptors.
 */
export const FIELD_TYPES = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "SINGLE_SELECT",
  "MULTI_SELECT",
  "DATE",
  "TIME",
  "PHONE",
  "DNI",
  "INTEGER",
  "FLOAT",
  "MONEY",
  "FILE",
  "BOOLEAN",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/** One uploaded file, as stored in a FILE field's answer (an array of these). */
export interface UploadedFile {
  /** Storage URL/key (private — fetched through the admin proxy, never linked directly). */
  url: string;
  /** Original filename (shown to admins; also drives extension validation). */
  name: string;
  /** Size in bytes. */
  size: number;
  /**
   * Tipo MIME **derivado por el servidor a partir de la extensión** (`contentTypeForName`),
   * nunca el que informó el navegador: ese lo elige quien sube, y el proxy de admin lo servía
   * tal cual (XSS almacenado, milestone 25 S1). Filas viejas pueden tener todavía el del
   * navegador; el proxy ignora este campo y lo vuelve a derivar de `name`.
   */
  type: string;
  /**
   * HMAC que agrega el endpoint de subida (`upload-signing.ts`) para que el envío pueda probar
   * que el descriptor salió de nuestra propia subida y no lo inventó el cliente (milestone 25
   * S2). No existe en filas guardadas antes de ese cambio.
   */
  sig?: string;
}

/** Narrows an unknown value to an UploadedFile descriptor. */
export function isUploadedFile(value: unknown): value is UploadedFile {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as UploadedFile).url === "string" &&
    typeof (value as UploadedFile).name === "string"
  );
}

/** Field types whose answer is drawn from a fixed option list. */
export const SELECT_FIELD_TYPES: readonly FieldType[] = [
  "SINGLE_SELECT",
  "MULTI_SELECT",
];

/** Numeric field types that accept min/max/step constraints. */
export const NUMERIC_FIELD_TYPES: readonly FieldType[] = [
  "INTEGER",
  "FLOAT",
  "MONEY",
];

/**
 * Per-field constraints. A loose bag: which keys are meaningful depends on the field `type`
 * (numeric types use min/max/step; FILE uses maxFiles/maxSizeMb/accept). The builder + Zod
 * enforce the right subset per type.
 */
export interface FieldConstraints {
  min?: number | null;
  max?: number | null;
  step?: number | null;
  /** FILE: how many files (default 1), per-file size cap (MB, hard-capped at 10), allowed
   * extensions (lowercased, no dot — e.g. ["pdf", "jpg"]; empty/omitted = any). */
  maxFiles?: number | null;
  maxSizeMb?: number | null;
  accept?: string[] | null;
  /** BOOLEAN: an optional document the participant acknowledges (e.g. terms & conditions). */
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}

/**
 * Declarative, serializable predicate over earlier answers — the reactive wiring. `field` is a
 * node id; it resolves against the current answer scope, walking up to ancestor/root scopes
 * (see `form-engine.ts`). The builder only offers *earlier* fields as targets, so conditions are
 * always acyclic.
 */
export type Condition =
  | { op: "eq" | "neq"; field: string; value: string | number | boolean }
  | { op: "in" | "nin"; field: string; value: Array<string | number> }
  | { op: "gt" | "gte" | "lt" | "lte"; field: string; value: number }
  | { op: "contains"; field: string; value: string }
  | { op: "answered" | "empty"; field: string }
  | { op: "and" | "or"; conditions: Condition[] }
  | { op: "not"; condition: Condition };

interface NodeBase {
  /** Stable id — the answer key and the target of `Condition.field`. Survives edits. */
  id: string;
  /** Shown only when this holds (omitted = always visible). */
  visibleWhen?: Condition | null;
}

/** A single answerable question. */
export interface InputNode extends NodeBase {
  kind: "input";
  type: FieldType;
  label: string;
  placeholder?: string | null;
  required: boolean;
  /** Choices for SINGLE_SELECT / MULTI_SELECT — the option string is both value and label. */
  options?: string[] | null;
  constraints?: FieldConstraints | null;
}

/** How many times a group repeats. */
export interface RepeatConfig {
  min?: number | null;
  max?: number | null;
  /** When set, the instance count is driven by this INTEGER field's answer. */
  countFrom?: string | null;
  /** Item heading, e.g. "Integrante {{n}}" ({{n}} = 1-based index). */
  itemLabel?: string | null;
}

/** A container of child nodes. With `repeat`, it becomes a repeating group. */
export interface GroupNode extends NodeBase {
  kind: "group";
  label?: string | null;
  children: FormNode[];
  repeat?: RepeatConfig | null;
}

// ---------------------------------------------------------------------------
// Participante (milestone 34)
// ---------------------------------------------------------------------------

/**
 * Tipos que puede tener un dato de la **forma del participante**: datos de una persona, nunca
 * archivos ni números sueltos. El email no está acá: es fijo, obligatorio y siempre el primero.
 */
export const PARTICIPANT_FIELD_TYPES = [
  "SHORT_TEXT",
  "DNI",
  "PHONE",
  "DATE",
  "SINGLE_SELECT",
] as const satisfies readonly FieldType[];

export type ParticipantFieldType = (typeof PARTICIPANT_FIELD_TYPES)[number];

/** Un dato de la forma del participante (nombre, apellido, DNI…). */
export interface ParticipantField {
  /** Clave estable dentro del formulario (la respuesta se guarda con ella): sobrevive renombrar. */
  key: string;
  type: ParticipantFieldType;
  label: string;
  required: boolean;
  /** Opciones de un SINGLE_SELECT. */
  options?: string[] | null;
}

/**
 * Qué es «un participante» en este formulario (milestone 34): el email (fijo) más estos datos.
 * La misma forma la usan quien inscribe y cada integrante que se agregue.
 */
export interface ParticipantShape {
  fields: ParticipantField[];
}

/**
 * Un integrante más de la inscripción (milestone 34): se agrega como cualquier campo, suelto o
 * dentro de un grupo repetible («Integrantes», de 0 a N). Su respuesta es un objeto
 * `{ email, <key>: valor }` con la forma del formulario. Quien inscribe **no** es un nodo: es el
 * email de la inscripción más `answers[PRIMARY_PARTICIPANT_KEY]` (ver `form-engine.ts`).
 */
export interface ParticipantNode extends NodeBase {
  kind: "participant";
  label: string;
  /** Opcional = se puede dejar entero en blanco; si se completa algo, va la forma completa. */
  required: boolean;
}

export type FormNode = InputNode | GroupNode | ParticipantNode;

export interface FormSchema {
  version: 1;
  /** Forma del participante (milestone 34). Ausente = solo el email (formularios anteriores). */
  participant?: ParticipantShape | null;
  nodes: FormNode[];
}

/**
 * Clave reservada de las respuestas donde van los datos de **quien inscribe** (además del email
 * de la inscripción). Empieza con `__` para no chocar nunca con un id de nodo (cuid2).
 */
export const PRIMARY_PARTICIPANT_KEY = "__primary";

/** Clave del email dentro de la respuesta de un participante. */
export const PARTICIPANT_EMAIL_KEY = "email";

// ---------------------------------------------------------------------------
// Zod (recursive). Validates a schema document on write; the API re-runs this
// after the builder serialises the tree.
// ---------------------------------------------------------------------------

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({
      op: z.enum(["eq", "neq"]),
      field: z.string().min(1),
      value: z.union([z.string(), z.number(), z.boolean()]),
    }),
    z.object({
      op: z.enum(["in", "nin"]),
      field: z.string().min(1),
      value: z.array(z.union([z.string(), z.number()])),
    }),
    z.object({
      op: z.enum(["gt", "gte", "lt", "lte"]),
      field: z.string().min(1),
      value: z.number(),
    }),
    z.object({
      op: z.literal("contains"),
      field: z.string().min(1),
      value: z.string(),
    }),
    z.object({
      op: z.enum(["answered", "empty"]),
      field: z.string().min(1),
    }),
    z.object({
      op: z.enum(["and", "or"]),
      conditions: z.array(conditionSchema),
    }),
    z.object({
      op: z.literal("not"),
      condition: conditionSchema,
    }),
  ]),
);

const constraintsSchema: z.ZodType<FieldConstraints> = z.object({
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  step: z.number().positive().nullable().optional(),
  maxFiles: z.number().int().positive().max(20).nullable().optional(),
  maxSizeMb: z.number().positive().max(10).nullable().optional(),
  accept: z.array(z.string()).nullable().optional(),
  attachmentUrl: z.string().nullable().optional(),
  attachmentName: z.string().nullable().optional(),
});

const inputNodeSchema: z.ZodType<InputNode> = z
  .object({
    kind: z.literal("input"),
    id: z.string().min(1),
    type: z.enum(FIELD_TYPES),
    label: z.string().trim().min(1, { message: "La etiqueta es obligatoria" }),
    placeholder: z.string().trim().max(200).nullable().optional(),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1)).nullable().optional(),
    constraints: constraintsSchema.nullable().optional(),
    visibleWhen: conditionSchema.nullable().optional(),
  })
  .superRefine((node, ctx) => {
    if (
      SELECT_FIELD_TYPES.includes(node.type) &&
      (!node.options || node.options.length < 1)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Agregá al menos una opción",
        path: ["options"],
      });
    }
    // Mismo chequeo que el constructor de formularios: con mínimo > máximo el campo no admite
    // ninguna respuesta y el formulario público queda imposible de enviar. Antes solo lo
    // frenaba la UI (auditoría de restricciones de UI, milestone 26).
    const min = node.constraints?.min;
    const max = node.constraints?.max;
    if (typeof min === "number" && typeof max === "number" && min > max) {
      ctx.addIssue({
        code: "custom",
        message: "El máximo debe ser mayor o igual al mínimo",
        path: ["constraints", "max"],
      });
    }
  });

const repeatSchema: z.ZodType<RepeatConfig> = z.object({
  min: z.number().int().nonnegative().nullable().optional(),
  max: z.number().int().positive().nullable().optional(),
  countFrom: z.string().nullable().optional(),
  itemLabel: z.string().trim().max(120).nullable().optional(),
});

const groupNodeSchema: z.ZodType<GroupNode> = z.lazy(() =>
  z.object({
    kind: z.literal("group"),
    id: z.string().min(1),
    label: z.string().trim().max(200).nullable().optional(),
    // Un grupo vacío no pide nada: el constructor ya lo rechazaba, ahora también el servidor.
    children: z
      .array(formNodeSchema)
      .min(1, { message: "Agregá al menos un campo al grupo" }),
    repeat: repeatSchema.nullable().optional(),
    visibleWhen: conditionSchema.nullable().optional(),
  }),
);

const participantNodeSchema: z.ZodType<ParticipantNode> = z.object({
  kind: z.literal("participant"),
  id: z.string().min(1),
  label: z
    .string()
    .trim()
    .min(1, { message: "La etiqueta es obligatoria" })
    .max(200),
  required: z.boolean(),
  visibleWhen: conditionSchema.nullable().optional(),
});

const participantFieldSchema: z.ZodType<ParticipantField> = z
  .object({
    key: z
      .string()
      .min(1)
      .max(64)
      .refine((k) => k !== PARTICIPANT_EMAIL_KEY && !k.startsWith("__"), {
        message: "Clave reservada",
      }),
    type: z.enum(PARTICIPANT_FIELD_TYPES),
    label: z
      .string()
      .trim()
      .min(1, { message: "La etiqueta es obligatoria" })
      .max(120),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1)).nullable().optional(),
  })
  .superRefine((f, ctx) => {
    if (f.type === "SINGLE_SELECT" && (!f.options || f.options.length < 1))
      ctx.addIssue({
        code: "custom",
        message: "Agregá al menos una opción",
        path: ["options"],
      });
  });

export const participantShapeSchema: z.ZodType<ParticipantShape> = z.object({
  fields: z
    .array(participantFieldSchema)
    .max(12, { message: "Hasta 12 datos por participante" })
    .refine((fs) => new Set(fs.map((f) => f.key)).size === fs.length, {
      message: "Claves repetidas",
    }),
});

export const formNodeSchema: z.ZodType<FormNode> = z.lazy(() =>
  z.union([inputNodeSchema, groupNodeSchema, participantNodeSchema]),
);

export const formSchemaZod: z.ZodType<FormSchema> = z.object({
  version: z.literal(1),
  participant: participantShapeSchema.nullable().optional(),
  nodes: z.array(formNodeSchema),
});

/** An empty (field-less) form. */
export const EMPTY_FORM_SCHEMA: FormSchema = { version: 1, nodes: [] };

export function isInputNode(node: FormNode): node is InputNode {
  return node.kind === "input";
}

export function isGroupNode(node: FormNode): node is GroupNode {
  return node.kind === "group";
}

export function isParticipantNode(node: FormNode): node is ParticipantNode {
  return node.kind === "participant";
}

/** Los datos de la forma (sin el email), o ninguno en un formulario anterior al milestone 34. */
export function participantFields(schema: FormSchema): ParticipantField[] {
  return schema.participant?.fields ?? [];
}

/** Un dato de la forma como `InputNode`, para validarlo con las mismas reglas que un campo. */
export function participantFieldAsInput(f: ParticipantField): InputNode {
  return {
    kind: "input",
    id: f.key,
    type: f.type,
    label: f.label,
    required: f.required,
    options: f.options ?? null,
  };
}
