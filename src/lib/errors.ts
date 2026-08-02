/**
 * A business-rule failure whose message is safe to show the end user
 * (e.g. "Capacidad excedida", "Evento no encontrado").
 *
 * API routes surface `message` + `status` directly; any *other* thrown value is
 * treated as an unexpected internal error — logged and answered with a generic
 * 500 that never leaks internals (see `apiServerError`). Throw this from DB /
 * domain helpers instead of a plain `Error` when the caller (and the user)
 * should see the reason.
 */
export class DomainError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "DomainError";
    this.status = status;
  }
}

/** Type guard usable across route handlers. */
export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}
