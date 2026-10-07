import { nowMs } from "@/lib/clock";
import { DomainError } from "@/lib/errors";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server";
import { PublicFormField } from "@/lib/events/answers";
import {
  type FlatFieldInput,
  flatFieldsToSchema,
  parseFormSchema,
  pruneAnswers,
  schemaToPublicFields,
  validateForm,
} from "@/lib/events/form-engine";
import {
  collectUploadedFiles,
  mapUploadedFiles,
} from "@/lib/events/form-files";
import type { FormSchema, UploadedFile } from "@/lib/events/form-schema";
import {
  editLinkExpired,
  generateEditToken,
  hashEditToken,
} from "@/lib/events/edit-token";
import { verifyUploadedFile } from "@/lib/events/upload-signing";
import { weekdaysFromRrule } from "@/lib/db/events";
import { prisma } from "@/lib/prisma";
import {
  ALREADY_REGISTERED_MESSAGE,
  blocksReRegistration,
  DECISION_SOURCE_STATUSES,
  reapprovalFits,
  SPOT_HOLDING_STATUSES,
} from "@/lib/constants/participants";
import { ParticipantStatus } from "@/types/prisma";
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

/** Mensaje cuando una respuesta trae un archivo que no salió de nuestra subida. */
const INVALID_FILE_MESSAGE =
  "Uno de los archivos adjuntos no es válido. Volvé a subirlo.";

/**
 * Cambia cada descriptor de archivo de la respuesta por uno verificado (milestone 25, S2):
 * - si ya estaba guardado en esta inscripción (`trusted`, misma `url`), se usa **el guardado**
 *   — así una edición no puede cambiarle el nombre o el tipo, y las filas anteriores a la firma
 *   siguen siendo editables;
 * - si no, tiene que traer una firma válida para este evento (`verifyUploadedFile`).
 * Devuelve `null` si algún archivo no pasa.
 */
function verifiedAnswerFiles(
  answers: unknown,
  eventId: string,
  trusted: UploadedFile[] = [],
): Record<string, unknown> | null {
  const stored = new Map(trusted.map((f) => [f.url, f]));
  return mapUploadedFiles(answers, (file) => {
    const kept = stored.get(file.url);
    if (kept) return kept;
    return verifyUploadedFile(file, eventId) ? file : null;
  }) as Record<string, unknown> | null;
}

async function resolveCapacity(event: {
  capacity: number | null;
  space: { capacity: number | null } | null;
}): Promise<number> {
  return event.capacity ?? event.space?.capacity ?? 0;
}

export interface PublicFormView {
  status: FormStatus;
  slug: string;
  /** Id del evento (público: es el de `/events/[id]`). Ata la firma de los archivos subidos. */
  eventId: string;
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
    eventId: eventForm.event.id,
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
    // Serializa las inscripciones de este formulario. El chequeo de capacidad de más abajo es
    // un leer-y-después-escribir, y con el READ COMMITTED por defecto de PostgreSQL dos envíos
    // concurrentes leen los dos `capacity - 1` y los dos insertan — se sobrevende justo cuando
    // el evento es lo bastante buscado para que los últimos lugares se disputen
    // (milestone-12 D10).
    //
    // `@@unique([eventId, email])` no ayuda: evita *personas* duplicadas, no personas de más.
    // Un advisory lock con alcance de transacción es la corrección correcta más barata acá: no
    // necesita columna extra, se libera al commitear o al hacer rollback, y se compone con la
    // transacción que ya envuelve esto. Se indexa por el slug (hasheado al bigint que pide la
    // API de locks) porque es lo que identifica al formulario antes de leer la fila del evento.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`event-form:${slug}`}, 0))`;

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

    // Drop answers for hidden branches + unknown fields, then accept only files our own upload
    // signed for this event (milestone 25, S2).
    const cleaned = verifiedAnswerFiles(
      pruneAnswers(schema, answers),
      eventForm.event.id,
    );
    if (!cleaned) return { ok: false, message: INVALID_FILE_MESSAGE };

    const existing = await tx.eventParticipant.findUnique({
      where: { eventId_email: { eventId: eventForm.event.id, email } },
    });

    // Una inscripción activa (PENDING/APPROVED) o rechazada por un admin frena el envío sin
    // tocar la fila; solo una CANCELLED se reactiva. Mismo mensaje en los dos casos, para no
    // revelar quién fue rechazado (milestone 25, S5).
    if (
      existing &&
      blocksReRegistration(existing.status as ParticipantStatus)
    ) {
      return { ok: false, message: ALREADY_REGISTERED_MESSAGE };
    }

    // Manual-approval events start registrations as PENDING; auto events approve immediately.
    const initialStatus = eventForm.event.requiresApproval
      ? ParticipantStatus.PENDING
      : ParticipantStatus.APPROVED;

    let participantId: string;
    if (existing) {
      // Reactiva una inscripción que la propia persona canceló (la única que llega acá).
      await tx.eventParticipant.update({
        where: { id: existing.id },
        data: {
          status: initialStatus,
          decisionReason: null,
          decidedAt: null,
          displayEmail,
          answers: cleaned as Prisma.InputJsonValue,
        },
      });
      participantId = existing.id;
    } else {
      const created = await tx.eventParticipant.create({
        data: {
          eventId: eventForm.event.id,
          email,
          displayEmail,
          status: initialStatus,
          answers: cleaned as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      participantId = created.id;
    }
    // El enlace del correo de confirmación: en la misma transacción que la inscripción, así no
    // queda una inscripción sin enlace ni un enlace sin inscripción.
    const token = await issueEditToken(participantId, tx);

    return {
      ok: true,
      token,
      eventName: eventForm.event.name,
      requiresApproval: eventForm.event.requiresApproval,
    };
  });
}

/**
 * Emite un enlace de edición nuevo para una inscripción y devuelve el token **en claro**, que
 * solo debe ir al correo (milestone 25, S5). En la base queda únicamente su SHA-256. Los tokens
 * anteriores siguen valiendo: cada correo con enlace llama a esto y ninguno invalida a otro.
 */
export async function issueEditToken(
  participantId: string,
  db: Pick<Prisma.TransactionClient, "eventParticipantEditToken"> = prisma,
): Promise<string> {
  const token = generateEditToken();
  await db.eventParticipantEditToken.create({
    data: { participantId, tokenHash: hashEditToken(token) },
  });
  return token;
}

/**
 * Por qué un enlace de edición no sirve: `invalid` = no existe (mal copiado, o de antes de
 * borrar la inscripción); `expired` = el evento ya terminó (vencen todos sus enlaces).
 */
export type EditLinkProblem =
  | { state: "invalid" }
  | { state: "expired"; eventName: string };

/** Resuelve un token que llega en la URL a la inscripción, hasheándolo para buscarlo. */
async function resolveEditToken(
  token: string,
): Promise<{ state: "ok"; participantId: string } | EditLinkProblem> {
  const row = await prisma.eventParticipantEditToken.findUnique({
    where: { tokenHash: hashEditToken(token) },
    select: {
      participantId: true,
      participant: {
        select: {
          event: {
            select: { name: true, endTime: true, recurrenceEnd: true },
          },
        },
      },
    },
  });
  if (!row) return { state: "invalid" };
  const { event } = row.participant;
  if (editLinkExpired(event, nowMs()))
    return { state: "expired", eventName: event.name };
  return { state: "ok", participantId: row.participantId };
}

/** Mensaje para la API cuando el enlace ya no sirve (la página muestra una pantalla propia). */
export const EDIT_LINK_GONE_MESSAGE =
  "Este enlace ya no es válido, o el evento ya terminó.";

/** Participant registration loaded by its edit token, with the form to render. */
export async function getParticipantByToken(token: string) {
  const resolved = await resolveEditToken(token);
  if (resolved.state !== "ok") return resolved;
  const participant = await prisma.eventParticipant.findUniqueOrThrow({
    where: { id: resolved.participantId },
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
  const instance = participant.event.form?.form;
  return {
    state: "ok" as const,
    eventId: participant.eventId,
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
): Promise<{
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
  /** El enlace no existe o venció: la ruta responde 410 y el formulario recarga la página. */
  linkGone?: boolean;
}> {
  const resolved = await resolveEditToken(token);
  if (resolved.state !== "ok")
    return { ok: false, linkGone: true, message: EDIT_LINK_GONE_MESSAGE };
  const participant = await prisma.eventParticipant.findUniqueOrThrow({
    where: { id: resolved.participantId },
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
  if (participant.status === ParticipantStatus.CANCELLED)
    return { ok: false, message: "Inscripción cancelada" };
  if (participant.status === ParticipantStatus.REJECTED)
    return { ok: false, message: "Inscripción rechazada" };

  const schema = participant.event.form?.form
    ? formSchema(participant.event.form.form)
    : { version: 1 as const, nodes: [] };
  const { ok, errors } = validateForm(schema, answers);
  if (!ok) return { ok: false, errors };

  // Archivos: los ya guardados en esta inscripción se conservan tal cual; los nuevos tienen que
  // venir firmados por nuestra subida (milestone 25, S2).
  const cleaned = verifiedAnswerFiles(
    pruneAnswers(schema, answers),
    participant.eventId,
    collectUploadedFiles(participant.answers),
  );
  if (!cleaned) return { ok: false, message: INVALID_FILE_MESSAGE };

  await prisma.eventParticipant.update({
    where: { id: participant.id },
    data: { answers: cleaned as Prisma.InputJsonValue },
  });
  return { ok: true };
}

/**
 * Baja voluntaria mediante el token de edición del participante. Solo se puede cancelar una
 * inscripción que hoy ocupa un lugar: antes aceptaba cualquier estado, así que una inscripción
 * REJECTED podía pasar a CANCELLED — reescribiendo la decisión de un admin como si fuera
 * la elección del participante, y ensuciando la lista sin ningún beneficio
 * (milestone-12, Parte 4).
 */
export async function cancelParticipant(
  token: string,
): Promise<{ ok: boolean; message?: string; linkGone?: boolean }> {
  const resolved = await resolveEditToken(token);
  if (resolved.state !== "ok")
    return { ok: false, linkGone: true, message: EDIT_LINK_GONE_MESSAGE };
  const participant = await prisma.eventParticipant.findUniqueOrThrow({
    where: { id: resolved.participantId },
  });
  if (participant.status === ParticipantStatus.CANCELLED) {
    return { ok: true };
  }
  if (
    !SPOT_HOLDING_STATUSES.includes(participant.status as ParticipantStatus)
  ) {
    return { ok: false, message: "Esta inscripción no está activa" };
  }
  await prisma.eventParticipant.update({
    where: { id: participant.id },
    data: { status: ParticipantStatus.CANCELLED },
  });
  return { ok: true };
}

/**
 * Inscripciones de un correo a las que todavía les sirve un enlace: ocupan un lugar
 * (PENDING/APPROVED), el evento no está cancelado y no terminó. Es lo que manda «pedir un enlace
 * nuevo» (milestone 25, S5). Una REJECTED/CANCELLED no se incluye: su enlace solo mostraría el
 * estado, y mandarlo confirmaría a quien tipeó el correo que esa persona estaba inscripta.
 */
export async function listLinkableRegistrations(displayEmail: string) {
  const email = await normalizeEmailForIdentityServer(displayEmail);
  const rows = await prisma.eventParticipant.findMany({
    where: {
      email,
      status: { in: SPOT_HOLDING_STATUSES },
      event: { deletedAt: null },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      displayEmail: true,
      event: { select: { name: true, endTime: true, recurrenceEnd: true } },
    },
  });
  const now = nowMs();
  return rows
    .filter((r) => !editLinkExpired(r.event, now))
    .map((r) => ({
      id: r.id,
      to: r.displayEmail ?? r.email,
      eventName: r.event.name,
    }));
}

/**
 * Borra los enlaces de edición de eventos que ya terminaron (vencidos: `editLinkExpired`).
 * Lo llama el cron diario; es solo limpieza — un enlace vencido ya no sirve aunque siga en la
 * tabla, porque el vencimiento se calcula al usarlo.
 */
export async function pruneExpiredEditTokens(): Promise<number> {
  const now = BigInt(nowMs());
  const { count } = await prisma.eventParticipantEditToken.deleteMany({
    where: {
      participant: {
        event: {
          OR: [
            { recurrenceEnd: { lt: now } },
            { recurrenceEnd: null, endTime: { lt: now } },
          ],
        },
      },
    },
  });
  return count;
}

export interface DecidedParticipant {
  id: string;
  email: string;
  displayEmail: string | null;
}

/**
 * Aprueba o rechaza un lote de inscripciones de un evento (acción masiva del admin). Acotado al
 * evento e idempotente: solo toca las filas cuyo estado está en `DECISION_SOURCE_STATUSES` para
 * esa decisión — aprobar toma PENDING y REJECTED, rechazar toma PENDING y APPROVED; una
 * cancelada nunca se resucita. Devuelve las filas afectadas para que quien llama mande los
 * correos **después** de la escritura (mismo patrón que los avisos de cambios de sesión).
 *
 * **Volver a aprobar a alguien rechazado ocupa un lugar** (milestone 25, seguimiento de S5): se
 * chequea el cupo con la misma resolución que el formulario público y **todo o nada**
 * (`reapprovalFits`) — si no entran todas, `DomainError` 409 y no se toca nada. Toma el mismo
 * advisory lock que `submitForm`, así una inscripción concurrente no puede llevarse el último
 * lugar entre el conteo y la escritura.
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
  const fromStatuses = DECISION_SOURCE_STATUSES[decision];

  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: {
        name: true,
        capacity: true,
        space: { select: { capacity: true } },
        form: { select: { slug: true } },
      },
    });
    if (!event) throw new DomainError("Evento no encontrado", 404);

    // Mismo lock que `submitForm` (por el slug del formulario): serializa el chequeo de cupo de
    // abajo con las inscripciones nuevas.
    if (event.form) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`event-form:${event.form.slug}`}, 0))`;
    }

    const affected = await tx.eventParticipant.findMany({
      where: {
        id: { in: participantIds },
        eventId,
        status: { in: fromStatuses },
      },
      select: { id: true, email: true, displayEmail: true, status: true },
    });

    if (decision === "approve") {
      const reapproving = affected.filter(
        (p) => p.status === ParticipantStatus.REJECTED,
      ).length;
      if (reapproving > 0) {
        const taken = await tx.eventParticipant.count({
          where: { eventId, status: { in: SPOT_HOLDING_STATUSES } },
        });
        const { fits, free } = reapprovalFits({
          capacity: await resolveCapacity(event),
          taken,
          reapproving,
        });
        if (!fits) {
          throw new DomainError(
            `No hay lugar para volver a aprobar a ${reapproving} inscripción(es) rechazada(s): ` +
              `${free === 0 ? "el cupo está lleno" : `quedan ${free} lugar(es)`}. ` +
              "Elegí a quién aprobar o rechazá a otra persona antes.",
            409,
          );
        }
      }
    }

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

    return {
      eventName: event.name,
      participants: affected.map(({ id, email, displayEmail }) => ({
        id,
        email,
        displayEmail,
      })),
    };
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
