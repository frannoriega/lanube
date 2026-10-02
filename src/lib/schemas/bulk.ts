import z from "zod";

/**
 * Cuerpo de las acciones en lote de eventos y noticias (milestone 16): los ids marcados con
 * los checkboxes de la lista y qué hacer con todos ellos.
 *
 * - `delete`: cancela los eventos (baja lógica) / elimina las notas.
 * - `feature` / `unfeature`: destaca o quita de destacados en el landing.
 *
 * El límite (100) es el de una página holgada: la selección nunca cruza páginas.
 */
export const bulkActionSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, "Elegí al menos un elemento")
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "La lista tiene elementos repetidos",
    }),
  action: z.enum(["delete", "feature", "unfeature"]),
});

export type BulkActionInput = z.infer<typeof bulkActionSchema>;
export type BulkAction = BulkActionInput["action"];

/** Resultado de una acción en lote: cuántos se tocaron y cuántos se saltearon (y por qué). */
export interface BulkActionResult {
  done: number;
  skipped: { id: string; reason: string }[];
}
