import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { loginUserIdOf, startPasskeyRegistration } from "@/lib/passkeys/server";
import { NextRequest } from "next/server";

/** POST: paso 1 del alta de una passkey — devuelve `{ challengeId, options }`. */
export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;
    const userId = await loginUserIdOf(session.userId);
    if (!userId) return apiError("Usuario no encontrado", 404);
    return apiSuccess(await startPasskeyRegistration(userId, request));
  } catch (err) {
    return apiCatch("user/passkeys/options POST", err);
  }
}
