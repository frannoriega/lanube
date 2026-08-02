/**
 * Pure evaluation engine for the form node tree — the single source of truth shared by the public
 * renderer (client) and the submit/edit paths (server), exactly as `answers.ts` was for flat forms.
 *
 * Responsibilities:
 *  - evaluate `Condition`s against the current answers (the reactive wiring)
 *  - decide which nodes are visible right now
 *  - validate an answer document against the schema (visible nodes only), producing path-keyed errors
 *  - prune answers for hidden nodes (so a switched branch doesn't submit stale data)
 *
 * Answer shape mirrors the tree:
 *   scalar                       -> an input node's answer
 *   Record<id, AnswerValue>      -> a fixed group's answers
 *   Array<Record<id, ...>>       -> a repeating group's answers (one map per item)
 * The root is an AnswerMap. A legacy flat `{ fieldId: value }` map is already a valid AnswerMap.
 */

import type { PublicFormField } from "@/lib/events/answers";
import {
  type Condition,
  EMPTY_FORM_SCHEMA,
  type FieldConstraints,
  type FormNode,
  type FormSchema,
  type GroupNode,
  type InputNode,
  isGroupNode,
} from "@/lib/events/form-schema";
import { createId } from "@paralleldrive/cuid2";

export type AnswerValue = unknown;
export type AnswerMap = Record<string, AnswerValue>;

/**
 * Reads a stored `Form.schema` JSON value into a FormSchema. The shape is validated on write
 * (formSchemaZod), so this only guards against null/garbage — returning an empty schema. Callers
 * that need a legacy fallback should check `form.schema != null` before calling.
 */
export function parseFormSchema(value: unknown): FormSchema {
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { nodes?: unknown }).nodes)
  ) {
    return value as FormSchema;
  }
  return EMPTY_FORM_SCHEMA;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_RE = /^[+]?[\d\s()-]{6,20}$/;
const DNI_RE = /^\d{7,9}$/;

export function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

// ---------------------------------------------------------------------------
// Scope resolution + condition evaluation
// ---------------------------------------------------------------------------

/**
 * Scopes are answer maps ordered innermost-first (own repeat item, then ancestors, then root).
 * A field id resolves against the nearest scope that defines it.
 */
function resolveField(scopes: AnswerMap[], fieldId: string): unknown {
  for (const scope of scopes) {
    if (scope && Object.prototype.hasOwnProperty.call(scope, fieldId)) {
      return scope[fieldId];
    }
  }
  return undefined;
}

export function evaluateCondition(
  cond: Condition,
  scopes: AnswerMap[],
): boolean {
  switch (cond.op) {
    case "and":
      return cond.conditions.every((c) => evaluateCondition(c, scopes));
    case "or":
      return cond.conditions.some((c) => evaluateCondition(c, scopes));
    case "not":
      return !evaluateCondition(cond.condition, scopes);
    default:
      break;
  }

  const actual = resolveField(scopes, cond.field);

  switch (cond.op) {
    case "answered":
      return !isEmpty(actual);
    case "empty":
      return isEmpty(actual);
    case "eq":
      return looseEquals(actual, cond.value);
    case "neq":
      return !looseEquals(actual, cond.value);
    case "in":
      return cond.value.some((v) => looseEquals(actual, v));
    case "nin":
      return !cond.value.some((v) => looseEquals(actual, v));
    case "gt":
      return toNumber(actual) > cond.value;
    case "gte":
      return toNumber(actual) >= cond.value;
    case "lt":
      return toNumber(actual) < cond.value;
    case "lte":
      return toNumber(actual) <= cond.value;
    case "contains":
      if (Array.isArray(actual)) return actual.includes(cond.value);
      return typeof actual === "string" && actual.includes(cond.value);
    default:
      return false;
  }
}

function looseEquals(a: unknown, b: string | number | boolean): boolean {
  if (typeof b === "number") return toNumber(a) === b;
  if (typeof b === "boolean") return Boolean(a) === b;
  return String(a) === String(b);
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

export function isVisible(node: FormNode, scopes: AnswerMap[]): boolean {
  if (!node.visibleWhen) return true;
  return evaluateCondition(node.visibleWhen, scopes);
}

// ---------------------------------------------------------------------------
// Repeat count
// ---------------------------------------------------------------------------

/** How many item blocks a repeating group should currently have, given the answers in scope. */
export function repeatCount(
  node: FormNode,
  scopes: AnswerMap[],
): number | null {
  if (!isGroupNode(node) || !node.repeat) return null;
  const { countFrom, min, max } = node.repeat;
  if (countFrom) {
    const raw = toNumber(resolveField(scopes, countFrom));
    let n = Number.isFinite(raw) ? Math.floor(raw) : 0;
    if (typeof min === "number") n = Math.max(min, n);
    if (typeof max === "number") n = Math.min(max, n);
    return Math.max(0, n);
  }
  return null; // free add/remove — count is driven by the answer array itself
}

// ---------------------------------------------------------------------------
// Scalar validation
// ---------------------------------------------------------------------------

/** Lowercased file extension (no dot), or "" if none. */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Whether a filename's extension is in the allow-list (list entries normalized: no dot, lower). */
export function extensionAllowed(
  name: string,
  accept: string[] | null | undefined,
): boolean {
  if (!accept || accept.length === 0) return true;
  const ext = fileExtension(name);
  return accept.some((a) => a.replace(/^\./, "").toLowerCase() === ext);
}

/** Validates one input node's answer. Returns an error message, or null if valid. */
export function validateScalar(node: InputNode, value: unknown): string | null {
  // BOOLEAN is special-cased before the emptiness check: `false` is a valid, non-empty answer,
  // but a *required* acknowledgement must be explicitly true.
  if (node.type === "BOOLEAN") {
    if (value != null && typeof value !== "boolean") return "Valor inválido";
    return node.required && value !== true
      ? "Debés marcar esta casilla para continuar"
      : null;
  }

  if (isEmpty(value)) {
    return node.required ? "Este campo es obligatorio" : null;
  }

  switch (node.type) {
    case "SHORT_TEXT":
    case "LONG_TEXT":
      return typeof value === "string" ? null : "Valor inválido";

    case "INTEGER": {
      const n = toNumber(value);
      if (!Number.isFinite(n)) return "Debe ser un número";
      if (!Number.isInteger(n)) return "Debe ser un número entero";
      return numericConstraint(node.constraints, n);
    }

    case "FLOAT": {
      const n = toNumber(value);
      if (!Number.isFinite(n)) return "Debe ser un número";
      return numericConstraint(node.constraints, n);
    }

    case "MONEY": {
      const n = toNumber(value);
      if (!Number.isFinite(n)) return "Monto inválido";
      if (n < 0) return "El monto no puede ser negativo";
      return numericConstraint(node.constraints, n);
    }

    case "DATE":
      return typeof value === "string" && DATE_RE.test(value)
        ? null
        : "Fecha inválida";

    case "TIME":
      return typeof value === "string" && TIME_RE.test(value)
        ? null
        : "Hora inválida";

    case "PHONE":
      return typeof value === "string" && PHONE_RE.test(value.trim())
        ? null
        : "Teléfono inválido";

    case "DNI":
      return typeof value === "string" && DNI_RE.test(value.trim())
        ? null
        : "DNI inválido";

    case "SINGLE_SELECT":
      return typeof value === "string" && (node.options ?? []).includes(value)
        ? null
        : "Opción inválida";

    case "MULTI_SELECT": {
      if (!Array.isArray(value)) return "Selección inválida";
      const allowed = new Set(node.options ?? []);
      return value.every((v) => typeof v === "string" && allowed.has(v))
        ? null
        : "Selección inválida";
    }

    case "FILE": {
      if (!Array.isArray(value)) return "Archivo inválido";
      const c = node.constraints;
      const max = c?.maxFiles ?? 1;
      if (value.length > max) return `Máximo ${max} archivo(s)`;
      for (const f of value) {
        if (!f || typeof f !== "object") return "Archivo inválido";
        const file = f as { url?: unknown; name?: unknown; size?: unknown };
        if (typeof file.url !== "string" || typeof file.name !== "string")
          return "Archivo inválido";
        if (
          typeof c?.maxSizeMb === "number" &&
          typeof file.size === "number" &&
          file.size > c.maxSizeMb * 1024 * 1024
        )
          return `Cada archivo debe pesar menos de ${c.maxSizeMb} MB`;
        if (!extensionAllowed(file.name, c?.accept))
          return `Formato no permitido (${(c?.accept ?? []).join(", ")})`;
      }
      return null;
    }

    default:
      return "Tipo de campo desconocido";
  }
}

function numericConstraint(
  c: FieldConstraints | null | undefined,
  n: number,
): string | null {
  if (!c) return null;
  if (typeof c.min === "number" && n < c.min) return `Mínimo ${c.min}`;
  if (typeof c.max === "number" && n > c.max) return `Máximo ${c.max}`;
  return null;
}

// ---------------------------------------------------------------------------
// Whole-form validation (visible nodes only), path-keyed errors
// ---------------------------------------------------------------------------

export interface FormValidationResult {
  ok: boolean;
  /** Keyed by dot path: "fieldId", "groupId.0.childId". */
  errors: Record<string, string>;
}

export function validateForm(
  schema: FormSchema,
  answers: AnswerMap,
): FormValidationResult {
  const errors: Record<string, string> = {};
  validateNodes(schema.nodes, [answers ?? {}], "", errors);
  return { ok: Object.keys(errors).length === 0, errors };
}

function validateNodes(
  nodes: FormNode[],
  scopes: AnswerMap[],
  prefix: string,
  errors: Record<string, string>,
): void {
  const scope = scopes[0] ?? {};
  for (const node of nodes) {
    if (!isVisible(node, scopes)) continue;

    if (!isGroupNode(node)) {
      const err = validateScalar(node, scope[node.id]);
      if (err) errors[`${prefix}${node.id}`] = err;
      continue;
    }

    const raw = scope[node.id];
    if (node.repeat) {
      const items = Array.isArray(raw) ? (raw as AnswerMap[]) : [];
      const { min, max } = node.repeat;
      if (typeof min === "number" && items.length < min)
        errors[`${prefix}${node.id}`] = `Agregá al menos ${min}`;
      if (typeof max === "number" && items.length > max)
        errors[`${prefix}${node.id}`] = `Máximo ${max}`;
      items.forEach((item, index) => {
        validateNodes(
          node.children,
          [item ?? {}, ...scopes],
          `${prefix}${node.id}.${index}.`,
          errors,
        );
      });
    } else {
      const child = (raw as AnswerMap) ?? {};
      validateNodes(
        node.children,
        [child, ...scopes],
        `${prefix}${node.id}.`,
        errors,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Prune answers to visible nodes (drops hidden branches + unknown keys)
// ---------------------------------------------------------------------------

export function pruneAnswers(
  schema: FormSchema,
  answers: AnswerMap,
): AnswerMap {
  return pruneNodes(schema.nodes, [answers ?? {}]);
}

function pruneNodes(nodes: FormNode[], scopes: AnswerMap[]): AnswerMap {
  const scope = scopes[0] ?? {};
  const out: AnswerMap = {};
  for (const node of nodes) {
    if (!isVisible(node, scopes)) continue;

    if (!isGroupNode(node)) {
      if (scope[node.id] !== undefined) out[node.id] = scope[node.id];
      continue;
    }

    const raw = scope[node.id];
    if (node.repeat) {
      const items = Array.isArray(raw) ? (raw as AnswerMap[]) : [];
      out[node.id] = items.map((item) =>
        pruneNodes(node.children, [item ?? {}, ...scopes]),
      );
    } else {
      out[node.id] = pruneNodes(node.children, [
        (raw as AnswerMap) ?? {},
        ...scopes,
      ]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Compatibility helpers (transition period)
// ---------------------------------------------------------------------------

/**
 * Flattens a schema's input nodes into the legacy `PublicFormField[]` shape, so the existing flat
 * renderer/validation keep working during the migration. Groups are descended into but repeat/
 * branching semantics are lost — only safe for flat forms (which is all of them pre-branching).
 */
export function schemaToPublicFields(schema: FormSchema): PublicFormField[] {
  const out: PublicFormField[] = [];
  const walk = (nodes: FormNode[]) => {
    for (const node of nodes) {
      if (isGroupNode(node)) {
        walk(node.children);
      } else {
        out.push({
          id: node.id,
          type: node.type,
          label: node.label,
          placeholder: node.placeholder ?? null,
          required: node.required,
          options: node.options ?? null,
          constraints: node.constraints ?? null,
          visibleWhen: node.visibleWhen ?? null,
        });
      }
    }
  };
  walk(schema.nodes);
  return out;
}

/** Field shape shared by the DB layer when building a flat schema (create/update/clone). */
export interface FlatFieldInput {
  id: string;
  type: string;
  label: string;
  placeholder?: string | null;
  required: boolean;
  options?: string[] | null;
  constraints?: FieldConstraints | null;
  visibleWhen?: Condition | null;
}

/** Builds a flat (single-level, no groups) schema from an ordered field list. */
export function flatFieldsToSchema(fields: FlatFieldInput[]): FormSchema {
  return {
    version: 1,
    nodes: fields.map(
      (f): InputNode => ({
        kind: "input",
        id: f.id,
        type: f.type as InputNode["type"],
        label: f.label,
        placeholder: f.placeholder ?? null,
        required: f.required,
        options: f.options ?? null,
        constraints: f.constraints ?? null,
        visibleWhen: f.visibleWhen ?? null,
      }),
    ),
  };
}

/**
 * Deep-clones a schema with fresh node ids, rewriting every intra-form reference (condition
 * `field` targets and repeat `countFrom`) to the new ids. Used when binding a template to an event
 * so the instance is a self-contained snapshot whose branching/repeat references stay valid.
 */
export function cloneSchemaWithNewIds(schema: FormSchema): FormSchema {
  const idMap = new Map<string, string>();
  const assign = (nodes: FormNode[]) => {
    for (const n of nodes) {
      idMap.set(n.id, createId());
      if (isGroupNode(n)) assign(n.children);
    }
  };
  assign(schema.nodes);

  const remap = (id: string) => idMap.get(id) ?? id;
  const remapCond = (c: Condition): Condition => {
    switch (c.op) {
      case "and":
      case "or":
        return { op: c.op, conditions: c.conditions.map(remapCond) };
      case "not":
        return { op: "not", condition: remapCond(c.condition) };
      default:
        return { ...c, field: remap(c.field) };
    }
  };

  const clone = (nodes: FormNode[]): FormNode[] =>
    nodes.map((n) => {
      const visibleWhen = n.visibleWhen
        ? remapCond(n.visibleWhen)
        : n.visibleWhen;
      if (isGroupNode(n)) {
        const group: GroupNode = {
          ...n,
          id: remap(n.id),
          visibleWhen,
          children: clone(n.children),
          repeat: n.repeat
            ? {
                ...n.repeat,
                countFrom: n.repeat.countFrom
                  ? remap(n.repeat.countFrom)
                  : n.repeat.countFrom,
              }
            : n.repeat,
        };
        return group;
      }
      return { ...n, id: remap(n.id), visibleWhen };
    });

  return { version: 1, nodes: clone(schema.nodes) };
}
