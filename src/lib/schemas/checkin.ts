import { registerEmailSchema } from "@/lib/schemas/auth";
import { z } from "zod";

/**
 * Pedidos de la pantalla de check-in de eventos (milestone 30). La sesión viaja como su inicio
 * nominal en UNIX ms (`EventCheckIn.occurrenceStart`).
 */

const session = z.number().int().positive({ message: "Sesión inválida" });

/** Registrar el ingreso. `admit` confirma dejar pasar una inscripción no aprobada. */
export const checkInSchema = z.object({
  session,
  participantId: z.string().min(1),
  admit: z.boolean().default(false),
});

/** Deshacer un ingreso. */
export const checkInUndoSchema = z.object({
  session,
  participantId: z.string().min(1),
});

/** Registrar a alguien que llegó sin inscripción, con el formulario del evento. */
export const walkInSchema = z.object({
  session,
  email: registerEmailSchema,
  answers: z.record(z.string(), z.unknown()),
});
