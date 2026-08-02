import { FormFieldType } from "@/types/prisma";
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  Clock,
  DollarSign,
  Hash,
  IdCard,
  List,
  ListChecks,
  type LucideIcon,
  Paperclip,
  Phone,
  Ratio,
  Sigma,
  Type,
} from "lucide-react";

/** Human-readable (Spanish) labels for each form field type. */
export const FIELD_TYPE_LABELS: Record<string, string> = {
  SHORT_TEXT: "Texto corto",
  LONG_TEXT: "Párrafo",
  NUMBER: "Número",
  INTEGER: "Número entero",
  FLOAT: "Número decimal",
  MONEY: "Monto ($)",
  SINGLE_SELECT: "Selección única",
  MULTI_SELECT: "Selección múltiple",
  DATE: "Fecha",
  TIME: "Hora",
  PHONE: "Teléfono",
  DNI: "DNI",
  FILE: "Archivo",
  BOOLEAN: "Casilla de aceptación",
};

/** Icon per field type, for compact previews. */
export const FIELD_TYPE_ICONS: Record<string, LucideIcon> = {
  SHORT_TEXT: Type,
  LONG_TEXT: AlignLeft,
  NUMBER: Hash,
  INTEGER: Sigma,
  FLOAT: Ratio,
  MONEY: DollarSign,
  SINGLE_SELECT: List,
  MULTI_SELECT: ListChecks,
  DATE: Calendar,
  TIME: Clock,
  PHONE: Phone,
  DNI: IdCard,
  FILE: Paperclip,
  BOOLEAN: CheckSquare,
};

export function fieldTypeLabel(type: string): string {
  return FIELD_TYPE_LABELS[type] ?? type;
}

/** Field types whose answers come from a fixed option list (need an options editor). */
export const SELECT_FIELD_TYPES: string[] = [
  FormFieldType.SINGLE_SELECT,
  FormFieldType.MULTI_SELECT,
];

/** Numeric field types that accept min/max constraints (need a constraints editor). */
export const NUMERIC_FIELD_TYPES: string[] = [
  FormFieldType.NUMBER,
  FormFieldType.INTEGER,
  FormFieldType.FLOAT,
  FormFieldType.MONEY,
];

/** File-upload field types (need a size/extension constraints editor). */
export const FILE_FIELD_TYPES: string[] = [FormFieldType.FILE];

/** Checkbox/acknowledgement field types (offer an optional attached document). */
export const BOOLEAN_FIELD_TYPES: string[] = [FormFieldType.BOOLEAN];
