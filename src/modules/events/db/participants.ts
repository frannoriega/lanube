import { nowMs } from "@/lib/clock";
import { DomainError } from "@/lib/errors";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server";
import { PublicFormField } from "@/modules/events/lib/answers";
import {
  type FlatFieldInput,
  flatFieldsToSchema,
  parseFormSchema,
  pruneAnswers,
  schemaToPublicFields,
  validateForm,
} from "@/modules/events/lib/form-engine";
import type { FormSchema } from "@/modules/events/lib/form-schema";
import { weekdaysFromRrule } from "@/modules/events/db/events";
import { prisma } from "@/lib/prisma";
import { SPOT_HOLDING_STATUSES } from "@/lib/constants/participants";
import { ParticipantStatus } from "@/types/prisma";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@/generated/prisma/client";

export type FormStatus =
  | "open"
  | "closed"
  | "full"
  | "unpublished"
  | "not_found";

interface FormRow {
  schema: Prisma.JsonValue | null;
  fields: Array<{
    id: string;
    type: string;
    label: string;
    placeholder: string | null;
    required: boolean;
    options: unknown;
    config?: unknown;
  }>;
}

function rowToFlat(f: FormRow["fields"][number]): FlatFieldInput {
  return {
    id: f.id,
    type: f.type,
    label: f.label,
    placeholder: f.placeholder,
    required: f.required,
    options: Array.isArray(f.options) ? (f.options as string[]) : null,
    constraints: (f.config as FlatFieldInput["constraints"]) ?? null,
  };
}

/**
 * A form's definition, sourced from `schema` (the source of truth). Falls back to the legacy flat
 * `fields` only if `schema` is null (e.g. a form created by old code during a deploy window before
 * the backfill/dual-write applied).
 */
function formSchema(form: FormRow): FormSchema {
  return form.schema != null
    ? parseFormSchema(form.schema)
    : flatFieldsToSchema(form.fields.map(rowToFlat));
}

/** Flat participant-facing field list for the renderer. */
function formFields(form: FormRow): PublicFormField[] {
  return schemaToPublicFields(formSchema(form));
}

async function resolveCapacity(event: {
  capacity: number | null;
  space: { capacity: number } | null;
}): Promise<number> {
  return event.capacity ?? event.space?.capacity ?? 0;
}

export interface PublicFormView {
  status: FormStatus;
  slug: string;
  /** Participant-facing event name (the internal form name is never exposed). */
  eventName: string;
  /** Participant-facing event description. */
  eventDescription: string | null;
  eventImageUrl: string | null;
  /** Display name of the reservation type (from the catalog table). */
  eventTypeName: string;
  /** Name of the space the event runs in (participant-facing location). */
  resourceName: string;
  /** Weekday numbers (0=Sun..6=Sat) the event recurs on. */
  weekdays: number[];
  fields: PublicFormField[];
  /** Full node tree for the recursive renderer (groups + branching). */
  schema: FormSchema;
  spotsLeft: number | null;
  /** True => registering does not guarantee a spot; an admin approves each registration. */
  requiresApproval: boolean;
}

/** Loads a form by public slug with its computed availability state. */
export async function getPublicForm(
  slug: string,
): Promise<PublicFormView | null> {
  const eventForm = await prisma.eventForm.findUnique({
    where: { slug },
    include: {
      form: { include: { fields: { orderBy: { order: "asc" } } } },
      event: {
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          capacity: true,
          requiresApproval: true,
          status: true,
          deletedAt: true,
          endTime: true,
          recurrenceEnd: true,
          rrule: true,
          type: { select: { name: true } },
          space: { select: { capacity: true, name: true } },
          _count: {
            select: {
              participants: {
                where: { status: { in: SPOT_HOLDING_STATUSES } },
              },
            },
          },
        },
      },
    },
  });
  if (!eventForm) return null;

  const capacity = await resolveCapacity(eventForm.event);
  const taken = eventForm.event._count.participants;
  const spotsLeft = capacity > 0 ? Math.max(0, capacity - taken) : null;

  const now = nowMs();
  const lastOccurrence = Number(
    eventForm.event.recurrenceEnd ?? eventForm.event.endTime,
  );
  let status: FormStatus;
  if (
    eventForm.event.deletedAt != null ||
    eventForm.event.status !== "PUBLISHED"
  )
    status = "unpublished";
  else if (lastOccurrence < now) status = "closed";
  else if (Number(eventForm.opensAt) > now || now > Number(eventForm.closesAt))
    status = "closed";
  else if (spotsLeft !== null && spotsLeft <= 0) status = "full";
  else status = "open";

  return {
    status,
    slug: eventForm.slug,
    eventName: eventForm.event.name,
    eventDescription: eventForm.event.description,
    eventImageUrl: eventForm.event.imageUrl,
    eventTypeName: eventForm.event.type.name,
    resourceName: eventForm.event.space.name,
    weekdays: weekdaysFromRrule(eventForm.event.rrule),
    fields: formFields(eventForm.form),
    schema: formSchema(eventForm.form),
    spotsLeft,
    requiresApproval: eventForm.event.requiresApproval,
  };
}

export interface SubmitResult {
  ok: boolean;
  status?: FormStatus;
  errors?: Record<string, string>;
  message?: string;
  token?: string;
  eventName?: string;
  /** Whether the event requires manual approval (drives the confirmation copy + email). */
  requiresApproval?: boolean;
}

/** Registers a participant for an event by its form slug. */
export async function submitForm(
  slug: string,
  displayEmail: string,
  answers: Record<string, unknown>,
): Promise<SubmitResult> {
  const email = await normalizeEmailForIdentityServer(displayEmail);

  return prisma.$transaction(async (tx) => {
    const eventForm = await tx.eventForm.findUnique({
      where: { slug },
      include: {
        form: { include: { fields: { orderBy: { order: "asc" } } } },
        event: {
          select: {
            id: true,
            name: true,
            capacity: true,
            requiresApproval: true,
            status: true,
            deletedAt: true,
            endTime: true,
            recurrenceEnd: true,
            space: { select: { capacity: true } },
            _count: {
              select: {
                participants: {
                  where: { status: { in: SPOT_HOLDING_STATUSES } },
                },
              },
            },
          },
        },
      },
    });
    if (!eventForm) return { ok: false, status: "not_found" as FormStatus };

    const now = nowMs();
    const lastOccurrence = Number(
      eventForm.event.recurrenceEnd ?? eventForm.event.endTime,
    );
    if (
      eventForm.event.deletedAt != null ||
      eventForm.event.status !== "PUBLISHED"
    )
      return { ok: false, status: "unpublished" };
    if (lastOccurrence < now) return { ok: false, status: "closed" };
    if (Number(eventForm.opensAt) > now || now > Number(eventForm.closesAt))
      return { ok: false, status: "closed" };

    const capacity = await resolveCapacity(eventForm.event);
    if (capacity > 0 && eventForm.event._count.participants >= capacity)
      return { ok: false, status: "full" };

    const schema = formSchema(eventForm.form);
    const { ok, errors } = validateForm(schema, answers);
    if (!ok) return { ok: false, errors };

    // Drop answers for hidden branches + unknown fields.
    const cleaned = pruneAnswers(schema, answers);

    const existing = await tx.eventParticipant.findUnique({
      where: { eventId_email: { eventId: eventForm.event.id, email } },
    });

    // A row that still holds a spot (PENDING or APPROVED) is an active registration.
    if (
      existing &&
      (existing.status === ParticipantStatus.PENDING ||
        existing.status === ParticipantStatus.APPROVED)
    ) {
      return {
        ok: false,
        message: "Ya estás inscripto con ese email",
      };
    }

    // Manual-approval events start registrations as PENDING; auto events approve immediately.
    const initialStatus = eventForm.event.requiresApproval
      ? ParticipantStatus.PENDING
      : ParticipantStatus.APPROVED;

    const token = createId();
    if (existing) {
      // Re-activate a previously rejected/cancelled registration; clear any prior decision.
      await tx.eventParticipant.update({
        where: { id: existing.id },
        data: {
          status: initialStatus,
          decisionReason: null,
          decidedAt: null,
          displayEmail,
          answers: cleaned as Prisma.InputJsonValue,
          editToken: token,
        },
      });
    } else {
      await tx.eventParticipant.create({
        data: {
          eventId: eventForm.event.id,
          email,
          displayEmail,
          editToken: token,
          status: initialStatus,
          answers: cleaned as Prisma.InputJsonValue,
        },
      });
    }

    return {
      ok: true,
      token,
      eventName: eventForm.event.name,
      requiresApproval: eventForm.event.requiresApproval,
    };
  });
}

/** Participant registration loaded by its edit token, with the form to render. */
export async function getParticipantByToken(token: string) {
  const participant = await prisma.eventParticipant.findUnique({
    where: { editToken: token },
    include: {
      event: {
        select: {
          name: true,
          description: true,
          imageUrl: true,
          form: {
            select: {
              form: {
                select: {
                  schema: true,
                  fields: { orderBy: { order: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!participant) return null;
  const instance = participant.event.form?.form;
  return {
    eventName: participant.event.name,
    eventDescription: participant.event.description,
    eventImageUrl: participant.event.imageUrl,
    fields: instance ? formFields(instance) : [],
    schema: instance
      ? formSchema(instance)
      : { version: 1 as const, nodes: [] },
    answers: participant.answers as Record<string, unknown>,
    status: participant.status as ParticipantStatus,
    decisionReason: participant.decisionReason,
    displayEmail: participant.displayEmail,
  };
}

export async function updateParticipantAnswers(
  token: string,
  answers: Record<string, unknown>,
): Promise<{ ok: boolean; errors?: Record<string, string>; message?: string }> {
  const participant = await prisma.eventParticipant.findUnique({
    where: { editToken: token },
    include: {
      event: {
        select: {
          form: {
            select: {
              form: {
                select: {
                  schema: true,
                  fields: { orderBy: { order: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!participant) return { ok: false, message: "No encontrado" };
  if (participant.status === ParticipantStatus.CANCELLED)
    return { ok: false, message: "Inscripción cancelada" };
  if (participant.status === ParticipantStatus.REJECTED)
    return { ok: false, message: "Inscripción rechazada" };

  const schema = participant.event.form?.form
    ? formSchema(participant.event.form.form)
    : { version: 1 as const, nodes: [] };
  const { ok, errors } = validateForm(schema, answers);
  if (!ok) return { ok: false, errors };

  const cleaned = pruneAnswers(schema, answers);

  await prisma.eventParticipant.update({
    where: { editToken: token },
    data: { answers: cleaned as Prisma.InputJsonValue },
  });
  return { ok: true };
}

export async function cancelParticipant(
  token: string,
): Promise<{ ok: boolean; message?: string }> {
  const participant = await prisma.eventParticipant.findUnique({
    where: { editToken: token },
  });
  if (!participant) return { ok: false, message: "No encontrado" };
  await prisma.eventParticipant.update({
    where: { editToken: token },
    data: { status: ParticipantStatus.CANCELLED },
  });
  return { ok: true };
}

export interface DecidedParticipant {
  id: string;
  email: string;
  displayEmail: string | null;
  editToken: string;
}

/**
 * Approves or rejects a batch of an event's registrations (admin bulk action). Scoped to the
 * event for safety and idempotent: only rows currently PENDING or APPROVED are touched (a
 * cancelled registration is never resurrected by a decision). Returns the affected rows so the
 * caller can email them **after** the write — mirroring the session-change notification pattern.
 */
export async function decideParticipants(
  eventId: string,
  participantIds: string[],
  decision: "approve" | "reject",
  reason: string | null,
): Promise<{ eventName: string; participants: DecidedParticipant[] }> {
  const status =
    decision === "approve"
      ? ParticipantStatus.APPROVED
      : ParticipantStatus.REJECTED;
  // Approving only acts on still-pending rows (approving an already-approved one is a no-op and
  // shouldn't re-email); rejecting can revoke a pending or an approved spot.
  const fromStatuses =
    decision === "approve"
      ? [ParticipantStatus.PENDING]
      : SPOT_HOLDING_STATUSES;

  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { name: true },
    });
    if (!event) throw new DomainError("Evento no encontrado", 404);

    const affected = await tx.eventParticipant.findMany({
      where: {
        id: { in: participantIds },
        eventId,
        status: { in: fromStatuses },
      },
      select: { id: true, email: true, displayEmail: true, editToken: true },
    });

    if (affected.length > 0) {
      await tx.eventParticipant.updateMany({
        where: { id: { in: affected.map((p) => p.id) }, eventId },
        data: {
          status,
          decisionReason: reason?.trim() || null,
          decidedAt: BigInt(nowMs()),
        },
      });
    }

    return { eventName: event.name, participants: affected };
  });
}

/** All registrations for an event (admin participants view / export). */
export async function listEventParticipants(eventId: string) {
  return prisma.eventParticipant.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
  });
}

/** Links any participant rows matching a normalized email to a registered user. */
export async function linkParticipantsToUser(
  email: string,
  userId: string,
): Promise<number> {
  const normalized = await normalizeEmailForIdentityServer(email);
  const result = await prisma.eventParticipant.updateMany({
    where: { email: normalized, userId: null },
    data: { userId },
  });
  return result.count;
}

/** Events a registered user participated in, matched by their normalized email. */
export async function getUserEvents(email: string) {
  const normalized = await normalizeEmailForIdentityServer(email);
  const participations = await prisma.eventParticipant.findMany({
    where: { email: normalized, status: { in: SPOT_HOLDING_STATUSES } },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      event: {
        select: {
          id: true,
          name: true,
          eventType: true,
          type: { select: { name: true } },
          startTime: true,
          endTime: true,
          recurrenceEnd: true,
          space: { select: { name: true } },
        },
      },
    },
  });
  return participations.map((p) => ({
    registeredAt: p.createdAt,
    ...p.event,
  }));
}
