import z from "zod";

/**
 * Author-facing input for creating/editing a Noticias post. `status` is deliberately
 * narrow here — only the transitions an author can make directly (save a draft, or
 * submit/resubmit for review). Approve/reject go through a separate decision schema
 * below, since they're a different actor's action with a different permission.
 */
export const newsPostInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "El título es obligatorio" })
    .max(160),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
      message: "Solo minúsculas, números y guiones (ej: charla-de-robotica)",
    }),
  summary: z
    .string()
    .trim()
    .min(1, { message: "El resumen es obligatorio" })
    .max(200),
  body: z
    .string()
    .trim()
    .min(1, { message: "El contenido es obligatorio" })
    .max(20000),
  coverImageUrl: z
    .string()
    .refine((v) => /^https?:\/\//.test(v) || v.startsWith("/"), {
      message: "URL de imagen inválida",
    })
    .optional()
    .nullable(),
  isFeatured: z.boolean(),
  featuredOrder: z.number().int().min(0),
  /** Only the transitions an author drives directly. */
  status: z.enum(["DRAFT", "PENDING_REVIEW"]),
});

export type NewsPostInput = z.infer<typeof newsPostInputSchema>;

/**
 * Admin/Superadmin-only input for publishing directly (bypassing review — they
 * don't review their own work) — the same fields, but `status` also allows
 * `PUBLISHED`/`PAUSED`. Enforced by the news:approve permission at the route,
 * not by this schema alone.
 */
export const newsPostAdminInputSchema = newsPostInputSchema.extend({
  status: z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "PAUSED"]),
});

export type NewsPostAdminInput = z.infer<typeof newsPostAdminInputSchema>;

/** Approve or reject a PENDING_REVIEW post. `reason` is shown to the author either way. */
export const newsPostDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export type NewsPostDecisionInput = z.infer<typeof newsPostDecisionSchema>;
