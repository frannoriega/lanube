import { dateKeyFromUnixMs } from "@/lib/admin/admin-timezone";
import { nowMs } from "@/lib/clock";
import { toRawReservation } from "@/lib/db/events";
import {
  formSchema,
  INVALID_FILE_MESSAGE,
  verifiedAnswerFiles,
} from "@/lib/db/participants";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server";
import { DomainError } from "@/lib/errors";
import {
  type CheckInSession,
  checkInRequiresAdmission,
  checkInSessions,
  defaultCheckInSession,
} from "@/lib/events/checkin";
import { pruneAnswers, validateForm } from "@/lib/events/form-engine";
import {
  type FormSchema,
  type ParticipantField,
  participantFields,
} from "@/lib/events/form-schema";
import { syncRegistrationMembers } from "@/lib/db/participantMembers";
import { expandAllEventOccurrences } from "@/lib/events/occurrences";
import { prisma } from "@/lib/prisma";
import { ParticipantSource, ParticipantStatus } from "@/types/prisma";
import { Prisma } from "@/generated/prisma/client";

/**
 * Check-in de eventos en la puerta (milestone 30). Ver
 * `docs/milestones/milestones-30-event-check-in.md`.
 *
 * Reglas que viven acá (las puras están en `src/lib/events/checkin.ts`):
 * - Solo eventos con `checkInEnabled` y no cancelados (`deletedAt`).
 * - Un ingreso es de **una sesión**, identificada por su inicio nominal; la sesión tiene que
 *   existir, no estar cancelada y ser de hoy o anterior.
 * - Registrar el ingreso de una inscripción no aprobada exige `admit: true` y la deja
 *   `APPROVED`, sin chequear cupo ni mandar correo: lo decide quien está en la puerta.
 * - Quien llega sin inscripción completa el formulario del evento (mismas validaciones que la
 *   inscripción pública) y queda `APPROVED` con `source = WALK_IN`, sin chequear cupo ni
 *   ventana de inscripción, y **sin correo** (decisiones del usuario, 2026-11-17). Ocupa un
 *   lugar en las sesiones siguientes como cualquier inscripto.
 * - **Milestone 34:** el ingreso es por **persona** (`EventParticipantMember`): quien inscribe o
 *   cada integrante de un equipo. «Dejar pasar» sigue siendo de la inscripción entera (mira su
 *   estado). Quien llega sin inscripción con su equipo ingresa con todos sus integrantes.
 */

/** El evento como lo necesita la pantalla de check-in. */
export interface CheckInEventView {
  id: string;
  name: string;
  /** El formulario del evento (para registrar a quien llega sin inscripción), o `null`. */
  schema: FormSchema | null;
  /** La forma del participante (milestone 34): columnas y búsqueda de la puerta. */
  participantFields: ParticipantField[];
  sessions: CheckInSession[];
  /** La que la pantalla muestra al abrir (`defaultCheckInSession`). */
  defaultSession: number | null;
}

/** Una persona de una inscripción, como la muestra la puerta (milestone 34). */
export interface CheckInMember {
  id: string;
  role: "PRIMARY" | "MEMBER";
  /** «Integrante 2 — Persona»; null para quien inscribe. */
  label: string | null;
  email: string;
  displayEmail: string;
  /** Datos de la forma del participante (nombre, DNI…), por clave. */
  data: Record<string, unknown>;
  /** Si ingresó a la sesión consultada, y cuándo (ms). */
  checkedInAt: number | null;
}

/** Una inscripción, como la muestra la puerta: estado, origen y sus personas. */
export interface CheckInParticipant {
  id: string;
  email: string;
  displayEmail: string;
  status: ParticipantStatus;
  source: ParticipantSource;
  /** Quien inscribe primero, después los integrantes en el orden del formulario. */
  members: CheckInMember[];
  /** Si **quien inscribe** ingresó a la sesión (compatibilidad con la vista anterior). */
  checkedInAt: number | null;
}

/** Totales de una sesión para el contador de la pantalla. */
export interface CheckInSummary {
  /** Personas de inscripciones aprobadas (por el formulario) — la base contra la que se compara. */
  registeredApproved: number;
  /** Ingresaron, de esas personas. */
  registeredCheckedIn: number;
  /** Personas que ingresaron sin inscripción previa (`WALK_IN`). */
  walkInsCheckedIn: number;
}

async function loadCheckInEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      checkInEnabled: true,
      deletedAt: true,
      form: {
        select: {
          slug: true,
          form: {
            select: {
              schema: true,
              fields: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!event || event.deletedAt != null) {
    throw new DomainError("Evento no encontrado", 404);
  }
  if (!event.checkInEnabled) {
    throw new DomainError("Este evento no tiene el check-in habilitado", 409);
  }
  return event;
}

async function loadSessions(eventId: string): Promise<CheckInSession[]> {
  const reservations = await prisma.reservation.findMany({
    where: { reservableType: "EVENT", reservableId: eventId },
    include: { exceptions: true },
  });
  return checkInSessions(
    expandAllEventOccurrences(reservations.map(toRawReservation)),
    nowMs(),
  );
}

/** La sesión pedida, si existe y admite ingresos; si no, un `DomainError` legible. */
async function openSession(
  eventId: string,
  occurrenceStart: number,
): Promise<CheckInSession> {
  const session = (await loadSessions(eventId)).find(
    (s) => s.occurrenceStart === occurrenceStart,
  );
  if (!session) {
    throw new DomainError(
      "Esa sesión no existe o fue cancelada. Elegí otra.",
      400,
    );
  }
  if (session.state !== "open") {
    throw new DomainError(
      "Todavía no se puede registrar el ingreso a esa sesión: es de un día que no llegó.",
      400,
    );
  }
  return session;
}

/** Evento + sesiones para abrir la pantalla. */
export async function getCheckInEvent(
  eventId: string,
): Promise<CheckInEventView> {
  const event = await loadCheckInEvent(eventId);
  const sessions = await loadSessions(eventId);
  const schema = event.form ? formSchema(event.form.form) : null;
  return {
    id: event.id,
    name: event.name,
    schema,
    participantFields: schema ? participantFields(schema) : [],
    sessions,
    defaultSession:
      defaultCheckInSession(sessions, nowMs())?.occurrenceStart ?? null,
  };
}

/** Lo que se lee de una inscripción para la puerta: sus personas con el ingreso a la sesión. */
function participantInclude(occurrenceStart: number) {
  return {
    members: {
      orderBy: { position: "asc" as const },
      include: {
        checkIns: { where: { occurrenceStart: BigInt(occurrenceStart) } },
      },
    },
  } satisfies Prisma.EventParticipantInclude;
}

type ParticipantRow = Prisma.EventParticipantGetPayload<{
  include: ReturnType<typeof participantInclude>;
}>;

/**
 * La inscripción como la ve la puerta: email, estado, origen y sus **personas** con los datos
 * de la forma del participante (milestone 34). Nunca las demás respuestas del formulario (pueden
 * ser cualquier cosa; regla del milestone 30).
 */
function toView(p: ParticipantRow): CheckInParticipant {
  const members: CheckInMember[] = p.members.map((m) => ({
    id: m.id,
    role: m.role === "MEMBER" ? "MEMBER" : "PRIMARY",
    label: m.label,
    email: m.email,
    displayEmail: m.displayEmail,
    data: (m.data ?? {}) as Record<string, unknown>,
    checkedInAt: m.checkIns[0] ? Number(m.checkIns[0].checkedInAt) : null,
  }));
  const primary = members.find((m) => m.role === "PRIMARY");
  return {
    id: p.id,
    email: p.email,
    displayEmail: p.displayEmail ?? p.email,
    status: p.status as ParticipantStatus,
    source: p.source as ParticipantSource,
    members,
    checkedInAt: primary?.checkedInAt ?? null,
  };
}

/** Todas las inscripciones con su ingreso a la sesión, y los totales. */
export async function listCheckInParticipants(
  eventId: string,
  occurrenceStart: number,
): Promise<{ participants: CheckInParticipant[]; summary: CheckInSummary }> {
  // Valida que el evento exista y tenga el check-in habilitado.
  await loadCheckInEvent(eventId);
  const rows = await prisma.eventParticipant.findMany({
    where: { eventId },
    include: participantInclude(occurrenceStart),
    orderBy: { createdAt: "asc" },
  });
  const participants = rows.map((r) => toView(r));
  const summary: CheckInSummary = {
    registeredApproved: 0,
    registeredCheckedIn: 0,
    walkInsCheckedIn: 0,
  };
  // Se cuentan **personas** (milestone 34): un equipo de 5 aprobado son 5 esperados.
  for (const p of participants) {
    const walkIn = p.source === ParticipantSource.WALK_IN;
    for (const m of p.members) {
      if (!walkIn && p.status === ParticipantStatus.APPROVED)
        summary.registeredApproved++;
      if (m.checkedInAt != null) {
        if (walkIn) summary.walkInsCheckedIn++;
        else summary.registeredCheckedIn++;
      }
    }
  }
  return { participants, summary };
}

/**
 * Se pidió registrar el ingreso de una inscripción **no aprobada** sin `admit` (p. ej. la
 * pantalla tenía la lista desactualizada y la creía aprobada). Lleva la inscripción al día
 * para que la ruta la devuelva con el 409 y la pantalla pida la confirmación de «dejar pasar».
 */
export class AdmissionRequiredError extends DomainError {
  constructor(readonly participant: CheckInParticipant) {
    super(
      "Esta inscripción no está aprobada: confirmá que la persona puede pasar.",
      409,
    );
    this.name = "AdmissionRequiredError";
  }
}

/** Lo que la ruta necesita para auditar un ingreso. */
export interface CheckInResult {
  participant: CheckInParticipant;
  /** Las personas a las que se les registró el ingreso en este pedido. */
  checkedIn: CheckInMember[];
  /** El estado antes del ingreso, si hubo que admitir (para la auditoría). */
  admittedFrom: ParticipantStatus | null;
  session: CheckInSession;
  /** Nombre del evento, para el contexto de la auditoría. */
  eventName: string;
}

/**
 * Registra el ingreso de personas de una inscripción a una sesión (milestone 34): las
 * `memberIds` dadas (una persona, o «todo el equipo»); sin `memberIds`, quien inscribe.
 * Idempotente: quien ya había ingresado se deja como está (dos admins en la puerta, o un doble
 * toque). Si la inscripción no está aprobada y no vino `admit`, lanza `AdmissionRequiredError`.
 */
export async function checkInParticipant(
  eventId: string,
  participantId: string,
  occurrenceStart: number,
  opts: { admit: boolean; adminId: string; memberIds?: string[] },
): Promise<CheckInResult & { alreadyCheckedIn: boolean }> {
  const event = await loadCheckInEvent(eventId);
  const session = await openSession(eventId, occurrenceStart);

  return prisma.$transaction(async (tx) => {
    const p = await tx.eventParticipant.findFirst({
      where: { id: participantId, eventId },
      include: participantInclude(occurrenceStart),
    });
    if (!p) throw new DomainError("Inscripción no encontrada", 404);
    const targets = opts.memberIds?.length
      ? p.members.filter((m) => opts.memberIds!.includes(m.id))
      : p.members.filter((m) => m.role === "PRIMARY");
    if (targets.length === 0)
      throw new DomainError("Persona no encontrada en la inscripción", 404);
    const pending = targets.filter((m) => m.checkIns.length === 0);
    if (pending.length === 0) {
      return {
        participant: toView(p),
        checkedIn: [],
        admittedFrom: null,
        session,
        eventName: event.name,
        alreadyCheckedIn: true,
      };
    }

    const status = p.status as ParticipantStatus;
    let admittedFrom: ParticipantStatus | null = null;
    if (checkInRequiresAdmission(status)) {
      if (!opts.admit) throw new AdmissionRequiredError(toView(p));
      admittedFrom = status;
      await tx.eventParticipant.update({
        where: { id: p.id },
        data: {
          status: ParticipantStatus.APPROVED,
          decidedAt: BigInt(nowMs()),
          decisionReason: null,
        },
      });
    }

    await tx.eventCheckIn.createMany({
      data: pending.map((m) => ({
        participantId: p.id,
        memberId: m.id,
        eventId,
        reservationId: session.reservationId,
        occurrenceStart: BigInt(occurrenceStart),
        checkedInBy: opts.adminId,
      })),
      // Otro admin pudo marcar a alguien entre la lectura y esta escritura.
      skipDuplicates: true,
    });

    const updated = await tx.eventParticipant.findUniqueOrThrow({
      where: { id: p.id },
      include: participantInclude(occurrenceStart),
    });
    const view = toView(updated);
    const pendingIds = new Set(pending.map((m) => m.id));
    return {
      participant: view,
      checkedIn: view.members.filter((m) => pendingIds.has(m.id)),
      admittedFrom,
      session,
      eventName: event.name,
      alreadyCheckedIn: false,
    };
  });
}

/**
 * Deshace un ingreso (error en la puerta). No revierte una admisión: si la inscripción se
 * aprobó al registrar el ingreso, sigue aprobada. Devuelve `null` si no había ingreso.
 */
export async function undoCheckIn(
  eventId: string,
  participantId: string,
  occurrenceStart: number,
  /** La persona (milestone 34); sin ella, quien inscribe. */
  memberId?: string,
): Promise<{
  participant: CheckInParticipant;
  member: CheckInMember;
  eventName: string;
} | null> {
  const event = await loadCheckInEvent(eventId);
  const target = await prisma.eventParticipantMember.findFirst({
    where: {
      participantId,
      eventId,
      ...(memberId ? { id: memberId } : { role: "PRIMARY" }),
    },
    select: { id: true },
  });
  if (!target) return null;
  const deleted = await prisma.eventCheckIn.deleteMany({
    where: {
      eventId,
      memberId: target.id,
      occurrenceStart: BigInt(occurrenceStart),
    },
  });
  if (deleted.count === 0) return null;
  const p = await prisma.eventParticipant.findUniqueOrThrow({
    where: { id: participantId },
    include: participantInclude(occurrenceStart),
  });
  const view = toView(p);
  return {
    participant: view,
    member: view.members.find((m) => m.id === target.id)!,
    eventName: event.name,
  };
}

/** Resultado de registrar a quien llega sin inscripción. */
export type WalkInResult =
  | { ok: true; result: CheckInResult }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; existing: CheckInParticipant };

/**
 * Registra a alguien que llegó **sin inscripción**: completa el formulario del evento (lo carga
 * el admin) y queda inscripto (`APPROVED`, `source = WALK_IN`) con su ingreso a la sesión, en
 * una sola transacción. No chequea cupo ni ventana de inscripción, ni manda correo.
 *
 * Si el email ya tiene una inscripción en el evento no crea nada y la devuelve (`existing`):
 * la pantalla la muestra para registrar su ingreso por el camino normal.
 */
export async function registerWalkIn(
  eventId: string,
  occurrenceStart: number,
  displayEmail: string,
  answers: Record<string, unknown>,
  adminId: string,
): Promise<WalkInResult> {
  const event = await loadCheckInEvent(eventId);
  const session = await openSession(eventId, occurrenceStart);
  const schema = event.form ? formSchema(event.form.form) : null;
  const email = await normalizeEmailForIdentityServer(displayEmail.trim());

  let cleaned: Record<string, unknown> = {};
  if (schema) {
    const { ok, errors } = validateForm(schema, answers);
    if (!ok) return { ok: false, errors };
    const verified = verifiedAnswerFiles(
      pruneAnswers(schema, answers),
      eventId,
    );
    if (!verified) throw new DomainError(INVALID_FILE_MESSAGE, 400);
    cleaned = verified;
  }

  return prisma.$transaction(async (tx) => {
    // El mismo lock que `submitForm` (por slug): una inscripción pública del mismo email al
    // mismo tiempo espera a que esta termine, y viceversa. Sin formulario no hay inscripción
    // pública con la que competir, y el `@@unique([eventId, email])` alcanza.
    if (event.form) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`event-form:${event.form.slug}`}, 0))`;
    }

    const existing = await tx.eventParticipant.findUnique({
      where: { eventId_email: { eventId, email } },
      include: participantInclude(occurrenceStart),
    });
    if (existing) return { ok: false, existing: toView(existing) };

    const created = await tx.eventParticipant.create({
      data: {
        eventId,
        email,
        displayEmail: displayEmail.trim(),
        status: ParticipantStatus.APPROVED,
        source: ParticipantSource.WALK_IN,
        decidedAt: BigInt(nowMs()),
        answers: cleaned as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    // Integrantes (milestone 34): las mismas reglas que una inscripción pública; si alguno ya
    // está en otra inscripción, no se crea nada y la puerta lo dice.
    const sync = await syncRegistrationMembers(tx, {
      participantId: created.id,
      eventId,
      primaryEmail: email,
      primaryDisplayEmail: displayEmail.trim(),
      schema: schema ?? { version: 1, nodes: [] },
      answers: cleaned,
    });
    if (!sync.ok) throw new WalkInMemberError(sync.message);
    // Llegaron juntos: ingresan todas las personas de la inscripción.
    const members = await tx.eventParticipantMember.findMany({
      where: { participantId: created.id },
      select: { id: true },
    });
    await tx.eventCheckIn.createMany({
      data: members.map((m) => ({
        participantId: created.id,
        memberId: m.id,
        eventId,
        reservationId: session.reservationId,
        occurrenceStart: BigInt(occurrenceStart),
        checkedInBy: adminId,
      })),
    });
    const full = await tx.eventParticipant.findUniqueOrThrow({
      where: { id: created.id },
      include: participantInclude(occurrenceStart),
    });
    const view = toView(full);
    return {
      ok: true,
      result: {
        participant: view,
        checkedIn: view.members,
        admittedFrom: null,
        session,
        eventName: event.name,
      },
    };
  });
}

/**
 * Un integrante del walk-in ya está en otra inscripción (milestone 34): deshace la transacción;
 * la ruta lo devuelve como un 409 legible.
 */
export class WalkInMemberError extends DomainError {
  constructor(message: string) {
    super(message, 409);
    this.name = "WalkInMemberError";
  }
}

/** Para la subida de archivos de quien llega sin inscripción: el formulario y su slug. */
export async function getWalkInUploadTarget(eventId: string): Promise<{
  schema: FormSchema;
  slug: string;
} | null> {
  const event = await loadCheckInEvent(eventId);
  if (!event.form) return null;
  return { schema: formSchema(event.form.form), slug: event.form.slug };
}

/** Un evento en la lista de «Check-in de eventos». */
export interface CheckInEventListItem {
  id: string;
  name: string;
  spaceName: string;
  /** Sesiones de hoy (en la hora del predio), con su horario efectivo. */
  today: { startMs: number; endMs: number }[];
  /** La próxima sesión después de hoy, si hay. */
  next: { startMs: number; endMs: number } | null;
  /** La última que ya pasó (antes de hoy), si hay: para cargar asistencia después. */
  last: { startMs: number; endMs: number } | null;
}

/** Cuánto después de su última sesión un evento sigue en la lista (cargar asistencia tarde). */
const RECENTLY_ENDED_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Los eventos con check-in habilitado que están en curso o terminaron hace menos de 30 días,
 * los que tienen sesión **hoy** primero. Es la entrada de un rol de recepción, que no ve la
 * lista de eventos de la gestión.
 */
export async function listCheckInEvents(): Promise<CheckInEventListItem[]> {
  const now = nowMs();
  const events = await prisma.event.findMany({
    where: {
      checkInEnabled: true,
      deletedAt: null,
      OR: [
        { recurrenceEnd: { gte: BigInt(now - RECENTLY_ENDED_MS) } },
        {
          recurrenceEnd: null,
          endTime: { gte: BigInt(now - RECENTLY_ENDED_MS) },
        },
      ],
    },
    select: { id: true, name: true, space: { select: { name: true } } },
    orderBy: { startTime: "asc" },
  });
  if (events.length === 0) return [];

  const reservations = await prisma.reservation.findMany({
    where: {
      reservableType: "EVENT",
      reservableId: { in: events.map((e) => e.id) },
    },
    include: { exceptions: true },
  });

  const items = events.map((e) => {
    const sessions = checkInSessions(
      expandAllEventOccurrences(
        reservations
          .filter((r) => r.reservableId === e.id)
          .map(toRawReservation),
      ),
      now,
    );
    const isToday = (s: CheckInSession) =>
      s.state === "open" && isSameAdminDay(s.startMs, now);
    const span = (s: CheckInSession) => ({
      startMs: s.startMs,
      endMs: s.endMs,
    });
    const past = sessions.filter((s) => s.state === "open" && !isToday(s));
    const nextFuture = sessions.find((s) => s.state === "future");
    return {
      id: e.id,
      name: e.name,
      spaceName: e.space.name,
      today: sessions.filter(isToday).map(span),
      next: nextFuture ? span(nextFuture) : null,
      last: past.length > 0 ? span(past[past.length - 1]) : null,
    };
  });

  // Hoy primero (por horario); después el resto, en el orden de inicio del evento.
  return items.sort((a, b) => {
    const at = a.today[0]?.startMs ?? Infinity;
    const bt = b.today[0]?.startMs ?? Infinity;
    return at - bt;
  });
}

function isSameAdminDay(a: number, b: number): boolean {
  return dateKeyFromUnixMs(a) === dateKeyFromUnixMs(b);
}
