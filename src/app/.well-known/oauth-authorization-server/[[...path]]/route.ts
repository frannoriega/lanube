import {
  authorizationServerMetadata,
  corsPreflight,
  oauthJson,
} from "@/lib/oauth/http";
import { requestOrigin } from "@/lib/oauth/origin";

/**
 * Authorization Server Metadata (RFC 8414) del servidor OAuth de La Nube (milestone 20):
 * endpoints, PKCE S256, DCR y CIMD soportados. Catch-all opcional por la misma razón que la
 * metadata del recurso (algunos clientes le insertan un path).
 */
export function GET(request: Request) {
  return oauthJson(authorizationServerMetadata(requestOrigin(request)));
}

export function OPTIONS() {
  return corsPreflight();
}
