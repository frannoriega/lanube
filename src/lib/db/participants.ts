import { nowMs } from "@/lib/clock";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server";
import { PublicFormField, validateAnswers } from "@/lib/events/answers";
import { prisma } from "@/lib/prisma";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@/generated/prisma/client";

export type FormStatus =
  | "open"
  | "closed"
  | "full"
  | "unpublished"
  | "not_found";

function toPublicFields(
  fields: Array<{
    id: string;
    type: string;
    label: string;
    placeholder: string | null;
    required: boolean;
    options: unknown;
  }>,
): PublicFormField[] {
  return fields.map((f) => ({
    id: f.id,
    type: f.type,
    label: f.label,
    placeholder: f.placeholder,
    required: f.required,
    options: Array.isArray(f.options) ? (f.options as string[]) : null,
  }));
}

async function resolveCapacity(event: {
  capacity: number | null;
  resource: { fungibleResource: { capacity: number } | null };
}): Promise<number> {
  return event.capacity ?? event.resource.fungibleResource?.capacity ?? 0;
}

export interface PublicFormView {
  status: FormStatus;
  slug: string;
  /** Participant-facing event name (the internal form name is never exposed). */
  eventName: string;
  /** Participant-facing event description. */
  eventDescription: string | null;
  eventImageUrl: string | null;
  fields: PublicFormField[];
  spotsLeft: number | null;
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
          status: true,
          endTime: true,
          recurrenceEnd: true,
          resource: {
            select: { fungibleResource: { select: { capacity: true } } },
          },
          _count: { select: { participants: { where: { cancelled: false } } } },
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
  if (eventForm.event.status !== "PUBLISHED") status = "unpublished";
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
    fields: toPublicFields(eventForm.form.fields),
    spotsLeft,
  };
}

export interface SubmitResult {
  ok: boolean;
  status?: FormStatus;
  errors?: Record<string, string>;
  message?: string;
  token?: string;
  eventName?: string;
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
            status: true,
            endTime: true,
            recurrenceEnd: true,
            resource: {
              select: { fungibleResource: { select: { capacity: true } } },
            },
            _count: {
              select: { participants: { where: { cancelled: false } } },
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
    if (eventForm.event.status !== "PUBLISHED")
      return { ok: false, status: "unpublished" };
    if (lastOccurrence < now) return { ok: false, status: "closed" };
    if (Number(eventForm.opensAt) > now || now > Number(eventForm.closesAt))
      return { ok: false, status: "closed" };

    const capacity = await resolveCapacity(eventForm.event);
    if (capacity > 0 && eventForm.event._count.participants >= capacity)
      return { ok: false, status: "full" };

    const fields = toPublicFields(eventForm.form.fields);
    const { ok, errors } = validateAnswers(fields, answers);
    if (!ok) return { ok: false, errors };

    // Keep only known field answers.
    const cleaned: Record<string, unknown> = {};
    for (const f of fields) {
      if (answers[f.id] !== undefined) cleaned[f.id] = answers[f.id];
    }

    const existing = await tx.eventParticipant.findUnique({
      where: { eventId_email: { eventId: eventForm.event.id, email } },
    });

    if (existing && !existing.cancelled) {
      return {
        ok: false,
        message: "Ya estás inscripto con ese email",
      };
    }

    const token = createId();
    if (existing) {
      // Re-activate a previously cancelled registration.
      await tx.eventParticipant.update({
        where: { id: existing.id },
        data: {
          cancelled: false,
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
          answers: cleaned as Prisma.InputJsonValue,
        },
      });
    }

    return { ok: true, token, eventName: eventForm.event.name };
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
    fields: instance ? toPublicFields(instance.fields) : [],
    answers: participant.answers as Record<string, unknown>,
    cancelled: participant.cancelled,
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
              form: { select: { fields: { orderBy: { order: "asc" } } } },
            },
          },
        },
      },
    },
  });
  if (!participant) return { ok: false, message: "No encontrado" };
  if (participant.cancelled)
    return { ok: false, message: "Inscripción cancelada" };

  const fields = participant.event.form?.form
    ? toPublicFields(participant.event.form.form.fields)
    : [];
  const { ok, errors } = validateAnswers(fields, answers);
  if (!ok) return { ok: false, errors };

  const cleaned: Record<string, unknown> = {};
  for (const f of fields) {
    if (answers[f.id] !== undefined) cleaned[f.id] = answers[f.id];
  }

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
    data: { cancelled: true },
  });
  return { ok: true };
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
    where: { email: normalized, cancelled: false },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      event: {
        select: {
          id: true,
          name: true,
          eventType: true,
          startTime: true,
          endTime: true,
          recurrenceEnd: true,
          resource: { select: { name: true } },
        },
      },
    },
  });
  return participations.map((p) => ({
    registeredAt: p.createdAt,
    ...p.event,
  }));
}
