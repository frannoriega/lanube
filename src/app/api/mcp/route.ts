import { createMcpHandler } from "@modelcontextprotocol/server";
import { logger } from "@/lib/logger";
import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { buildMcpServer } from "@/lib/mcp/tools";
import {
  corsPreflight,
  protectedResourceMetadataUrl,
  withCors,
} from "@/lib/oauth/http";
import { mcpResourceUrl, requestOrigin } from "@/lib/oauth/origin";
import { NextResponse } from "next/server";

/**
 * Endpoint MCP de La Nube (milestone 20): `https://<host>/api/mcp`, la única URL que la
 * persona pega en su asistente ("Agregar conector personalizado").
 *
 * **Es una ruta más de la app, no un servidor aparte.** La revisión 2026-07-28 de MCP es sin
 * estado (sin `initialize` ni `Mcp-Session-Id`) y el SDK v2 (`@modelcontextprotocol/server`)
 * arma una instancia nueva por request (`createMcpHandler`), así que corre igual en una
 * función de Vercel (incluido el plan gratuito: son requests cortas, JSON, sin conexiones
 * largas) que bajo `next start` en un VPS. El tráfico de la era 2025 (clientes que todavía
 * mandan `initialize`) lo atiende el mismo handler en modo "stateless legacy", que es el
 * default del SDK.
 *
 * Autorización: OAuth 2.1 con La Nube como servidor de autorización (`src/lib/oauth/`). Sin
 * token válido → `401` con `WWW-Authenticate: Bearer resource_metadata="…"` (RFC 9728), que es
 * lo que dispara el flujo OAuth en el asistente. Con token válido pero la cuenta bloqueada
 * (perfil, baneo, políticas), las tools responden con un error legible — ver
 * `src/lib/mcp/auth.ts` por qué no es un 401.
 *
 * `responseMode` queda en el default (`auto`): como ninguna tool emite progreso, la respuesta
 * moderna es siempre un JSON simple. (`"json"` forzado hace que el SDK escriba un aviso en el
 * log en cada request.) Las requests de la era 2025 las responde el transporte legacy como
 * SSE de un solo mensaje; son igual de cortas.
 */

function unauthorized(origin: string, invalid: boolean): NextResponse {
  const params = [
    `resource_metadata="${protectedResourceMetadataUrl(origin)}"`,
    ...(invalid
      ? [
          'error="invalid_token"',
          'error_description="El token es inválido, venció o fue revocado"',
        ]
      : []),
  ];
  return withCors(
    NextResponse.json(
      {
        error: invalid ? "invalid_token" : "unauthorized",
        error_description: "Se requiere autorización OAuth para usar La Nube",
      },
      {
        status: 401,
        headers: { "WWW-Authenticate": `Bearer ${params.join(", ")}` },
      },
    ),
  );
}

async function handle(request: Request): Promise<Response> {
  const origin = requestOrigin(request);
  try {
    const auth = await authenticateMcpRequest(
      request,
      mcpResourceUrl(origin),
      origin,
    );
    if (auth.kind === "unauthorized")
      return unauthorized(origin, auth.reason === "invalid");

    const handler = createMcpHandler(
      () =>
        buildMcpServer({
          origin,
          user: auth.kind === "ok" ? auth.user : null,
          blockedMessage: auth.kind === "blocked" ? auth.message : null,
        }),
      {
        onerror: (err) => logger.warn("mcp handler", { error: err.message }),
      },
    );
    return withCors(await handler.fetch(request));
  } catch (err) {
    logger.error("mcp route", err);
    return withCors(
      NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32603, message: "Error interno del servidor" },
        },
        { status: 500 },
      ),
    );
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;

export function OPTIONS() {
  return corsPreflight();
}
