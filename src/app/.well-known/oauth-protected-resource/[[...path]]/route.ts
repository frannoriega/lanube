import {
  corsPreflight,
  oauthJson,
  protectedResourceMetadata,
} from "@/lib/oauth/http";
import { requestOrigin } from "@/lib/oauth/origin";

/**
 * Protected Resource Metadata (RFC 9728) del endpoint MCP (milestone 20). Es lo primero que
 * busca un asistente tras el `401` de `/api/mcp`: le dice qué servidor de autorización usar.
 *
 * Catch-all opcional porque los clientes la piden en las dos formas que admite la RFC: en la
 * raíz (`/.well-known/oauth-protected-resource`) y con el path del recurso insertado
 * (`/.well-known/oauth-protected-resource/api/mcp`). Hay un solo recurso, así que las dos
 * responden lo mismo.
 */
export function GET(request: Request) {
  return oauthJson(protectedResourceMetadata(requestOrigin(request)));
}

export function OPTIONS() {
  return corsPreflight();
}
