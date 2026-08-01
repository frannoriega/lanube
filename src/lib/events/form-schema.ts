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
 * Every answerable field type. The first nine mirror the legacy `FormFieldType` enum (so existing
 * forms round-trip unchanged); INTEGER/FLOAT/MONEY/FILE are the new types (wired up in later
 * phases — reserved here so the schema shape is stable).
 */
export const FIELD_TYPES = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "NUMBER",
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
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/** Field types whose answer is drawn from a fixed option list. */
export const SELECT_FIELD_TYPES: readonly FieldType[] = [
  "SINGLE_SELECT",
  "MULTI_SELECT",
];

/** Numeric field types that accept min/max/step constraints. */
export const NUMERIC_FIELD_TYPES: readonly FieldType[] = [
  "NUMBER",
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
  /** FILE (reserved for the file-upload phase). */
  maxFiles?: number | null;
  maxSizeMb?: number | null;
  accept?: string[] | null;
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

export type FormNode = InputNode | GroupNode;

export interface FormSchema {
  version: 1;
  nodes: FormNode[];
}

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
  maxFiles: z.number().int().positive().nullable().optional(),
  maxSizeMb: z.number().positive().max(10).nullable().optional(),
  accept: z.array(z.string()).nullable().optional(),
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
    children: z.array(formNodeSchema),
    repeat: repeatSchema.nullable().optional(),
    visibleWhen: conditionSchema.nullable().optional(),
  }),
);

export const formNodeSchema: z.ZodType<FormNode> = z.lazy(() =>
  z.union([inputNodeSchema, groupNodeSchema]),
);

export const formSchemaZod: z.ZodType<FormSchema> = z.object({
  version: z.literal(1),
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
