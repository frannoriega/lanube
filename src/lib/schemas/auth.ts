import z from "zod";

export const signInSchema = z.object({
  email: z.email({ message: "Por favor ingresa un email válido" }),
  password: z
    .string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
});

export const registerSchema = z
  .object({
    email: z.email({ message: "Por favor ingresa un email válido" }),
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
  email: z.email({ message: "Por favor ingresa un email válido" }),
  captcha: z.string().min(1, { message: "Por favor completá la verificación de seguridad" }),
});

export const newPasswordSchema = z.object({
  password: z.string().min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
  passwordConfirmation: z.string().min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: "Las contraseñas no coinciden",
  path: ["passwordConfirmation"],
});
