import { DATETIME_LOCAL_RE } from "@/modules/events/lib/datetime";
import {
  conditionSchema,
  formSchemaZod,
} from "@/modules/events/lib/form-schema";
import { registerEmailSchema } from "@/lib/schemas/auth";
import { EventStatus, FormFieldType } from "@/types/prisma";
import z from "zod";

/** YYYY-MM-DD calendar date key (interpreted in the admin timezone). */
const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Fecha inválida" });

/** HH:mm 24h time-of-day (admin timezone). */
const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Hora inválida" });

/** Weekday numbers, 0 = Sunday .. 6 = Saturday (matches Date.getDay()). */
export const WEEKDAY_RRULE = [
  "SU",
  "MO",
  "TU",
  "WE",
  "TH",
  "FR",
  "SA",
] as const;

/**
 * Binds a form template to an event. opens/closes are datetime-local strings (admin TZ);
 * the template is cloned into an instance at bind time.
 */
export const eventFormBindingSchema = z
  .object({
    templateId: z.string().min(1, { message: "Elegí un formulario" }),
    // Public link key, generated client-side so the URL is known before the event is saved.
    slug: z.string().min(1),
    opensAt: z.string().regex(DATETIME_LOCAL_RE, { message: "Fecha inválida" }),
    closesAt: z
      .string()
      .regex(DATETIME_LOCAL_RE, { message: "Fecha inválida" }),
  })
  .refine((d) => d.closesAt > d.opensAt, {
    message: "El cierre debe ser posterior a la apertura",
    path: ["closesAt"],
  });

export type EventFormBindingInput = z.infer<typeof eventFormBindingSchema>;

/** Input for creating/updating an event (admin). */
export const eventInputSchema = z
  .object({
    name: z.string().trim().min(1, { message: "El nombre es obligatorio" }),
    description: z
      .string()
      .trim()
      .min(100, {
        message: "La descripción debe tener al menos 100 caracteres",
      })
      .max(2000),
    // Short plain-text blurb for landing/event cards (empty string → stored as null at the DB layer).
    summary: z
      .string()
      .trim()
      .max(200, { message: "El resumen no puede superar los 200 caracteres" })
      .optional()
      .nullable(),
    // Featured events lead the landing section; featuredOrder sorts them (ascending).
    isFeatured: z.boolean(),
    featuredOrder: z.number().int().min(0),
    // Code of a ReservationType row; existence is validated server-side (FK).
    eventType: z.string().trim().min(1, { message: "Elegí un tipo de evento" }),
    // Lifecycle state set by the admin. ENDED is derived, so it's not a valid input.
    status: z.enum(EventStatus),
    spaceId: z.string().min(1, { message: "Elegí un espacio" }),
    startDate: dateKeySchema,
    endDate: dateKeySchema,
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1, { message: "Elegí al menos un día de la semana" }),
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
    capacity: z
      .number()
      .int()
      .positive({ message: "La capacidad debe ser positiva" })
      .optional()
      .nullable(),
    // When true, registrations require admin approval (start PENDING); the capacity then caps
    // how many can register, not the final approved headcount.
    requiresApproval: z.boolean(),
    // Optional cover image URL produced by the upload endpoint. Accepts an absolute
    // http(s) URL (Vercel Blob / custom host) or a root-relative path (local dev provider).
    imageUrl: z
      .string()
      .refine((v) => /^https?:\/\//.test(v) || v.startsWith("/"), {
        message: "URL de imagen inválida",
      })
      .optional()
      .nullable(),
    // Optional form binding: a template to clone + the registration window/publish state.
    form: eventFormBindingSchema.optional().nullable(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "La fecha de fin debe ser igual o posterior a la de inicio",
    path: ["endDate"],
  })
  .refine((d) => d.startTime < d.endTime, {
    message: "La hora de inicio debe ser anterior a la de fin",
    path: ["endTime"],
  })
  .refine((d) => [...new Set(d.weekdays)].length === d.weekdays.length, {
    message: "Días de la semana duplicados",
    path: ["weekdays"],
  });

export type EventInput = z.infer<typeof eventInputSchema>;

/**
 * A staged per-session (occurrence) change, sent with the event save. Keyed by weekday + nominal
 * occurrence date (resolved to a reservation server-side after the recurrence diff), so it survives
 * date-range edits. The reason is **not** per-action: cancels/reschedules share a single batch
 * reason (`sessionReason`), collected once at the end and sent alongside the actions.
 */
export const sessionActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("cancel"),
    weekday: z.number().int().min(0).max(6),
    occurrenceDateMs: z.number().int(),
  }),
  z
    .object({
      kind: z.literal("reschedule"),
      weekday: z.number().int().min(0).max(6),
      occurrenceDateMs: z.number().int(),
      newStartMs: z.number().int(),
      newEndMs: z.number().int(),
    })
    .refine((d) => d.newEndMs > d.newStartMs, {
      message: "El horario de fin debe ser posterior al de inicio",
      path: ["newEndMs"],
    }),
  z.object({
    kind: z.literal("revert"),
    weekday: z.number().int().min(0).max(6),
    occurrenceDateMs: z.number().int(),
  }),
]);

export type SessionActionInput = z.infer<typeof sessionActionSchema>;

/** Does this batch of session actions need a reason? (any cancel/reschedule requires one). */
export function sessionActionsNeedReason(
  actions: Pick<SessionActionInput, "kind">[],
): boolean {
  return actions.some((a) => a.kind === "cancel" || a.kind === "reschedule");
}

/** Field types whose answers come from a fixed option list. */
export const SELECT_FIELD_TYPES = [
  FormFieldType.SINGLE_SELECT,
  FormFieldType.MULTI_SELECT,
] as const;

export const formFieldSchema = z
  .object({
    // Stable id (kept across edits so intra-form condition references + answers stay valid).
    id: z.string().optional(),
    type: z.enum(FormFieldType),
    label: z.string().trim().min(1, { message: "La etiqueta es obligatoria" }),
    placeholder: z.string().trim().max(200).optional().nullable(),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1)).optional().nullable(),
    // Per-type constraints (numeric min/max/step). Stored on the field's node in Form.schema.
    constraints: z
      .object({
        min: z.number().optional().nullable(),
        max: z.number().optional().nullable(),
        step: z.number().positive().optional().nullable(),
      })
      .optional()
      .nullable(),
    // Conditional visibility (branching). Stored on the field's node in Form.schema.
    visibleWhen: conditionSchema.optional().nullable(),
  })
  .superRefine((field, ctx) => {
    const needsOptions = (SELECT_FIELD_TYPES as readonly string[]).includes(
      field.type,
    );
    if (needsOptions && (!field.options || field.options.length < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Agregá al menos una opción",
        path: ["options"],
      });
    }
  });

export type FormFieldInput = z.infer<typeof formFieldSchema>;

/**
 * Admin form-template builder payload: name/description + the form definition as a node tree
 * (supports branching + repeating groups). The flat `formFieldSchema` above is retained for
 * reference/reuse but the builder now sends the full schema.
 */
export const formTemplateSchema = z.object({
  name: z.string().trim().min(1, { message: "El nombre es obligatorio" }),
  description: z.string().trim().max(2000).optional().nullable(),
  schema: formSchemaZod,
});

export type FormTemplateInput = z.infer<typeof formTemplateSchema>;

/** Public participant submission: email (kept raw for displayEmail) + dynamic answers. */
export const participantSubmitSchema = z.object({
  email: registerEmailSchema,
  answers: z.record(z.string(), z.unknown()),
});

export type ParticipantSubmitInput = z.infer<typeof participantSubmitSchema>;

/** Editing an existing registration (no email change — keyed by token). */
export const participantEditSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
});

/**
 * Admin bulk approve/reject of registrations. The optional reason is shared by the whole batch
 * (shown to rejected participants; a blank reason falls back to a neutral generic message).
 */
export const participantDecisionSchema = z.object({
  participantIds: z
    .array(z.string().min(1))
    .min(1, { message: "Elegí al menos un participante" }),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export type ParticipantDecisionInput = z.infer<
  typeof participantDecisionSchema
>;
