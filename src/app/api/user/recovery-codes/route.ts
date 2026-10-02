import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { loginUserIdOf } from "@/lib/passkeys/server";
import {
  getRecoveryCodeStatus,
  regenerateRecoveryCodes,
} from "@/lib/recovery-codes/server";
import { NextRequest } from "next/server";
import z from "zod";

/** GET: estado del juego vigente (cuántos quedan), nunca los códigos. */
export async function GET() {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;
    const userId = await loginUserIdOf(session.userId);
    if (!userId) return apiError("Usuario no encontrado", 404);
    return apiSuccess(await getRecoveryCodeStatus(userId));
  } catch (err) {
    return apiCatch("user/recovery-codes GET", err);
  }
}

/**
 * POST: genera un juego nuevo (invalida el anterior) — `{ password }`. Devuelve los códigos
 * en claro; es la única vez que se pueden ver.
 */
export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;
    const userId = await loginUserIdOf(session.userId);
    if (!userId) return apiError("Usuario no encontrado", 404);

    const parsed = z
      .object({
        password: z.string().min(1, { message: "Ingresá tu contraseña" }),
      })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Datos inválidos",
        400,
      );
    }
    const codes = await regenerateRecoveryCodes(userId, parsed.data.password);
    return apiSuccess({ codes });
  } catch (err) {
    return apiCatch("user/recovery-codes POST", err);
  }
}
