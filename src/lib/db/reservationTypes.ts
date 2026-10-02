import { prisma } from "@/lib/prisma";
import type { ReservationType } from "@/generated/prisma/client";

export type { ReservationType };

/** Catalog of reservation/event types, in display order. */
export async function listReservationTypes(): Promise<ReservationType[]> {
  return prisma.reservationType.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
}

/** `{ value, label }` options for type selects (booking calendar, event form). */
export async function listReservationTypeOptions(): Promise<
  Array<{ value: string; label: string }>
> {
  const types = await listReservationTypes();
  return types.map((t) => ({ value: t.code, label: t.name }));
}

export async function getReservationTypeByCode(
  code: string,
): Promise<ReservationType | null> {
  return prisma.reservationType.findUnique({ where: { code } });
}

export interface ReservationTypeInput {
  name: string;
  displayOrder?: number;
}

/** Stable ASCII code derived from a display name (e.g. "Clase de Robótica" → CLASE_DE_ROBOTICA). */
export function reservationTypeCodeFromName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || "TIPO";
}

/**
 * Creates a type; the immutable `code` is derived from the name (suffixed on
 * collision) — events/reservations reference it, only `name` is editable later.
 */
export async function createReservationType(
  input: ReservationTypeInput,
): Promise<ReservationType> {
  const base = reservationTypeCodeFromName(input.name);
  let code = base;
  for (let i = 2; await getReservationTypeByCode(code); i++) {
    code = `${base}_${i}`;
  }
  // Un tipo nuevo va al final de la lista; el orden se cambia después con "Reordenar".
  const last = await prisma.reservationType.aggregate({
    _max: { displayOrder: true },
  });
  return prisma.reservationType.create({
    data: {
      code,
      name: input.name,
      displayOrder: (last._max.displayOrder ?? -1) + 1,
    },
  });
}

/** `code` is immutable after creation (events/reservations reference it). */
export async function updateReservationType(
  id: string,
  input: ReservationTypeInput,
): Promise<ReservationType> {
  return prisma.reservationType.update({
    where: { id },
    // Solo el nombre: el orden lo maneja `reorderReservationTypes` (milestone 14).
    data: { name: input.name },
  });
}

/**
 * Deletes a type. Fails (FK RESTRICT) when any event or reservation still uses it;
 * callers should translate that into a friendly error.
 */
export async function deleteReservationType(id: string): Promise<void> {
  await prisma.reservationType.delete({ where: { id } });
}

/** The preferred code when it exists in the catalog, else the first option. */
export function preferredTypeCode(
  options: Array<{ value: string; label: string }>,
  preferred: string,
): string {
  if (options.some((o) => o.value === preferred)) return preferred;
  return options[0]?.value ?? "";
}

/** True when any event or reservation references the type's code. */
export async function isReservationTypeInUse(code: string): Promise<boolean> {
  const [event, reservation] = await Promise.all([
    prisma.event.findFirst({
      where: { eventType: code },
      select: { id: true },
    }),
    prisma.reservation.findFirst({
      where: { eventType: code },
      select: { id: true },
    }),
  ]);
  return !!event || !!reservation;
}

/**
 * Persiste un nuevo orden de los tipos de reserva (modo "Reordenar", milestone 14): el id en
 * la posición `i` queda con `displayOrder = i`, así los valores quedan densos (0..n-1).
 */
export async function reorderReservationTypes(
  orderedIds: string[],
): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.reservationType.update({
        where: { id },
        data: { displayOrder: index },
      }),
    ),
  );
}
