import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import {
  finishPasskeyRegistration,
  listPasskeys,
  loginUserIdOf,
  MAX_PASSKEYS_PER_USER,
} from "@/lib/passkeys/server";
import { passkeyRegistrationSchema } from "@/lib/schemas/passkeys";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { NextRequest } from "next/server";

/** GET: passkeys del usuario (sin material criptográfico). */
export async function GET() {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;
    const userId = await loginUserIdOf(session.userId);
    if (!userId) return apiError("Usuario no encontrado", 404);
    return apiSuccess({
      passkeys: await listPasskeys(userId),
      max: MAX_PASSKEYS_PER_USER,
    });
  } catch (err) {
    return apiCatch("user/passkeys GET", err);
  }
}

/** POST: paso 2 del alta — `{ challengeId, label, response }`. */
export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;
    const userId = await loginUserIdOf(session.userId);
    if (!userId) return apiError("Usuario no encontrado", 404);

    const parsed = passkeyRegistrationSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Datos inválidos",
        400,
      );
    }

    const created = await finishPasskeyRegistration(
      userId,
      {
        challengeId: parsed.data.challengeId,
        label: parsed.data.label,
        response: parsed.data.response as unknown as RegistrationResponseJSON,
      },
      request,
    );
    return apiSuccess(created, { status: 201 });
  } catch (err) {
    return apiCatch("user/passkeys POST", err);
  }
}
