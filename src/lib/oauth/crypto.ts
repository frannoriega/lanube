import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Primitivas criptográficas del servidor OAuth (milestone 20). Puras (solo `node:crypto`),
 * testeadas en `crypto.test.ts`.
 */

/**
 * Un token opaco nuevo: 256 bits de azar en base64url (43 caracteres). Se usa para códigos de
 * autorización, access tokens, refresh tokens y `client_id` de DCR.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * SHA-256 en hex de un token. Con 256 bits de entropía un hash rápido alcanza (mismo criterio
 * que los códigos de recuperación y los tokens de reset): no hay diccionario que probar, y
 * permite buscar el token por índice. En la base nunca se guarda el token, solo esto.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * `code_verifier` válido según RFC 7636 §4.1: 43–128 caracteres de
 * `[A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"`.
 */
export function isValidCodeVerifier(verifier: string): boolean {
  return /^[A-Za-z0-9\-._~]{43,128}$/.test(verifier);
}

/** `code_challenge` S256 válido: base64url sin padding de un SHA-256 (43 caracteres). */
export function isValidS256Challenge(challenge: string): boolean {
  return /^[A-Za-z0-9\-_]{43}$/.test(challenge);
}

/**
 * Verifica PKCE S256: `base64url(sha256(verifier)) === challenge`, en tiempo constante.
 * Solo S256 — `plain` se rechaza antes de llegar acá (OAuth 2.1).
 */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!isValidCodeVerifier(verifier)) return false;
  const computed = Buffer.from(
    createHash("sha256").update(verifier).digest("base64url"),
  );
  const expected = Buffer.from(challenge);
  return (
    computed.length === expected.length && timingSafeEqual(computed, expected)
  );
}
