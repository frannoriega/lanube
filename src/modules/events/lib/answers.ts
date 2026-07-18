import { validateScalar } from "@/modules/events/lib/form-engine";
import type {
  Condition,
  FieldConstraints,
  FieldType,
} from "@/modules/events/lib/form-schema";

/**
 * Flat, participant-facing view of a form field — a projection of an `InputNode` (from the schema)
 * used by the current flat renderer + client validation. Per-field validation delegates to the
 * engine's `validateScalar`, so there is exactly one implementation of the rules.
 * (form-engine only *type*-imports PublicFormField, so this import is not a runtime cycle.)
 */
export interface PublicFormField {
  id: string;
  type: string;
  label: string;
  placeholder?: string | null;
  required: boolean;
  options?: string[] | null;
  constraints?: FieldConstraints | null;
  /** Shown only when this condition over earlier answers holds (omitted = always visible). */
  visibleWhen?: Condition | null;
}

/** Validates one answer against its field. Returns an error message, or null if valid. */
export function validateAnswer(
  field: PublicFormField,
  value: unknown,
): string | null {
  return validateScalar(
    {
      kind: "input",
      id: field.id,
      type: field.type as FieldType,
      label: field.label,
      placeholder: field.placeholder ?? null,
      required: field.required,
      options: field.options ?? null,
      constraints: field.constraints ?? null,
    },
    value,
  );
}

export interface AnswerValidationResult {
  ok: boolean;
  errors: Record<string, string>;
}

/** Validates a full answer map (fieldId -> value) against the form's fields. */
export function validateAnswers(
  fields: PublicFormField[],
  answers: Record<string, unknown>,
): AnswerValidationResult {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const error = validateAnswer(field, answers[field.id]);
    if (error) errors[field.id] = error;
  }
  return { ok: Object.keys(errors).length === 0, errors };
}
