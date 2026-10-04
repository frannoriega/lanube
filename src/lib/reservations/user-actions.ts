import "server-only";
import { nowMs } from "@/lib/clock";
import {
  createReservation,
  createReservationException,
  deleteReservation,
  type ReservationWithRelations,
} from "@/lib/db/reservations";
import { getReservationTypeByCode } from "@/lib/db/reservationTypes";
import { getSpaceById } from "@/lib/db/spaces";
import { DomainError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { unixMsToDate } from "@/lib/unix-ms";
import { validateUserReservationWindow } from "./user-rules";

/**
 * Acciones de reserva **de un usuario sobre sus propias reservas** (milestone 20, slice 1).
 *
 * Antes estas reglas vivían en el route handler `POST/DELETE /api/resources/[spaceId]`, y
 * cualquier segundo cliente que llamara a `createReservation()` directo (el conector MCP) se
 * las habría salteado: grilla de 15 minutos, nada en el pasado, 24 h de anticipación, ventana
 * horaria del predio, tipo de reserva válido, y que solo se cancele lo propio. Ahora el route
 * handler y el endpoint MCP llaman a estas funciones, así que **las reglas son las mismas
 * porque son el mismo código**.
 *
 * Todas las fallas de negocio salen como {@link DomainError} con el mismo mensaje en
 * castellano que veía la web; el route las convierte en 4xx con `apiCatch`, y el MCP en un
 * resultado de tool con `isError: true` para que el asistente pueda corregirse solo.
 */

/** De dónde vino una solicitud de reserva. `null`/ausente = la web. */
export interface ReservationOriginInput {
  /** Nombre del asistente tal como lo declaró su cliente OAuth ("Claude"). */
  clientName: string;
}

export interface RequestUserReservationInput {
  spaceId: string;
  startMs: number;
  endMs: number;
  reason: string;
  /** Código de `ReservationType`; si falta, "MEETING" (igual que la web). */
  eventType?: string | null;
  /** Presente cuando la pidió un asistente conectado por MCP (milestone 20). */
  origin?: ReservationOriginInput;
}

/**
 * Pide una reserva para `registeredUserId`. Queda PENDIENTE de aprobación del admin, como
 * desde la web. Tira {@link DomainError} si incumple cualquier regla.
 */
export async function requestUserReservation(
  registeredUserId: string,
  input: RequestUserReservationInput,
): Promise<ReservationWithRelations> {
  // Un espacio no reservable responde igual que uno inexistente: la página de reserva ya
  // daba 404, pero la API aceptaba el id igual (se cerró al extraer esto, milestone 20).
  const space = await getSpaceById(input.spaceId);
  if (!space || !space.isReservable)
    throw new DomainError("Espacio no encontrado", 404);

  const reason = input.reason?.trim();
  if (!reason) throw new DomainError("Faltan campos requeridos");

  const typeCode =
    typeof input.eventType === "string" && input.eventType
      ? input.eventType
      : "MEETING";
  if (!(await getReservationTypeByCode(typeCode)))
    throw new DomainError("Tipo de reserva inválido");

  const violation = validateUserReservationWindow(
    input.startMs,
    input.endMs,
    nowMs(),
  );
  if (violation) throw new DomainError(violation);

  const reservation = await createReservation({
    reservableType: "USER",
    reservableId: registeredUserId,
    spaceId: input.spaceId,
    eventType: typeCode,
    reason,
    startTime: unixMsToDate(input.startMs),
    endTime: unixMsToDate(input.endMs),
  });

  // La marca de origen se escribe aparte en lugar de sumarle un parámetro a la función SQL
  // `create_reservation()`: es un dato informativo para el admin (el chip "Vía asistente"),
  // no participa de ninguna regla, y así no hay que recrear la función.
  if (input.origin) {
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { origin: "ASSISTANT", originClientName: input.origin.clientName },
    });
    return {
      ...reservation,
      origin: "ASSISTANT",
      originClientName: input.origin.clientName,
    };
  }
  return reservation;
}

export interface CancelUserReservationInput {
  reservationId: string;
  /**
   * Inicio nominal (ms) de **una** ocurrencia de una reserva recurrente: cancela solo esa
   * ocurrencia (milestone 5). Ausente = cancela la reserva completa.
   */
  occurrenceStartMs?: number | null;
}

/**
 * Cancela una reserva propia (o una ocurrencia de una recurrente). Tira {@link DomainError}
 * si la reserva no existe, no es del usuario, o ya empezó.
 */
export async function cancelUserReservation(
  registeredUserId: string,
  input: CancelUserReservationInput,
): Promise<void> {
  // Se busca ya filtrada por dueño: una reserva ajena responde igual que una inexistente
  // (404), sin confirmar que el id existe.
  const existing = await prisma.reservation.findFirst({
    where: {
      id: input.reservationId,
      reservableType: "USER",
      reservableId: registeredUserId,
    },
  });
  if (!existing) throw new DomainError("Reserva no encontrada", 404);

  if (input.occurrenceStartMs != null) {
    if (!existing.isRecurring)
      throw new DomainError(
        "Esta reserva no es recurrente; cancelá la reserva completa",
      );
    const ms = Number(input.occurrenceStartMs);
    if (!Number.isFinite(ms))
      throw new DomainError("occurrenceStartTime inválido");
    await createReservationException(input.reservationId, unixMsToDate(ms), {
      isCancelled: true,
    });
    return;
  }

  // Vía la función de dominio, no prisma.delete: esa se niega a borrar una reserva que ya
  // empezó (lo que además desvincularía sus check-ins, porque check_ins.reservation_id es
  // ON DELETE SET NULL). Las filas del ledger cascadean — antes de la FK que agregó
  // 20260924100000 quedaban huérfanas y seguían ocupando el lugar.
  await deleteReservation(input.reservationId);
}
