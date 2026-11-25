import type { Prisma } from "@/generated/prisma/client";

/**
 * Cuándo un evento **se lista** en público (milestone 43). Una sola regla para todas las
 * superficies: portada, `/events`, `/events/[id]`, sitemap, el calendario de un espacio y el de
 * actividades de otras personas, «Eventos disponibles» del tablero.
 *
 * - publicado (`status = PUBLISHED`): un borrador o pausado nunca se anuncia;
 * - no cancelado (`deletedAt` nulo);
 * - **no privado**: un evento privado se comparte por el enlace de su formulario
 *   (`/forms/[slug]`, que sigue andando) pero no aparece en ningún listado.
 *
 * Quien está inscripto a un evento privado lo ve igual en lo suyo (su tablero y su calendario):
 * esas lecturas lo agregan aparte. Un evento privado no se puede destacar.
 */
export const PUBLIC_EVENT_WHERE = {
  status: "PUBLISHED",
  deletedAt: null,
  isPrivate: false,
} as const satisfies Prisma.EventWhereInput;

/** La misma regla sobre una fila ya leída. */
export function isEventPubliclyListed(e: {
  status: string;
  deletedAt: bigint | number | null;
  isPrivate: boolean;
}): boolean {
  return e.status === "PUBLISHED" && e.deletedAt == null && !e.isPrivate;
}
