import z from "zod";

/** Superadmin configuration inputs (spaces, resources, reservation types). */

/** A single FAQ entry (question + markdown answer) shown on the public "Espacios" page. */
export const spaceFaqSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, { message: "La pregunta es obligatoria" })
    .max(200),
  answer: z
    .string()
    .trim()
    .min(1, { message: "La respuesta es obligatoria" })
    .max(2000),
});

export type SpaceFaqInput = z.infer<typeof spaceFaqSchema>;

export const spaceInputSchema = z.object({
  name: z.string().trim().min(1, { message: "El nombre es obligatorio" }),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
      message: "Solo minúsculas, números y guiones (ej: sala-de-reuniones)",
    }),
  description: z
    .string()
    .trim()
    .min(1, { message: "La descripción es obligatoria" })
    .max(500),
  // Long-form markdown shown on the public "Espacios" page. Optional — an empty string
  // normalizes to null in the API layer.
  longDescription: z.string().trim().max(5000).optional().nullable(),
  faqs: z.array(spaceFaqSchema).max(30).optional(),
  capacity: z
    .number()
    .int()
    .positive({ message: "La capacidad debe ser positiva" }),
  isExclusive: z.boolean(),
  isReservable: z.boolean(),
  isFeatured: z.boolean(),
  displayOrder: z.number().int().min(0),
  iconName: z.string().trim().optional().nullable(),
  imageUrl: z
    .string()
    .refine((v) => /^https?:\/\//.test(v) || v.startsWith("/"), {
      message: "URL de imagen inválida",
    })
    .optional()
    .nullable(),
});

export type SpaceInput = z.infer<typeof spaceInputSchema>;

export const resourceInputSchema = z.object({
  name: z.string().trim().min(1, { message: "El nombre es obligatorio" }),
  serialNumber: z.string().trim().max(100).optional().nullable(),
});

export type ResourceInput = z.infer<typeof resourceInputSchema>;

export const reservationTypeInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "El nombre es obligatorio" })
    .max(80),
  displayOrder: z.number().int().min(0),
});

export type ReservationTypeInput = z.infer<typeof reservationTypeInputSchema>;

/** Accepts absolute (http/https) or root-relative URLs. */
const urlLike = (message: string) =>
  z
    .string()
    .trim()
    .min(1, { message })
    .refine((v) => /^https?:\/\//.test(v) || v.startsWith("/"), {
      message: "URL inválida",
    });

/** Superadmin-editable public contact info (single site-config row). */
export const siteConfigInputSchema = z.object({
  addressText: z
    .string()
    .trim()
    .min(1, { message: "La dirección es obligatoria" })
    .max(200),
  addressUrl: urlLike("El enlace del mapa es obligatorio"),
  email: z.string().trim().email({ message: "Email inválido" }),
  phoneText: z
    .string()
    .trim()
    .min(1, { message: "El teléfono es obligatorio" })
    .max(40),
  phoneClickable: z
    .string()
    .trim()
    .regex(/^\+?[0-9]+$/, {
      message: "Solo dígitos, opcionalmente con prefijo + (ej: +5493442550836)",
    }),
  instagramUrl: urlLike("El enlace de Instagram es obligatorio"),
  instagramText: z.string().trim().min(1).max(60),
  githubUrl: urlLike("El enlace de GitHub es obligatorio"),
  githubText: z.string().trim().min(1).max(60),
});

export type SiteConfigInput = z.infer<typeof siteConfigInputSchema>;
