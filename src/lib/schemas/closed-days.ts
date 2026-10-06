import z from "zod";
import { MANUAL_CLOSED_DAY_SOURCES } from "@/lib/constants/closed-days";
import { MINUTES_PER_DAY } from "@/lib/closed-days/closures";

/** Un cierre no puede abarcar más de un año: acota la expansión por día (también en SQL). */
export const MAX_CLOSED_DAY_RANGE_DAYS = 366;

/** `YYYY-MM-DD` que además es una fecha real de calendario (no `2026-02-31`). */
const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Fecha inválida" })
  .refine(
    (v) => {
      const [y, m, d] = v.split("-").map(Number);
      const probe = new Date(Date.UTC(y, m - 1, d));
      return (
        probe.getUTCFullYear() === y &&
        probe.getUTCMonth() === m - 1 &&
        probe.getUTCDate() === d
      );
    },
    { message: "Fecha inválida" },
  );

/** Minutos desde la medianoche local, en la grilla de 15 minutos del ledger. */
const minutesSchema = z
  .number()
  .int()
  .min(0)
  .max(MINUTES_PER_DAY)
  .refine((v) => v % 15 === 0, {
    message: "El horario debe ser en intervalos de 15 minutos",
  });

function daysBetween(a: string, b: string): number {
  return (
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000
  );
}

/**
 * Alta o edición de un día cerrado desde el panel. `startTime`/`endTime` ambos `null` = día
 * completo; con franja, la misma aplica a cada día del rango. Las mismas reglas están como
 * CHECK en la base (migración 20261006100000).
 */
export const closedDayInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { message: "El motivo es obligatorio" })
      .max(100, { message: "El motivo admite hasta 100 caracteres" }),
    startDate: dateKeySchema,
    endDate: dateKeySchema,
    startTime: minutesSchema.nullable(),
    endTime: minutesSchema.nullable(),
    /** Solo al crear; al editar se conserva el origen del registro. */
    source: z.enum(MANUAL_CLOSED_DAY_SOURCES).optional(),
    /** Solo al editar: confirmar o descartar una propuesta, o reactivar un descartado. */
    status: z.enum(["ACTIVE", "DISMISSED"]).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.endDate < v.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "La fecha de fin no puede ser anterior a la de inicio",
      });
    } else if (
      daysBetween(v.startDate, v.endDate) >= MAX_CLOSED_DAY_RANGE_DAYS
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Un cierre no puede abarcar más de un año",
      });
    }
    if ((v.startTime === null) !== (v.endTime === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message:
          "Indicá el inicio y el fin del horario, o dejá el día completo",
      });
    } else if (
      v.startTime !== null &&
      v.endTime !== null &&
      v.startTime >= v.endTime
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "La hora de fin debe ser posterior a la de inicio",
      });
    }
  });

export type ClosedDayInput = z.infer<typeof closedDayInputSchema>;
