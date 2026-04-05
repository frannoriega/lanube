/**
 * Canonical email identity for auth (trim, lowercase, +lanube-only, Gmail dot semantics).
 *
 * Gmail and @googlemail.com ignore dots in the local part. Other providers generally do not;
 * Google Workspace on a custom domain cannot be detected from the address string alone — use
 * server-side `normalizeEmailForIdentityServer` (MX / env allowlist) for those cases.
 *
 * Rare providers may treat `+` as a literal mailbox character; allowing only `+lanube` and
 * stripping it assumes subaddressing semantics for that tag.
 */

export class EmailIdentityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailIdentityValidationError";
  }
}

export const MSG_INVALID_EMAIL = "Por favor ingresa un email válido";

export const MSG_DISALLOWED_PLUS_TAG =
  "Solo se permite la etiqueta +lanube en el correo; no uses otras direcciones con +.";

export function isGmailConsumerDomain(domain: string): boolean {
  return domain === "gmail.com" || domain === "googlemail.com";
}

export function stripDotsFromLocal(local: string): string {
  return local.replace(/\./g, "");
}

/**
 * Parses and validates trim, lowercase, + rules. Returns local part after removing a sole
 * `+lanube` suffix and the domain (lowercase).
 */
export function parseEmailIdentityForNormalization(raw: string): {
  localBase: string;
  domain: string;
} {
  const trimmedLower = raw.trim().toLowerCase();
  const at = trimmedLower.lastIndexOf("@");
  if (at <= 0 || at === trimmedLower.length - 1) {
    throw new EmailIdentityValidationError(MSG_INVALID_EMAIL);
  }
  let local = trimmedLower.slice(0, at);
  const domain = trimmedLower.slice(at + 1);
  if (!local || !domain || domain.includes("@")) {
    throw new EmailIdentityValidationError(MSG_INVALID_EMAIL);
  }

  const plusCount = (local.match(/\+/g) ?? []).length;
  if (plusCount > 1) {
    throw new EmailIdentityValidationError(MSG_DISALLOWED_PLUS_TAG);
  }
  if (plusCount === 1) {
    const i = local.indexOf("+");
    const suffix = local.slice(i + 1);
    if (suffix !== "lanube") {
      throw new EmailIdentityValidationError(MSG_DISALLOWED_PLUS_TAG);
    }
    local = local.slice(0, i);
    if (!local) {
      throw new EmailIdentityValidationError(MSG_INVALID_EMAIL);
    }
  }

  return { localBase: local, domain };
}

/**
 * Client-safe normalization: Gmail / Googlemail dot-stripping only (no MX, no env allowlist).
 */
export function normalizeEmailForIdentity(raw: string): string {
  const { localBase, domain } = parseEmailIdentityForNormalization(raw);
  const local = isGmailConsumerDomain(domain)
    ? stripDotsFromLocal(localBase)
    : localBase;
  return `${local}@${domain}`;
}

export function tryNormalizeEmailForIdentity(
  raw: string,
): { ok: true; value: string } | { ok: false; message: string } {
  try {
    return { ok: true, value: normalizeEmailForIdentity(raw) };
  } catch (err) {
    if (err instanceof EmailIdentityValidationError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }
}
