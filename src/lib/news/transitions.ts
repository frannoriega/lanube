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
 *
 * A plain author can never write PUBLISHED for a post that's already live, either —
 * a live post doesn't change on a save anymore. They propose a change instead, via
 * `assertCanRequestPendingAction` + `requestNewsPostAction`.
 */
export function assertAuthorTransition(
  status: string,
  canPublishDirectly: boolean,
): void {
  if (statusRequiresApprovalPermission(status) && !canPublishDirectly) {
    throw new DomainError(
      "No tenés permiso para publicar directamente — enviá a revisión",
      403,
    );
  }
}

/**
 * Validates a plain author's EDIT/PAUSE/DELETE request against their own PUBLISHED post.
 * Throws a DomainError otherwise:
 * - 409 if the post isn't PUBLISHED (nothing to request against — edit it directly instead).
 * - 409 if another request is already pending and it's a *different* one (resolve that
 *   first). Re-requesting the same action is allowed — it overwrites the pending snapshot/
 *   reason, so correcting a typo in a not-yet-decided proposal doesn't need a round trip
 *   through an admin.
 */
export function assertCanRequestPendingAction(
  existingStatus: string,
  existingPendingAction: string | null,
  action: "EDIT" | "PAUSE" | "DELETE",
): void {
  if (existingStatus !== "PUBLISHED") {
    throw new DomainError(
      "Solo se puede pedir esto sobre una nota publicada",
      409,
    );
  }
  if (existingPendingAction && existingPendingAction !== action) {
    throw new DomainError(
      "Ya hay otra solicitud pendiente para esta nota — hay que resolverla primero",
      409,
    );
  }
}
