import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import {
  deletePasskey,
  loginUserIdOf,
  renamePasskey,
} from "@/lib/passkeys/server";
import { passkeyLabelSchema } from "@/lib/schemas/passkeys";
import { NextRequest } from "next/server";
import z from "zod";

type Params = { params: Promise<{ id: string }> };

/** PATCH: renombrar — `{ label }`. */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;
    const userId = await loginUserIdOf(session.userId);
    if (!userId) return apiError("Usuario no encontrado", 404);

    const parsed = z
      .object({ label: passkeyLabelSchema })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Nombre inválido",
        400,
      );
    }
    const { id } = await params;
    await renamePasskey(userId, id, parsed.data.label);
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiCatch("user/passkeys PATCH", err);
  }
}

/** DELETE: quitar una passkey propia. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;
    const userId = await loginUserIdOf(session.userId);
    if (!userId) return apiError("Usuario no encontrado", 404);
    const { id } = await params;
    await deletePasskey(userId, id);
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiCatch("user/passkeys DELETE", err);
  }
}
