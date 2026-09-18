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
): void {
  if (statusRequiresApprovalPermission(status) && !canPublishDirectly) {
    throw new DomainError(
      "No tenés permiso para publicar directamente — enviá a revisión",
      403,
    );
  }
}
