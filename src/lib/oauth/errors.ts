/**
 * Error del protocolo OAuth (RFC 6749 §5.2): un `error` de la lista estándar más una
 * descripción. Los endpoints de token, registro y revocación lo responden como
 * `{ error, error_description }` — **no** con el sobre `{ message }` del resto de la API,
 * porque quien lo lee es el cliente OAuth del asistente, no nuestra UI.
 */
export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "unauthorized_client"
  | "unsupported_grant_type"
  | "invalid_scope"
  | "invalid_target"
  | "invalid_redirect_uri"
  | "invalid_client_metadata"
  | "access_denied"
  | "unsupported_response_type"
  | "server_error";

export class OAuthError extends Error {
  readonly code: OAuthErrorCode;
  readonly status: number;

  constructor(code: OAuthErrorCode, description: string, status = 400) {
    super(description);
    this.name = "OAuthError";
    this.code = code;
    this.status = status;
  }
}

export function isOAuthError(err: unknown): err is OAuthError {
  return err instanceof OAuthError;
}
