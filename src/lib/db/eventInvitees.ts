import "server-only";
import { SPOT_HOLDING_STATUSES } from "@/lib/constants/participants";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server/identity-server";
import { DomainError } from "@/lib/errors";
import { inviteeState, type InviteeState } from "@/lib/events/invitees";
import { prisma } from "@/lib/prisma";

/**
 * Invitados de un evento privado (milestone 43). La lista restringe quién se inscribe solo si el
 * evento es privado y tiene al menos un invitado (`isInvitedToRegister` en `db/participants.ts`);
 * acá se administra.
 */

export interface InviteeRow {
  id: string;
  email: string;
  displayEmail: string;
  invitedAt: number | null;
  inviteCount: number;
  createdAt: number;
  /** Tiene una inscripción que ocupa lugar (pendiente o aprobada) con ese email. */
  registered: boolean;
  state: InviteeState;
}

/** El evento con lo que necesita la página de invitados. 404 si no existe. */
export async function getInviteeEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      summary: true,
      imageUrl: true,
      isPrivate: true,
      status: true,
      deletedAt: true,
      startTime: true,
      recurrenceEnd: true,
      endTime: true,
      form: { select: { slug: true, opensAt: true, closesAt: true } },
    },
  });
  if (!event) throw new DomainError("Evento no encontrado", 404);
  return event;
}

/** Los invitados, cruzados con las inscripciones vigentes del evento, del más nuevo al más viejo. */
export async function listInvitees(eventId: string): Promise<InviteeRow[]> {
  const [rows, registered] = await Promise.all([
    prisma.eventInvitee.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.eventParticipant.findMany({
      where: { eventId, status: { in: SPOT_HOLDING_STATUSES } },
      select: { email: true },
    }),
  ]);
  const registeredEmails = new Set(registered.map((p) => p.email));
  return rows.map((r) => {
    const base = {
      id: r.id,
      email: r.email,
      displayEmail: r.displayEmail,
      invitedAt: r.invitedAt == null ? null : Number(r.invitedAt),
      inviteCount: r.inviteCount,
      createdAt: Number(r.createdAt),
      registered: registeredEmails.has(r.email),
    };
    return { ...base, state: inviteeState(base) };
  });
}

/**
 * Agrega emails (ya separados y con formato válido: `parseInviteeList`) normalizándolos como las
 * inscripciones. Devuelve los agregados y los que ya estaban (por email normalizado).
 */
export async function addInvitees(
  eventId: string,
  displayEmails: string[],
): Promise<{
  added: { id: string; displayEmail: string }[];
  existing: string[];
}> {
  const normalized = new Map<string, string>();
  for (const display of displayEmails) {
    const email = await normalizeEmailForIdentityServer(display);
    // Dos formas del mismo email en el pegado (p. ej. con y sin puntos en Gmail): la primera.
    if (!normalized.has(email)) normalized.set(email, display);
  }
  const already = await prisma.eventInvitee.findMany({
    where: { eventId, email: { in: [...normalized.keys()] } },
    select: { email: true, displayEmail: true },
  });
  const alreadySet = new Set(already.map((a) => a.email));
  const toAdd = [...normalized.entries()].filter(([e]) => !alreadySet.has(e));
  // `skipDuplicates` cubre una carrera con otro admin agregando lo mismo a la vez.
  await prisma.eventInvitee.createMany({
    data: toAdd.map(([email, displayEmail]) => ({
      eventId,
      email,
      displayEmail,
    })),
    skipDuplicates: true,
  });
  const added = await prisma.eventInvitee.findMany({
    where: { eventId, email: { in: toAdd.map(([e]) => e) } },
    select: { id: true, displayEmail: true },
  });
  return { added, existing: already.map((a) => a.displayEmail) };
}

/** Quita invitados (no toca inscripciones: quien ya se inscribió sigue inscripto). */
export async function removeInvitees(
  eventId: string,
  ids: string[],
): Promise<{ id: string; displayEmail: string }[]> {
  const rows = await prisma.eventInvitee.findMany({
    where: { eventId, id: { in: ids } },
    select: { id: true, displayEmail: true },
  });
  await prisma.eventInvitee.deleteMany({
    where: { eventId, id: { in: rows.map((r) => r.id) } },
  });
  return rows;
}

/** Los invitados a los que hay que mandar: los `ids` dados o, sin ids, los que nunca recibieron. */
export async function inviteesToSend(eventId: string, ids?: string[]) {
  return prisma.eventInvitee.findMany({
    where: {
      eventId,
      ...(ids ? { id: { in: ids } } : { invitedAt: null }),
    },
    select: { id: true, email: true, displayEmail: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Registra un envío exitoso (uno por invitado, a medida que salen). */
export async function markInvited(id: string, atMs: number): Promise<void> {
  await prisma.eventInvitee.update({
    where: { id },
    data: { invitedAt: BigInt(atMs), inviteCount: { increment: 1 } },
  });
}
