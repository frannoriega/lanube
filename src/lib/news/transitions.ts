import { DomainError } from "@/lib/errors";

/** Pure Noticias status-transition rules — no server-only imports, unit-testable directly. */

export function statusRequiresApprovalPermission(status: string): boolean {
  return status === "PUBLISHED" || status === "PAUSED";
}

/**
 * Validates an author-driven status write. A plain `news:manage` author (no
 * `news:approve`) can only ever write DRAFT or PENDING_REVIEW — reaching
 * PUBLISHED/PAUSED requires the approve permission (Admin/Superadmin publishing
 * their own post directly, or approving someone else's). Throws a DomainError
 * (403) otherwise.
 */
export function assertAuthorTransition(
  status: string,
  canPublishDirectly: boolean,
  /**
   * El estado guardado de la nota, cuando se edita una existente. Se omite al crear.
   * Un autor puede dejar publicada una nota que ya estaba PUBLISHED mientras la corrige — ver
   * {@link isAmendInPlace}.
   */
  existingStatus?: string,
): void {
  if (isAmendInPlace(status, existingStatus)) return;
  if (statusRequiresApprovalPermission(status) && !canPublishDirectly) {
    throw new DomainError(
      "No tenés permiso para publicar directamente — enviá a revisión",
      403,
    );
  }
}

/**
 * ¿Esta grabación es un autor corrigiendo una nota que **ya** está publicada, dejándola
 * publicada?
 *
 * Esa edición se permite sin `news:approve`. Antes de que fuera así, editar un artículo en
 * línea no tenía ningún resultado seguro: pedir PUBLISHED era un 403 y pedir cualquier otra
 * cosa bajaba la página del sitio hasta que un admin la volviera a aprobar, así que corregir un
 * typo costaba la disponibilidad del artículo (milestone-12 D20).
 *
 * No es un agujero en la compuerta de aprobación: la compuerta gobierna la *primera*
 * publicación, y una corrección en el lugar setea `needsReview`, así que un admin igual ve el
 * cambio — después en lugar de antes. Ver {@link shouldFlagForReview} en `./publishing.ts`.
 */
export function isAmendInPlace(
  status: string,
  existingStatus?: string,
): boolean {
  return status === "PUBLISHED" && existingStatus === "PUBLISHED";
}
