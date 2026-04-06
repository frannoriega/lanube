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

export const signInSchema = z.object({
  email: authEmailSchema,
  password: z
    .string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
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

export const registerSchema = z
  .object({
    email: registerEmailSchema,
    password: z
      .string()
      .min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
    passwordConfirmation: z
      .string()
      .min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
    captcha: z.string().min(1, { message: "Por favor completá la verificación de seguridad" }),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Las contraseñas no coinciden",
    path: ["passwordConfirmation"],
  });

export const resetSchema = z.object({
  email: authEmailSchema,
  captcha: z.string().min(1, { message: "Por favor completá la verificación de seguridad" }),
});

export const newPasswordSchema = z.object({
  password: z.string().min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
  passwordConfirmation: z.string().min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: "Las contraseñas no coinciden",
  path: ["passwordConfirmation"],
});
