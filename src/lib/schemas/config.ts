import z from "zod";

/** Superadmin configuration inputs (spaces, resources, reservation types). */

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
