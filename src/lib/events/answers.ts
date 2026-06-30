import { FormFieldType } from "@/types/prisma";

export interface PublicFormField {
  id: string;
  type: string;
  label: string;
  placeholder?: string | null;
  required: boolean;
  options?: string[] | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_RE = /^[+]?[\d\s()-]{6,20}$/;
const DNI_RE = /^\d{7,9}$/;

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Validates one answer against its field. Returns an error message, or null if valid. */
export function validateAnswer(
  field: PublicFormField,
  value: unknown,
): string | null {
  if (isEmpty(value)) {
    return field.required ? "Este campo es obligatorio" : null;
  }

  switch (field.type) {
    case FormFieldType.SHORT_TEXT:
    case FormFieldType.LONG_TEXT:
      return typeof value === "string" ? null : "Valor inválido";

    case FormFieldType.NUMBER:
      return Number.isFinite(Number(value)) ? null : "Debe ser un número";

    case FormFieldType.DATE:
      return typeof value === "string" && DATE_RE.test(value)
        ? null
        : "Fecha inválida";

    case FormFieldType.TIME:
      return typeof value === "string" && TIME_RE.test(value)
        ? null
        : "Hora inválida";

    case FormFieldType.PHONE:
      return typeof value === "string" && PHONE_RE.test(value.trim())
        ? null
        : "Teléfono inválido";

    case FormFieldType.DNI:
      return typeof value === "string" && DNI_RE.test(value.trim())
        ? null
        : "DNI inválido";

    case FormFieldType.SINGLE_SELECT:
      return typeof value === "string" && (field.options ?? []).includes(value)
        ? null
        : "Opción inválida";

    case FormFieldType.MULTI_SELECT: {
      if (!Array.isArray(value)) return "Selección inválida";
      const allowed = new Set(field.options ?? []);
      return value.every((v) => typeof v === "string" && allowed.has(v))
        ? null
        : "Selección inválida";
    }

    default:
      return "Tipo de campo desconocido";
  }
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
