import "server-only";
import { SPOT_HOLDING_STATUSES } from "@/lib/constants/participants";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server/identity-server";
import { extractMembers, type AnswerMap } from "@/lib/events/form-engine";
import {
  type FormSchema,
  participantFields,
  PRIMARY_PARTICIPANT_KEY,
} from "@/lib/events/form-schema";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Integrantes de una inscripción (milestone 34): se reescriben desde las respuestas cada vez que
 * la inscripción se crea, se edita por el enlace o se registra en la puerta.
 *
 * Reglas (decisiones del usuario, 2026-11-25):
 * - Un email aparece en **una sola inscripción activa** del evento — como quien inscribe o como
 *   integrante — y una sola vez dentro de la misma inscripción. Activa = que ocupa lugar
 *   (`SPOT_HOLDING_STATUSES`): una cancelada o rechazada libera los emails de su equipo.
 * - El cupo no cambia: cuenta inscripciones, no integrantes.
 * - Quitar a alguien que ya registró su ingreso está bloqueado (no se pierde asistencia).
 *
 * Se llama dentro de la transacción de la inscripción, después del advisory lock del formulario,
 * así dos inscripciones simultáneas con el mismo integrante no pasan las dos.
 */

export interface MemberSyncInput {
  participantId: string;
  eventId: string;
  /** Email normalizado de quien inscribe (el de la inscripción). */
  primaryEmail: string;
  primaryDisplayEmail: string;
  schema: FormSchema;
  /** Respuestas ya validadas y podadas. */
  answers: AnswerMap;
}

export type MemberSyncResult = { ok: true } | { ok: false; message: string };

interface DesiredMember {
  role: "PRIMARY" | "MEMBER";
  email: string;
  displayEmail: string;
  label: string | null;
  nodePath: string | null;
  data: Record<string, unknown>;
  position: number;
}

/** Las personas que tiene que tener la inscripción, con emails normalizados. */
async function desiredMembers(
  input: MemberSyncInput,
): Promise<DesiredMember[]> {
  const primaryData =
    participantFields(input.schema).length > 0
      ? ((input.answers[PRIMARY_PARTICIPANT_KEY] as Record<string, unknown>) ??
        {})
      : {};
  const out: DesiredMember[] = [
    {
      role: "PRIMARY",
      email: input.primaryEmail,
      displayEmail: input.primaryDisplayEmail,
      label: null,
      nodePath: null,
      data: primaryData,
      position: 0,
    },
  ];
  const extracted = extractMembers(input.schema, input.answers);
  for (const [i, m] of extracted.entries()) {
    out.push({
      role: "MEMBER",
      email: await normalizeEmailForIdentityServer(m.email),
      displayEmail: m.email,
      label: m.label,
      nodePath: m.nodePath,
      data: m.data,
      position: i + 1,
    });
  }
  return out;
}

export async function syncRegistrationMembers(
  tx: Prisma.TransactionClient,
  input: MemberSyncInput,
): Promise<MemberSyncResult> {
  const desired = await desiredMembers(input);

  // 1. Repetidos dentro de la misma inscripción.
  const seen = new Map<string, DesiredMember>();
  for (const m of desired) {
    const prev = seen.get(m.email);
    if (prev) {
      return {
        ok: false,
        message: `${m.displayEmail} aparece dos veces en la inscripción: cada persona va una sola vez.`,
      };
    }
    seen.set(m.email, m);
  }

  // 2. Ya en otra inscripción activa del evento (como quien inscribe o como integrante).
  const clash = await tx.eventParticipantMember.findFirst({
    where: {
      eventId: input.eventId,
      email: { in: [...seen.keys()] },
      participantId: { not: input.participantId },
      participant: { status: { in: SPOT_HOLDING_STATUSES } },
    },
    select: { email: true },
  });
  if (clash) {
    const who = seen.get(clash.email)!;
    return {
      ok: false,
      message:
        who.role === "PRIMARY"
          ? "Ya estás en otra inscripción de este evento (te sumaron a un equipo)."
          : `${who.displayEmail} ya está inscripto en este evento (en otra inscripción).`,
    };
  }

  // 3. Escribir: actualizar los que siguen, crear los nuevos y quitar los que ya no están —
  //    salvo que tengan un ingreso registrado.
  const existing = await tx.eventParticipantMember.findMany({
    where: { participantId: input.participantId },
    select: {
      id: true,
      email: true,
      displayEmail: true,
      _count: { select: { checkIns: true } },
    },
  });
  const removed = existing.filter((e) => !seen.has(e.email));
  const blocked = removed.find((e) => e._count.checkIns > 0);
  if (blocked) {
    return {
      ok: false,
      message: `No se puede quitar a ${blocked.displayEmail}: ya registró su ingreso al evento. Si hay un error, avisale al equipo de La Nube.`,
    };
  }
  if (removed.length > 0) {
    await tx.eventParticipantMember.deleteMany({
      where: { id: { in: removed.map((r) => r.id) } },
    });
  }
  const byEmail = new Map(existing.map((e) => [e.email, e]));
  const now = BigInt(Date.now());
  for (const m of desired) {
    const data = {
      role: m.role,
      displayEmail: m.displayEmail,
      label: m.label,
      nodePath: m.nodePath,
      data: m.data as Prisma.InputJsonValue,
      position: m.position,
      updatedAt: now,
    };
    const prev = byEmail.get(m.email);
    if (prev) {
      await tx.eventParticipantMember.update({ where: { id: prev.id }, data });
    } else {
      await tx.eventParticipantMember.create({
        data: {
          ...data,
          participantId: input.participantId,
          eventId: input.eventId,
          email: m.email,
        },
      });
    }
  }
  return { ok: true };
}
