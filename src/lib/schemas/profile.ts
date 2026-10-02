import z from "zod";

/**
 * Valid Argentine DNI numbers currently range from ~1.000.000 to ~150.000.000.
 * We validate the numeric value against that range (integers only, no letters).
 */
export const DNI_MIN = 1_000_000;
export const DNI_MAX = 150_000_000;

const DNI_INVALID_MESSAGE = "Ingrese un DNI válido (solo números)";

/** Shared DNI validator: integer within [DNI_MIN, DNI_MAX]. */
export const dniSchema = z
  .number({ message: "Ingrese su DNI" })
  .int({ message: DNI_INVALID_MESSAGE })
  .min(DNI_MIN, { message: DNI_INVALID_MESSAGE })
  .max(DNI_MAX, { message: DNI_INVALID_MESSAGE });

/**
 * Server-side DNI validator that also accepts the value as a string (the profile
 * PUT endpoint sends `dni` serialized). Coerces to a number, then applies `dniSchema`.
 */
export const dniInputSchema = z.coerce.number().pipe(dniSchema);

/** Keep only digits from raw input (used by DNI inputs to block letters/symbols). */
export function sanitizeDni(raw: string): string {
  return raw.replace(/\D/g, "");
}

// ---------------------------------------------------------------------------
// Configuración de la cuenta (milestone 17)
// ---------------------------------------------------------------------------

/**
 * Datos personales que el usuario edita por su cuenta desde "Configuración → Perfil".
 * Compartido por el formulario y por `PUT /api/user/profile`, así las dos puntas validan
 * exactamente lo mismo. Las longitudes mínimas son las que ya tenía el formulario.
 */
export const personalInfoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, { message: "El nombre debe tener al menos 3 caracteres" })
    .max(80, { message: "El nombre es demasiado largo" }),
  lastName: z
    .string()
    .trim()
    .min(3, { message: "El apellido debe tener al menos 3 caracteres" })
    .max(80, { message: "El apellido es demasiado largo" }),
  institution: z
    .string()
    .trim()
    .max(120, { message: "La institución es demasiado larga" }),
});

export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;

/** Mismas reglas que el alta (`/auth/signup`) para el motivo para unirse. */
export const reasonToJoinSchema = z
  .string()
  .trim()
  .min(20, { message: "El motivo debe tener al menos 20 caracteres" })
  .max(500, { message: "El motivo debe tener menos de 500 caracteres" });

/** Por qué se pide el cambio. Lo lee el admin que decide. */
export const changeJustificationSchema = z
  .string()
  .trim()
  .min(10, {
    message: "Contanos en al menos 10 caracteres por qué necesitás el cambio",
  })
  .max(500, { message: "La justificación debe tener menos de 500 caracteres" });

/** Los campos protegidos: solo cambian con una solicitud aprobada por un admin. */
export const PROFILE_CHANGE_FIELDS = ["DNI", "REASON_TO_JOIN"] as const;
export type ProfileChangeFieldKey = (typeof PROFILE_CHANGE_FIELDS)[number];

export const PROFILE_CHANGE_FIELD_LABELS: Record<
  ProfileChangeFieldKey,
  string
> = {
  DNI: "DNI",
  REASON_TO_JOIN: "Motivo para unirse",
};

/**
 * Cuerpo de `POST /api/user/profile/change-requests`. Unión discriminada por campo: cada
 * uno valida su valor con su propia regla (el DNI llega como texto de dígitos y se
 * normaliza a número para validar el rango).
 */
export const profileChangeRequestSchema = z.discriminatedUnion("field", [
  z.object({
    field: z.literal("DNI"),
    requestedValue: dniInputSchema.transform((n) => n.toString()),
    justification: changeJustificationSchema,
  }),
  z.object({
    field: z.literal("REASON_TO_JOIN"),
    requestedValue: reasonToJoinSchema,
    justification: changeJustificationSchema,
  }),
]);

export type ProfileChangeRequestInput = z.input<
  typeof profileChangeRequestSchema
>;

/** Cuerpo de `POST /api/admin/profile-requests/[id]/decision`. */
export const profileChangeDecisionSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    reason: z
      .string()
      .trim()
      .max(500, { message: "El motivo debe tener menos de 500 caracteres" })
      .optional(),
  })
  .refine((v) => v.decision === "approve" || (v.reason ?? "").length >= 5, {
    message: "Para rechazar, explicá el motivo (al menos 5 caracteres)",
    path: ["reason"],
  });
