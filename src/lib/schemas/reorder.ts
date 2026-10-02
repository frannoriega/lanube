import z from "zod";

/**
 * Cuerpo de los endpoints de reordenamiento masivo (modo "Reordenar", milestone 14): los ids
 * de la lista de arriba hacia abajo, sin repetidos. Cada endpoint decide qué columna escribe
 * con ese orden (`displayOrder`, `priority`, `featuredOrder`).
 */
export const reorderInputSchema = z.object({
  orderedIds: z
    .array(z.string().min(1))
    .min(1, "La lista no puede estar vacía")
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "La lista tiene elementos repetidos",
    }),
});

export type ReorderInput = z.infer<typeof reorderInputSchema>;
