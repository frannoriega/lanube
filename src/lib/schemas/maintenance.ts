import z from "zod";
import {
  ALL_AREA,
  MAINTENANCE_MODES,
  MAINTENANCE_AREA_IDS,
} from "@/lib/maintenance/areas";

// Como `string[]` a propósito: con un type guard zod angostaría `areas` a los ids del
// catálogo y los formularios (que guardan texto) dejarían de tipar.
const KNOWN_AREAS: readonly string[] = MAINTENANCE_AREA_IDS;

/** Alta/edición de una ventana de mantenimiento (milestone 22). Fechas en ms UNIX UTC. */
export const maintenanceInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, { message: "El título es obligatorio (mín. 3 caracteres)" })
      .max(80, { message: "El título admite hasta 80 caracteres" }),
    reasonMd: z
      .string()
      .trim()
      .min(10, { message: "Explicá el motivo (mín. 10 caracteres)" })
      .max(4000, { message: "El motivo admite hasta 4000 caracteres" }),
    mode: z.enum(MAINTENANCE_MODES),
    areas: z
      .array(z.string())
      .min(1, { message: "Elegí al menos un área" })
      .refine((areas) => areas.every((a) => KNOWN_AREAS.includes(a)), {
        message: "Hay un área que no existe",
      }),
    /** Nulo = rige desde que se crea. */
    startsAt: z.number().int().nonnegative().nullable(),
    /** Nulo = sin fin previsto: se apaga a mano. */
    endsAt: z.number().int().nonnegative().nullable(),
  })
  .refine(
    (v) => v.startsAt == null || v.endsAt == null || v.endsAt > v.startsAt,
    {
      message: "El fin tiene que ser posterior al inicio",
      path: ["endsAt"],
    },
  )
  .refine((v) => !(v.mode === "UNAVAILABLE" && v.areas.includes(ALL_AREA)), {
    message:
      "«Todo el sitio» solo admite aviso o solo lectura; para apagar funciones elegí áreas puntuales",
    path: ["mode"],
  });

export type MaintenanceInput = z.infer<typeof maintenanceInputSchema>;
