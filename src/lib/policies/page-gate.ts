import "server-only";
import type { Session } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PATHNAME_HEADER, policyGateUrl } from "./gate";

/**
 * Gate de políticas para layouts y páginas de servidor (milestone 19). El middleware ya
 * redirige, pero lee el JWT de la cookie, que puede estar atrasado: si una versión entra en
 * vigencia a mitad de sesión, la cookie dice "nada pendiente" hasta que el cliente la
 * refresque. `auth()` en el servidor recalcula el token desde la base, así que esto frena en
 * la siguiente navegación sin esperar a la cookie.
 *
 * La ruta a la que volver la pone el middleware en un header (`PATHNAME_HEADER`).
 */
export async function redirectIfPoliciesPending(
  session: Pick<Session, "policiesPending">,
): Promise<void> {
  if (!session.policiesPending) return;
  const h = await headers();
  redirect(policyGateUrl(h.get(PATHNAME_HEADER)));
}
