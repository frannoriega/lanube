import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import {
  buildClientRedirect,
  validateAuthorizationRequest,
} from "@/lib/oauth/authorize";
import { requestOrigin } from "@/lib/oauth/origin";
import { createAuthorizationCode } from "@/lib/oauth/server";
import { loginUserIdOf } from "@/lib/passkeys/server";
import { z } from "zod";

/**
 * POST: la decisión de la pantalla de consentimiento (`/oauth/authorize`, milestone 20).
 * Recibe los mismos parámetros del pedido más `decision`, **vuelve a validar todo** (nunca
 * confía en lo que mostró la página) y responde `{ redirectTo }`: la URL del cliente con el
 * `code` (Permitir) o con `error=access_denied` (Cancelar). La pantalla navega ahí.
 *
 * Con sesión (cookie) y `requireActiveSession()`: un suspendido o alguien con políticas
 * pendientes no puede autorizar. Contra CSRF: la cookie de sesión es `SameSite=Lax` (un POST
 * desde otro sitio no la lleva), el cuerpo es JSON (un formulario ajeno no puede mandarlo sin
 * preflight), y además se exige que `Origin` sea el propio.
 */

const bodySchema = z.object({
  decision: z.enum(["allow", "deny"]),
  client_id: z.string().max(2048),
  redirect_uri: z.string().max(2048).nullish(),
  response_type: z.string().max(32).nullish(),
  code_challenge: z.string().max(128).nullish(),
  code_challenge_method: z.string().max(16).nullish(),
  scope: z.string().max(512).nullish(),
  state: z.string().max(2048).nullish(),
  resource: z.string().max(2048).nullish(),
});

export async function POST(request: Request) {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;

    const origin = requestOrigin(request);
    const sentOrigin = request.headers.get("origin");
    if (sentOrigin && sentOrigin !== origin)
      return apiError("Origen no permitido", 403);

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("Pedido inválido", 400);
    const { decision, ...params } = parsed.data;

    const result = await validateAuthorizationRequest(params, origin);
    if (result.kind === "fatal") return apiError(result.message, 400);
    if (result.kind === "redirect")
      return apiSuccess({ redirectTo: result.redirectTo });

    if (decision === "deny") {
      return apiSuccess({
        redirectTo: buildClientRedirect(result.redirectUri, origin, {
          error: "access_denied",
          error_description: "La persona no autorizó el acceso",
          state: result.state,
        }),
      });
    }

    const userId = await loginUserIdOf(session.userId);
    if (!userId) return apiError("Usuario no encontrado", 401);

    const code = await createAuthorizationCode({
      userId,
      clientRowId: result.client.id,
      scopes: result.scopes,
      redirectUri: result.redirectUri,
      codeChallenge: result.codeChallenge,
      resource: result.resource,
    });
    return apiSuccess({
      redirectTo: buildClientRedirect(result.redirectUri, origin, {
        code,
        state: result.state,
      }),
    });
  } catch (err) {
    return apiCatch("oauth/authorize POST", err);
  }
}
