import { z } from "zod"

import { REPORT_TYPES } from "@/lib/reports/@types"

const MILLISECONDS_IN_DAY = 86_400_000
const MAX_REPORT_WINDOW_DAYS = 90
const MAX_REPORT_WINDOW_MS = MAX_REPORT_WINDOW_DAYS * MILLISECONDS_IN_DAY

function getEarliestAllowedStartDateMs(): number {
  const now = new Date()
  return new Date(now.getUTCFullYear() - 2, 0, 1).getTime()
}

const unixTimestampSchema = z
  .number({
    required_error: "Las fechas son obligatorias",
    invalid_type_error: "Las fechas deben ser timestamps UNIX en UTC",
  })
  .int("Las fechas deben ser timestamps UNIX en UTC")
  .nonnegative("Las fechas deben ser timestamps UNIX válidos")

const reportRequestItemSchema = z.object({
  type: z.enum(REPORT_TYPES, {
    invalid_type_error: "El tipo de reporte es inválido",
    required_error: "El tipo de reporte es obligatorio",
  }),
  options: z.record(z.unknown()).default({}),
})

export const reportWindowRequestSchema = z
  .object({
    startDate: unixTimestampSchema,
    endDate: unixTimestampSchema,
    reports: z
      .array(reportRequestItemSchema, {
        required_error: "Debes indicar al menos un reporte",
        invalid_type_error: "La lista de reportes es inválida",
      })
      .min(1, "Debes indicar al menos un reporte"),
  })
  .superRefine((value, ctx) => {
    if (value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "startDate no puede ser mayor a endDate",
      })
    }

    if (value.endDate - value.startDate > MAX_REPORT_WINDOW_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "La ventana no puede superar 90 días",
      })
    }

    const earliestAllowedStartMs = getEarliestAllowedStartDateMs()
    if (value.startDate < earliestAllowedStartMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "startDate está fuera del rango permitido",
      })
    }
  })

export type ReportWindowRequestInput = z.infer<typeof reportWindowRequestSchema>
