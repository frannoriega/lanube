/**
 * Pure helpers for the form builder's visibility ("Mostrar solo si…") editor: converting between
 * the flat {field, op, value} the UI edits and the `Condition` stored on a node. The builder only
 * produces the simple single-predicate shapes here; compound and/or/not conditions can exist in a
 * schema but aren't editable through this UI (they parse back to "always visible").
 */

import type { Condition } from "@/lib/events/form-schema";

export interface BuilderConditionOp {
  value: string;
  label: string;
  /** Whether a value input is shown for this operator. */
  needsValue: boolean;
  /** Whether the value is numeric (parsed to a number). */
  numeric: boolean;
}

export const CONDITION_OPS: readonly BuilderConditionOp[] = [
  { value: "eq", label: "es igual a", needsValue: true, numeric: false },
  { value: "neq", label: "es distinto de", needsValue: true, numeric: false },
  { value: "gt", label: "es mayor que", needsValue: true, numeric: true },
  { value: "lt", label: "es menor que", needsValue: true, numeric: true },
  {
    value: "answered",
    label: "está completo",
    needsValue: false,
    numeric: false,
  },
  { value: "empty", label: "está vacío", needsValue: false, numeric: false },
];

export function opNeedsValue(op: string): boolean {
  return CONDITION_OPS.find((o) => o.value === op)?.needsValue ?? false;
}

export function opIsNumeric(op: string): boolean {
  return CONDITION_OPS.find((o) => o.value === op)?.numeric ?? false;
}

export interface BuilderConditionState {
  field: string;
  op: string;
  value: string;
}

export const EMPTY_CONDITION: BuilderConditionState = {
  field: "",
  op: "eq",
  value: "",
};

/** Builds a `Condition` from the builder inputs, or null (no field = always visible / invalid). */
export function buildVisibleWhen(
  state: BuilderConditionState,
): Condition | null {
  const { field, op, value } = state;
  if (!field) return null;
  if (op === "answered" || op === "empty") return { op, field };
  if (op === "gt" || op === "lt") {
    const n = Number(value);
    if (value.trim() === "" || !Number.isFinite(n)) return null;
    return { op, field, value: n };
  }
  if (op === "eq" || op === "neq") {
    if (value.trim() === "") return null;
    return { op, field, value };
  }
  return null;
}

/** Parses a stored condition back into the builder inputs (compound conditions → always visible). */
export function parseVisibleWhen(
  cond: Condition | null | undefined,
): BuilderConditionState {
  if (!cond) return { ...EMPTY_CONDITION };
  switch (cond.op) {
    case "and":
    case "or":
    case "not":
      return { ...EMPTY_CONDITION };
    default:
      return {
        field: cond.field,
        op: cond.op,
        value: "value" in cond ? String(cond.value) : "",
      };
  }
}
