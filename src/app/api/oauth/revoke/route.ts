import { corsPreflight, oauthCatch, withCors } from "@/lib/oauth/http";
import { revokeToken } from "@/lib/oauth/server";
import { NextResponse } from "next/server";

/**
 * POST: revocación de tokens (RFC 7009) — milestone 20. Lo llama el asistente cuando la
 * persona lo desconecta desde su lado. Responde 200 aunque el token no exista (la RFC lo pide,
 * para no revelar qué tokens son válidos). Desconectar desde La Nube es otra ruta
 * (`DELETE /api/user/assistants/[id]`), con sesión.
 */
export async function POST(request: Request) {
  try {
    const type = request.headers.get("content-type") ?? "";
    let token: string | null = null;
    if (type.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as {
        token?: unknown;
      } | null;
      token = typeof body?.token === "string" ? body.token : null;
    } else {
      token = new URLSearchParams(await request.text()).get("token");
    }
    if (token) await revokeToken(token);
    return withCors(new NextResponse(null, { status: 200 }));
  } catch (err) {
    return oauthCatch("oauth/revoke POST", err);
  }
}

export function OPTIONS() {
  return corsPreflight();
}
