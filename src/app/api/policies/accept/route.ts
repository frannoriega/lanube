import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { auth } from "@/lib/auth";
import {
  getPendingPoliciesForUser,
  recordPolicyAcceptances,
} from "@/lib/db/policies";
import { getAcceptanceEvidence } from "@/lib/policies/evidence";
import { checkSubmittedAcceptances } from "@/lib/policies/pending";
import { prisma } from "@/lib/prisma";
import { acceptPoliciesSchema } from "@/lib/schemas/auth";
import type { NextRequest } from "next/server";

/**
 * Aceptar las políticas pendientes desde la pantalla "Actualizamos nuestras políticas"
 * (milestone 19).
 *
 * **No usa `requireActiveSession()` a propósito**: ese guard rechaza justamente a quien tiene
 * políticas pendientes, que es el único que llama a esta ruta. Tampoco exige perfil completo:
 * una cuenta creada antes del milestone acepta antes de completar el perfil. Por eso la
 * cuenta se resuelve por el email de la sesión (`User`), no por `session.userId` (que es el id
 * del perfil y puede no existir).
 *
 * El servidor recalcula lo pendiente y valida lo enviado contra eso
 * (`checkSubmittedAcceptances`): 400 si falta alguna, 409 si la versión cambió mientras la
 * persona leía. Guarda versión y hash **del registro**, con IP y user-agent. Si no había nada
 * pendiente (doble envío, otra pestaña), responde 200 sin registrar nada.
 *
 * Después de esto el cliente pide `/api/auth/session` para que la cookie se reescriba con
 * `policiesPending: false` (el `jwt()` lo recalcula desde la base; no se puede mandar).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return apiError("No autorizado", 401);

    const parsed = acceptPoliciesSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return apiError("Datos inválidos", 400);

    const account = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!account) return apiError("No autorizado", 401);

    const pending = await getPendingPoliciesForUser(account.id);
    if (pending.length === 0) return apiSuccess({ accepted: 0 });

    const check = checkSubmittedAcceptances(pending, parsed.data.accepted);
    if (!check.ok) {
      return apiError(
        check.message,
        check.status,
        check.status === 409 ? { code: "POLICIES_CHANGED" } : undefined,
      );
    }

    await recordPolicyAcceptances(
      prisma,
      account.id,
      check.accepted,
      "REACCEPT",
      await getAcceptanceEvidence(),
    );
    return apiSuccess({ accepted: check.accepted.length });
  } catch (error) {
    return apiCatch("policies/accept POST", error);
  }
}
