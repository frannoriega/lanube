import z from "zod";

/**
 * Esquemas de las passkeys (milestone 17). Las respuestas de WebAuthn
 * (`RegistrationResponseJSON` / `AuthenticationResponseJSON`) las valida en serio
 * `@simplewebauthn/server` al verificar la firma; acá solo se exige la forma mínima para
 * no pasarle cualquier cosa.
 */

export const passkeyLabelSchema = z
  .string()
  .trim()
  .min(1, { message: "Ponele un nombre para reconocerla" })
  .max(60, { message: "El nombre debe tener menos de 60 caracteres" });

const webAuthnResponseShape = z
  .object({
    id: z.string().min(1),
    rawId: z.string().min(1),
    type: z.literal("public-key"),
    response: z.record(z.string(), z.unknown()),
  })
  .passthrough();

export const passkeyRegistrationSchema = z.object({
  challengeId: z.string().min(1),
  label: passkeyLabelSchema,
  response: webAuthnResponseShape,
});

export const passkeyAuthenticationSchema = z.object({
  challengeId: z.string().min(1),
  response: webAuthnResponseShape,
});
