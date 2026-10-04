import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { listConnectedAssistants } from "@/lib/oauth/server";
import { mcpResourceUrl, requestOrigin } from "@/lib/oauth/origin";
import { loginUserIdOf } from "@/lib/passkeys/server";

/**
 * GET: los asistentes conectados por MCP de la cuenta (milestone 20) y la URL del endpoint
 * MCP a pegar en el asistente — calculada del host de esta request, así en una preview de
 * Vercel muestra la de la preview.
 */
export async function GET(request: Request) {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;
    const userId = await loginUserIdOf(session.userId);
    if (!userId) return apiError("Usuario no encontrado", 404);
    return apiSuccess({
      assistants: await listConnectedAssistants(userId),
      mcpUrl: mcpResourceUrl(requestOrigin(request)),
    });
  } catch (err) {
    return apiCatch("user/assistants GET", err);
  }
}
