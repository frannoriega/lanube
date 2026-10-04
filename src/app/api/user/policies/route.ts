import { apiCatch, apiSuccess } from "@/lib/api/response";
import { requireActiveSession } from "@/lib/api-auth";
import {
  listPolicyAcceptances,
  type AcceptedPolicyItem,
} from "@/lib/db/policies";
import { getRegisteredUserById } from "@/lib/db/users";
import { getPolicy, isPolicyKey } from "@/lib/policies/registry";

/**
 * Historial de aceptaciones de políticas de la cuenta propia, la más nueva primero
 * (milestone 19). Solo lectura: una aceptación no se edita ni se retira desde acá.
 */
export async function GET() {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;
    const profile = await getRegisteredUserById(session.userId);
    if (!profile) return apiSuccess([]);

    const rows = await listPolicyAcceptances(profile.userId);
    const items: AcceptedPolicyItem[] = rows.map((r) => {
      const policy = isPolicyKey(r.policyKey) ? getPolicy(r.policyKey) : null;
      return {
        policyKey: r.policyKey,
        title: policy?.title ?? r.policyKey,
        href: policy ? `/policies/${policy.slug}/versions/${r.version}` : null,
        version: r.version,
        acceptedAt: r.acceptedAt,
        context: r.context,
      };
    });
    return apiSuccess(items);
  } catch (err) {
    return apiCatch("user/policies GET", err);
  }
}
