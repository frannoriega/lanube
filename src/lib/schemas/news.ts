import z from "zod";

/**
 * Author-facing input for creating/editing a Noticias post. `status` is deliberately
 * narrow here — only the transitions an author can make directly (save a draft, or
 * submit/resubmit for review). Approve/reject go through a separate decision schema
 * below, since they're a different actor's action with a different permission.
 *
 * This is also the only schema a plain `news:manage` author ever gets for `PUT` — once a
 * post is PUBLISHED, they can't write to it directly anymore at all (they propose a
 * change via `newsPostRequestSchema` instead), so there's no "amend" variant.
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
  // Required: every post needs a cover image. Accepts an absolute http(s) URL
  // (Vercel Blob / custom host) or a root-relative path (local dev provider).
  coverImageUrl: z
    .string({ message: "La imagen de portada es obligatoria" })
    .min(1, { message: "La imagen de portada es obligatoria" })
    .refine((v) => /^https?:\/\//.test(v) || v.startsWith("/"), {
      message: "URL de imagen inválida",
    }),
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

/**
 * Approve or reject a PENDING_REVIEW post, *or* a pending EDIT/PAUSE/DELETE request
 * against a PUBLISHED one — `decideNewsPost` figures out which from the post's current
 * state. `reason` is shown to the author either way, but only *required* on rejection —
 * the author needs to know what to fix/reconsider before trying again; an approval is
 * self-explanatory.
 */
export const newsPostDecisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    reason: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((v) => v.decision !== "REJECTED" || !!v.reason, {
    message: "El motivo es obligatorio para rechazar una nota",
    path: ["reason"],
  });

export type NewsPostDecisionInput = z.infer<typeof newsPostDecisionSchema>;

/**
 * A plain `news:manage` author's request against their own PUBLISHED post — an EDIT
 * (staged content, applied only on approval), a PAUSE, or a DELETE. `content` carries the
 * proposed field values for EDIT and is meaningless (and rejected) for PAUSE/DELETE, which
 * are just an intent plus an optional note explaining why.
 */
export const newsPostRequestContentSchema = z.object({
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
    .string({ message: "La imagen de portada es obligatoria" })
    .min(1, { message: "La imagen de portada es obligatoria" })
    .refine((v) => /^https?:\/\//.test(v) || v.startsWith("/"), {
      message: "URL de imagen inválida",
    }),
});

export type NewsPostRequestContent = z.infer<
  typeof newsPostRequestContentSchema
>;

export const newsPostRequestSchema = z
  .object({
    action: z.enum(["EDIT", "PAUSE", "DELETE"]),
    reason: z.string().trim().max(1000).optional().nullable(),
    content: newsPostRequestContentSchema.optional(),
  })
  .refine((v) => v.action !== "EDIT" || !!v.content, {
    message: "Falta el contenido propuesto",
    path: ["content"],
  })
  .refine((v) => v.action === "EDIT" || !v.content, {
    message: "Esta acción no lleva contenido propuesto",
    path: ["content"],
  });

export type NewsPostRequestInput = z.infer<typeof newsPostRequestSchema>;
