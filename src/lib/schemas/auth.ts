import {
  MSG_INVALID_EMAIL,
  tryNormalizeEmailForIdentity,
} from "@/lib/email/identity";
import z from "zod";

/** Client-safe: format + trim/lowercase/+lanube + Gmail dot rules (no MX / Workspace env). */
export const authEmailSchema = z
  .email({ message: MSG_INVALID_EMAIL })
  .transform((email, ctx) => {
    const r = tryNormalizeEmailForIdentity(email);
    if (r.ok) {
      return r.value;
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: r.message,
      input: email,
    });
    return z.NEVER;
  });

/**
 * Tope de largo de contraseña (milestone 25, S3). bcrypt solo usa los primeros 72 bytes, pero
 * sin tope el servidor recibe y procesa lo que le manden. 128 sobra para cualquier gestor de
 * contraseñas.
 */
const PASSWORD_MAX = 128;
const MSG_PASSWORD_MAX = `La contraseña no puede tener más de ${PASSWORD_MAX} caracteres`;

/** Contraseña nueva o de ingreso: mínimo 8, máximo {@link PASSWORD_MAX}. */
const passwordSchema = z
  .string()
  .min(8, { message: "La contraseña debe tener al menos 8 caracteres" })
  .max(PASSWORD_MAX, { message: MSG_PASSWORD_MAX });

export const signInSchema = z.object({
  email: authEmailSchema,
  password: passwordSchema,
});

/** Registration: validate like sign-in but keep the trimmed raw string for `display_email` (no dot-strip transform). */
export const registerEmailSchema = z
  .string()
  .trim()
  .pipe(z.email({ message: MSG_INVALID_EMAIL }))
  .superRefine((val, ctx) => {
    const r = tryNormalizeEmailForIdentity(val);
    if (!r.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: r.message,
      });
    }
  });

/** Una política aceptada en un formulario: su clave y la versión que se mostró (milestone 19). */
export const policyAcceptanceSchema = z.object({
  key: z.string().min(1).max(64),
  version: z.string().min(1).max(32),
});

/** Lo que manda la pantalla `/policies/accept` (milestone 19). */
export const acceptPoliciesSchema = z.object({
  accepted: z.array(policyAcceptanceSchema).min(1).max(20),
});

export const registerSchema = z
  .object({
    email: registerEmailSchema,
    password: passwordSchema,
    passwordConfirmation: passwordSchema,
    captcha: z
      .string()
      .min(1, { message: "Por favor completá la verificación de seguridad" }),
    /**
     * Las políticas que la persona tildó en el formulario (milestone 19), con la versión que
     * vio. El servidor no confía en esta lista: la compara con lo que de verdad hay que
     * aceptar (`checkSubmittedAcceptances`) y registra versión + hash del registro.
     */
    acceptedPolicies: z
      .array(policyAcceptanceSchema, {
        error: "Tenés que aceptar las políticas para crear la cuenta",
      })
      .max(20),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Las contraseñas no coinciden",
    path: ["passwordConfirmation"],
  });

export const resetSchema = z.object({
  email: authEmailSchema,
  captcha: z
    .string()
    .min(1, { message: "Por favor completá la verificación de seguridad" }),
});

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirmation: passwordSchema,
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Las contraseñas no coinciden",
    path: ["passwordConfirmation"],
  });

/**
 * Recuperar la cuenta con un código de recuperación (milestone 17): email + código +
 * contraseña nueva. Con captcha, igual que el reset por email: es un endpoint público que
 * cambia contraseñas. El formato del código se valida en el servidor
 * (`normalizeRecoveryCode`), así el mensaje de error no distingue "mal tipeado" de "no
 * existe".
 */
export const recoverySchema = z
  .object({
    email: authEmailSchema,
    code: z.string().trim().min(1, { message: "Ingresá un código" }),
    password: passwordSchema,
    passwordConfirmation: passwordSchema,
    captcha: z
      .string()
      .min(1, { message: "Por favor completá la verificación de seguridad" }),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Las contraseñas no coinciden",
    path: ["passwordConfirmation"],
  });
