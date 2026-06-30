import { FormFieldType } from "@/types/prisma";
import {
  AlignLeft,
  Calendar,
  Clock,
  Hash,
  IdCard,
  List,
  ListChecks,
  type LucideIcon,
  Phone,
  Type,
} from "lucide-react";

/** Human-readable (Spanish) labels for each form field type. */
export const FIELD_TYPE_LABELS: Record<string, string> = {
  SHORT_TEXT: "Texto corto",
  LONG_TEXT: "Párrafo",
  NUMBER: "Número",
  SINGLE_SELECT: "Selección única",
  MULTI_SELECT: "Selección múltiple",
  DATE: "Fecha",
  TIME: "Hora",
  PHONE: "Teléfono",
  DNI: "DNI",
};

/** Icon per field type, for compact previews. */
export const FIELD_TYPE_ICONS: Record<string, LucideIcon> = {
  SHORT_TEXT: Type,
  LONG_TEXT: AlignLeft,
  NUMBER: Hash,
  SINGLE_SELECT: List,
  MULTI_SELECT: ListChecks,
  DATE: Calendar,
  TIME: Clock,
  PHONE: Phone,
  DNI: IdCard,
};

export function fieldTypeLabel(type: string): string {
  return FIELD_TYPE_LABELS[type] ?? type;
}

/** Field types whose answers come from a fixed option list (need an options editor). */
export const SELECT_FIELD_TYPES: string[] = [
  FormFieldType.SINGLE_SELECT,
  FormFieldType.MULTI_SELECT,
];
