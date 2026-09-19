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

/** "MM-DD", e.g. "09-25". Day-of-month bounds aren't validated per-month (Feb 30 slips
 * through) — acceptable for a landing decoration, not worth a full calendar check. */
const monthDaySchema = z
  .string()
  .trim()
  .regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: "Formato MM-DD (ej: 09-25)",
  });

/** Space-separated emoji, at least one, capped so the shower stays a handful of kinds. */
const emojiListSchema = z
  .string()
  .trim()
  .min(1, { message: "Agregá al menos un emoji" })
  .refine((v) => v.trim().split(/\s+/).length <= 12, {
    message: "Máximo 12 emojis distintos",
  });

export const landingThemeInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: "El nombre es obligatorio" })
      .max(80),
    isEnabled: z.boolean(),
    priority: z.number().int().min(0).max(100),
    recurring: z.boolean(),
    startMonthDay: monthDaySchema.optional().nullable(),
    endMonthDay: monthDaySchema.optional().nullable(),
    startDate: z.number().int().optional().nullable(),
    endDate: z.number().int().optional().nullable(),
    entranceEffect: z.enum(["NONE", "EMOJI_SHOWER"]),
    emojiList: emojiListSchema.optional().nullable(),
    particleCount: z.number().int().min(5).max(150).optional().nullable(),
    heroEyebrowOverride: z.string().trim().max(120).optional().nullable(),
    heroKeywords: z
      .string()
      .trim()
      .max(300)
      .refine((v) => v.split(",").filter((k) => k.trim()).length <= 20, {
        message: "Máximo 20 palabras/frases",
      })
      .optional()
      .nullable(),
    heroKeywordsMode: z.enum(["APPEND", "REPLACE"]),
  })
  .refine((v) => !v.recurring || (!!v.startMonthDay && !!v.endMonthDay), {
    message: "Definí el inicio y fin del período recurrente",
    path: ["startMonthDay"],
  })
  .refine((v) => v.recurring || (v.startDate != null && v.endDate != null), {
    message: "Definí el rango de fechas",
    path: ["startDate"],
  })
  .refine(
    (v) =>
      v.recurring ||
      v.startDate == null ||
      v.endDate == null ||
      v.startDate <= v.endDate,
    {
      message: "La fecha de inicio debe ser anterior a la de fin",
      path: ["endDate"],
    },
  )
  .refine((v) => v.entranceEffect !== "EMOJI_SHOWER" || !!v.emojiList, {
    message: "Elegí al menos un emoji para la lluvia",
    path: ["emojiList"],
  });

export type LandingThemeInput = z.infer<typeof landingThemeInputSchema>;
