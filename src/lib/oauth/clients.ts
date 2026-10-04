import "server-only";
import { z } from "zod";
import { nowMs } from "@/lib/clock";
import { prisma } from "@/lib/prisma";
import type { OAuthClient } from "@/generated/prisma/client";
import { CIMD_CACHE_TTL_MS } from "./config";
import { CimdError, fetchCimdDocument } from "./cimd";
import { generateOpaqueToken } from "./crypto";
import { OAuthError } from "./errors";
import { isRegistrableRedirectUri } from "./redirect-uri";
import { isAcceptableCimdUrl } from "./ssrf";

/**
 * Registro y resolución de clientes OAuth (milestone 20): los asistentes que se conectan.
 *
 * Dos formas de conocer a un cliente, las dos soportadas porque Claude y ChatGPT usan una u
 * otra según la versión:
 *
 * - **DCR** (RFC 7591, `POST /api/oauth/register`): el cliente manda su metadata y le damos
 *   un `client_id` opaco. Deprecado por la revisión 2026-07-28 de MCP, con ventana de 12
 *   meses.
 * - **CIMD**: el `client_id` es una URL https con la metadata. Lo traemos (con protección
 *   SSRF, `cimd.ts`) la primera vez que aparece y lo cacheamos 24 h.
 *
 * Todos son clientes **públicos** (sin secreto): PKCE + `redirect_uri` exacta hacen el
 * trabajo que en un cliente confidencial haría el secreto.
 */

/** Metadata que aceptamos en DCR (lo demás se ignora; RFC 7591 lo permite). */
export const dcrRequestSchema = z.object({
  redirect_uris: z.array(z.string()).min(1).max(20),
  client_name: z.string().trim().min(1).max(200).optional(),
  logo_uri: z.string().url().optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  token_endpoint_auth_method: z.string().optional(),
});

/** Nombre a usar cuando el cliente no declara ninguno. */
const UNNAMED_CLIENT = "Asistente sin nombre";

function assertRedirectUris(uris: string[]): void {
  const bad = uris.find((u) => !isRegistrableRedirectUri(u));
  if (bad)
    throw new OAuthError(
      "invalid_redirect_uri",
      `redirect_uri no permitida: ${bad}`,
    );
}

/** Registra un cliente por DCR. Devuelve la fila creada. */
export async function registerDcrClient(raw: unknown): Promise<OAuthClient> {
  const parsed = dcrRequestSchema.safeParse(raw);
  if (!parsed.success)
    throw new OAuthError(
      "invalid_client_metadata",
      "Metadata de cliente inválida: se requiere redirect_uris",
    );
  const data = parsed.data;
  assertRedirectUris(data.redirect_uris);
  // Solo authorization_code (+ refresh_token). Un cliente que pida otra cosa no es de los
  // que este servidor atiende.
  const grantTypes = data.grant_types ?? ["authorization_code"];
  if (
    grantTypes.some((g) => g !== "authorization_code" && g !== "refresh_token")
  )
    throw new OAuthError(
      "invalid_client_metadata",
      "Solo se soportan authorization_code y refresh_token",
    );
  if (data.response_types && data.response_types.some((r) => r !== "code"))
    throw new OAuthError(
      "invalid_client_metadata",
      "Solo se soporta response_type=code",
    );

  return prisma.oAuthClient.create({
    data: {
      clientId: generateOpaqueToken(),
      kind: "DCR",
      name: data.client_name ?? UNNAMED_CLIENT,
      redirectUris: data.redirect_uris,
      logoUri: data.logo_uri ?? null,
    },
  });
}

/**
 * El cliente de `clientId`, o `null` si no existe / no se pudo validar. Si parece una URL
 * CIMD, lo trae (o refresca el cache vencido) y lo guarda. Un fallo al refrescar un CIMD ya
 * conocido usa la copia cacheada en lugar de dejar al usuario sin poder conectarse.
 */
export async function resolveClient(
  clientId: string,
): Promise<OAuthClient | null> {
  if (!clientId || clientId.length > 2048) return null;
  const existing = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (existing?.kind === "DCR") return existing;
  if (!isAcceptableCimdUrl(clientId)) return existing;

  const fresh =
    existing?.metadataFetchedAt != null &&
    nowMs() - Number(existing.metadataFetchedAt) < CIMD_CACHE_TTL_MS;
  if (existing && fresh) return existing;

  try {
    const doc = await fetchCimdDocument(clientId);
    assertRedirectUris(doc.redirect_uris);
    const data = {
      name: doc.client_name ?? new URL(clientId).hostname,
      redirectUris: doc.redirect_uris,
      logoUri: doc.logo_uri ?? null,
      metadataFetchedAt: BigInt(nowMs()),
    };
    return await prisma.oAuthClient.upsert({
      where: { clientId },
      create: { clientId, kind: "CIMD", ...data },
      update: data,
    });
  } catch (err) {
    if (err instanceof CimdError || err instanceof OAuthError) return existing;
    throw err;
  }
}
