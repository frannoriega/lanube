import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { revokeGrantForUser } from "@/lib/oauth/server";
import { loginUserIdOf } from "@/lib/passkeys/server";

type Params = { params: Promise<{ id: string }> };

/** DELETE: "Desconectar" un asistente propio — revoca el grant y todos sus tokens. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;
    const userId = await loginUserIdOf(session.userId);
    if (!userId) return apiError("Usuario no encontrado", 404);
    const { id } = await params;
    if (!(await revokeGrantForUser(userId, id)))
      return apiError("Asistente no encontrado", 404);
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiCatch("user/assistants DELETE", err);
  }
}
