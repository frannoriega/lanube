import "server-only";
import { nowMs } from "@/lib/clock";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  ACCESS_TOKEN_TTL_MS,
  AUTHORIZATION_CODE_TTL_MS,
  hasScopes,
  type OAuthScope,
  parseScopes,
  REFRESH_TOKEN_TTL_MS,
} from "./config";
import { generateOpaqueToken, hashToken, verifyPkceS256 } from "./crypto";
import { OAuthError } from "./errors";

/**
 * El corazón del servidor de autorización (milestone 20): emitir códigos, canjearlos por
 * tokens, rotar refresh tokens, verificar access tokens y revocar.
 *
 * Reglas que esto garantiza (y que los tests de integración del milestone describen):
 *
 * - **Código de un solo uso, 60 s.** Se marca usado con un `UPDATE … WHERE used_at IS NULL`
 *   atómico; si un segundo canje llega (aunque sea concurrente), se revoca el grant entero:
 *   alguien interceptó el código (RFC 6749 §4.1.2).
 * - **PKCE S256 obligatorio**, y la `redirect_uri` del canje igual a la de la autorización.
 * - **Refresh rotativo con detección de reuso**: cada canje emite un par nuevo y revoca el
 *   viejo; si llega un refresh ya rotado, alguien lo robó → se revoca el grant entero
 *   (OAuth 2.1 §4.3.1 para clientes públicos).
 * - **Tokens opacos, solo su hash en la base.** Revocar es marcar una fila.
 * - **Audiencia**: cada token lleva el `resource` para el que se emitió, y el endpoint MCP
 *   solo acepta los de su propia URL.
 */

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

// ---------------------------------------------------------------------------
// Grants y códigos
// ---------------------------------------------------------------------------

export interface CreateAuthorizationInput {
  /** `User.id` (la cuenta), no `RegisteredUser.id`. */
  userId: string;
  /** `OAuthClient.id` (la fila), no el `client_id` público. */
  clientRowId: string;
  scopes: OAuthScope[];
  redirectUri: string;
  codeChallenge: string;
  resource: string;
}

/**
 * La persona apretó "Permitir": crea (o reutiliza) su grant con este cliente y emite un
 * código de autorización. Devuelve el código en claro — es la única vez que existe así.
 *
 * Un grant vigente del mismo par cuenta+cliente se reutiliza (reconectar el mismo asistente
 * no debe dejar dos filas en "Asistentes conectados"), con los scopes recién consentidos.
 */
export async function createAuthorizationCode(
  input: CreateAuthorizationInput,
): Promise<string> {
  const code = generateOpaqueToken();
  const at = nowMs();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.oAuthGrant.findFirst({
      where: {
        userId: input.userId,
        clientId: input.clientRowId,
        revokedAt: null,
      },
      select: { id: true },
    });
    const grant = existing
      ? await tx.oAuthGrant.update({
          where: { id: existing.id },
          data: { scopes: input.scopes },
          select: { id: true },
        })
      : await tx.oAuthGrant.create({
          data: {
            userId: input.userId,
            clientId: input.clientRowId,
            scopes: input.scopes,
          },
          select: { id: true },
        });
    await tx.oAuthAuthorizationCode.create({
      data: {
        codeHash: hashToken(code),
        grantId: grant.id,
        redirectUri: input.redirectUri,
        codeChallenge: input.codeChallenge,
        scopes: input.scopes,
        resource: input.resource,
        expiresAt: BigInt(at + AUTHORIZATION_CODE_TTL_MS),
      },
    });
  });
  return code;
}

async function issueTokens(
  tx: Prisma.TransactionClient,
  grantId: string,
  scopes: string[],
  resource: string,
): Promise<{ id: string; response: TokenResponse }> {
  const accessToken = generateOpaqueToken();
  const refreshToken = generateOpaqueToken();
  const at = nowMs();
  const row = await tx.oAuthToken.create({
    data: {
      grantId,
      accessTokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(refreshToken),
      scopes,
      resource,
      accessExpiresAt: BigInt(at + ACCESS_TOKEN_TTL_MS),
      refreshExpiresAt: BigInt(at + REFRESH_TOKEN_TTL_MS),
    },
    select: { id: true },
  });
  return {
    id: row.id,
    response: {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      refresh_token: refreshToken,
      scope: scopes.join(" "),
    },
  };
}

/** Revoca el grant y todos sus tokens (desconectar, reuso detectado, cambio de contraseña). */
async function revokeGrantTx(
  tx: Prisma.TransactionClient,
  grantId: string,
): Promise<void> {
  const at = BigInt(nowMs());
  await tx.oAuthGrant.updateMany({
    where: { id: grantId, revokedAt: null },
    data: { revokedAt: at },
  });
  await tx.oAuthToken.updateMany({
    where: { grantId, revokedAt: null },
    data: { revokedAt: at },
  });
}

// ---------------------------------------------------------------------------
// Endpoint de token
// ---------------------------------------------------------------------------

export interface ExchangeCodeInput {
  code: string;
  /** El `client_id` público que mandó el cliente. */
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  /** `resource` (RFC 8707) si el cliente lo mandó; tiene que ser el mismo de la autorización. */
  resource?: string | null;
}

/** `grant_type=authorization_code`. */
export async function exchangeAuthorizationCode(
  input: ExchangeCodeInput,
): Promise<TokenResponse> {
  const codeHash = hashToken(input.code);
  const row = await prisma.oAuthAuthorizationCode.findUnique({
    where: { codeHash },
    include: { grant: { include: { client: true } } },
  });
  const invalid = () =>
    new OAuthError(
      "invalid_grant",
      "Código de autorización inválido o vencido",
    );
  if (!row) throw invalid();

  // Canjear un código ya usado: alguien lo interceptó. Se corta todo lo que emitió.
  if (row.usedAt != null) {
    await prisma.$transaction((tx) => revokeGrantTx(tx, row.grantId));
    throw invalid();
  }
  if (Number(row.expiresAt) < nowMs()) throw invalid();
  if (row.grant.revokedAt != null) throw invalid();
  if (row.grant.client.clientId !== input.clientId) throw invalid();
  if (row.redirectUri !== input.redirectUri)
    throw new OAuthError(
      "invalid_grant",
      "redirect_uri no coincide con la de la autorización",
    );
  if (!verifyPkceS256(input.codeVerifier, row.codeChallenge))
    throw new OAuthError("invalid_grant", "code_verifier inválido");
  if (input.resource && input.resource.replace(/\/+$/, "") !== row.resource)
    throw new OAuthError("invalid_target", "resource no coincide");

  return prisma.$transaction(async (tx) => {
    // Marca atómica: si dos canjes corren a la vez, solo uno ve count === 1.
    const marked = await tx.oAuthAuthorizationCode.updateMany({
      where: { codeHash, usedAt: null },
      data: { usedAt: BigInt(nowMs()) },
    });
    if (marked.count !== 1) {
      await revokeGrantTx(tx, row.grantId);
      throw invalid();
    }
    const { response } = await issueTokens(
      tx,
      row.grantId,
      row.scopes,
      row.resource,
    );
    return response;
  });
}

export interface RefreshInput {
  refreshToken: string;
  clientId: string;
  /** Opcional: pedir un subconjunto de los scopes originales. */
  scope?: string | null;
  resource?: string | null;
}

/** `grant_type=refresh_token`, con rotación y detección de reuso. */
export async function refreshAccessToken(
  input: RefreshInput,
): Promise<TokenResponse> {
  const row = await prisma.oAuthToken.findUnique({
    where: { refreshTokenHash: hashToken(input.refreshToken) },
    include: { grant: { include: { client: true } } },
  });
  const invalid = () =>
    new OAuthError("invalid_grant", "Refresh token inválido o vencido");
  if (!row) throw invalid();
  if (row.grant.client.clientId !== input.clientId) throw invalid();

  // Un refresh ya rotado (o revocado) que vuelve a aparecer: robo. Se corta el grant.
  if (row.replacedById != null || row.revokedAt != null) {
    await prisma.$transaction((tx) => revokeGrantTx(tx, row.grantId));
    throw invalid();
  }
  if (row.refreshExpiresAt == null || Number(row.refreshExpiresAt) < nowMs())
    throw invalid();
  if (row.grant.revokedAt != null) throw invalid();
  if (input.resource && input.resource.replace(/\/+$/, "") !== row.resource)
    throw new OAuthError("invalid_target", "resource no coincide");

  let scopes = row.scopes;
  if (input.scope) {
    const requested = parseScopes(input.scope);
    if (!requested || !hasScopes(row.scopes, requested))
      throw new OAuthError("invalid_scope", "Scope fuera de lo autorizado");
    scopes = requested;
  }

  return prisma.$transaction(async (tx) => {
    // Rotación atómica: solo un canje concurrente gana; el otro es tratado como reuso.
    const claimed = await tx.oAuthToken.updateMany({
      where: { id: row.id, replacedById: null, revokedAt: null },
      data: { revokedAt: BigInt(nowMs()) },
    });
    if (claimed.count !== 1) {
      await revokeGrantTx(tx, row.grantId);
      throw invalid();
    }
    const issued = await issueTokens(tx, row.grantId, scopes, row.resource);
    await tx.oAuthToken.update({
      where: { id: row.id },
      data: { replacedById: issued.id },
    });
    return issued.response;
  });
}

/**
 * Revocación (RFC 7009): acepta un access o un refresh token. Revocar cualquiera de los dos
 * corta el par. Un token desconocido no es error (la RFC pide responder 200 igual, para no
 * revelar qué tokens existen).
 */
export async function revokeToken(token: string): Promise<void> {
  const hash = hashToken(token);
  await prisma.oAuthToken.updateMany({
    where: {
      OR: [{ accessTokenHash: hash }, { refreshTokenHash: hash }],
      revokedAt: null,
    },
    data: { revokedAt: BigInt(nowMs()) },
  });
}

// ---------------------------------------------------------------------------
// Verificación (endpoint MCP)
// ---------------------------------------------------------------------------

export interface VerifiedAccessToken {
  tokenId: string;
  grantId: string;
  /** `User.id` de la cuenta que autorizó. */
  userId: string;
  scopes: string[];
  clientName: string;
  grantLastUsedAt: bigint | null;
}

/**
 * Verifica un access token para `resource`. `null` si no existe, venció, fue revocado (él o
 * su grant), o se emitió para otra audiencia.
 */
export async function verifyAccessToken(
  token: string,
  resource: string,
): Promise<VerifiedAccessToken | null> {
  if (!token || token.length > 512) return null;
  const row = await prisma.oAuthToken.findUnique({
    where: { accessTokenHash: hashToken(token) },
    include: {
      grant: {
        select: {
          id: true,
          userId: true,
          revokedAt: true,
          lastUsedAt: true,
          client: { select: { name: true } },
        },
      },
    },
  });
  if (!row) return null;
  if (row.revokedAt != null || row.grant.revokedAt != null) return null;
  if (Number(row.accessExpiresAt) < nowMs()) return null;
  if (row.resource !== resource) return null;
  return {
    tokenId: row.id,
    grantId: row.grant.id,
    userId: row.grant.userId,
    scopes: row.scopes,
    clientName: row.grant.client.name,
    grantLastUsedAt: row.grant.lastUsedAt,
  };
}

/** Marca el uso del grant (el llamador decide el throttle). */
export async function touchGrant(grantId: string): Promise<void> {
  await prisma.oAuthGrant.update({
    where: { id: grantId },
    data: { lastUsedAt: BigInt(nowMs()) },
  });
}

// ---------------------------------------------------------------------------
// Gestión por el usuario ("Asistentes conectados")
// ---------------------------------------------------------------------------

export interface ConnectedAssistant {
  id: string;
  clientName: string;
  /** Dominio verificable: el de su primera `redirect_uri` (o del CIMD). */
  clientHost: string;
  kind: "DCR" | "CIMD";
  scopes: string[];
  createdAt: bigint;
  lastUsedAt: bigint | null;
}

function clientHostOf(client: {
  kind: "DCR" | "CIMD";
  clientId: string;
  redirectUris: string[];
}): string {
  const source =
    client.kind === "CIMD" ? client.clientId : (client.redirectUris[0] ?? "");
  try {
    return new URL(source).host || source;
  } catch {
    return source;
  }
}

/** Los asistentes conectados (grants vigentes) de una cuenta, el más reciente primero. */
export async function listConnectedAssistants(
  userId: string,
): Promise<ConnectedAssistant[]> {
  const grants = await prisma.oAuthGrant.findMany({
    where: { userId, revokedAt: null },
    include: {
      client: {
        select: { name: true, kind: true, clientId: true, redirectUris: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return grants.map((g) => ({
    id: g.id,
    clientName: g.client.name,
    clientHost: clientHostOf(g.client),
    kind: g.client.kind,
    scopes: g.scopes,
    createdAt: g.createdAt,
    lastUsedAt: g.lastUsedAt,
  }));
}

/** "Desconectar": revoca un grant propio. `false` si no existe o no es de la cuenta. */
export async function revokeGrantForUser(
  userId: string,
  grantId: string,
): Promise<boolean> {
  const grant = await prisma.oAuthGrant.findFirst({
    where: { id: grantId, userId, revokedAt: null },
    select: { id: true },
  });
  if (!grant) return false;
  await prisma.$transaction((tx) => revokeGrantTx(tx, grant.id));
  return true;
}

/**
 * Revoca **todos** los asistentes de una cuenta. Se llama al cambiar la contraseña o canjear
 * un código de recuperación: tras un "me robaron la cuenta", lo esperable es que todo lo que
 * estaba conectado deje de funcionar. Acepta un cliente de transacción para correr dentro de
 * la misma transacción que el cambio de contraseña.
 */
export async function revokeAllGrantsForUser(
  userId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<number> {
  const at = BigInt(nowMs());
  const grants = await tx.oAuthGrant.findMany({
    where: { userId, revokedAt: null },
    select: { id: true },
  });
  if (grants.length === 0) return 0;
  const ids = grants.map((g) => g.id);
  await tx.oAuthGrant.updateMany({
    where: { id: { in: ids } },
    data: { revokedAt: at },
  });
  await tx.oAuthToken.updateMany({
    where: { grantId: { in: ids }, revokedAt: null },
    data: { revokedAt: at },
  });
  return ids.length;
}

/**
 * Limpieza para el cron diario: borra códigos vencidos y tokens cuyo refresh venció (o que
 * fueron revocados) hace más de `olderThanMs`. Los grants revocados se conservan: son
 * historia chica y explican por qué un asistente dejó de funcionar.
 */
export async function pruneExpiredOAuthRows(
  olderThanMs = 7 * 24 * 60 * 60 * 1000,
): Promise<{ codes: number; tokens: number }> {
  const cutoff = BigInt(nowMs() - olderThanMs);
  const codes = await prisma.oAuthAuthorizationCode.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  const tokens = await prisma.oAuthToken.deleteMany({
    where: {
      OR: [{ refreshExpiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
    },
  });
  return { codes: codes.count, tokens: tokens.count };
}
