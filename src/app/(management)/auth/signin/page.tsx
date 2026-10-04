import { nowMs } from "@/lib/clock";
import { pendingPolicies } from "@/lib/policies/pending";
import { POLICIES } from "@/lib/policies/registry";
import { connection } from "next/server";
import { SignInScreen } from "./signin-screen";

/**
 * Ingreso y registro. Es de servidor solo para leer del registro qué políticas hay que aceptar
 * al crear una cuenta (milestone 19) — "lo pendiente de una cuenta sin aceptaciones" — y
 * pasárselas a la pantalla, que es de cliente.
 *
 * Dinámica (`connection()`): qué versión rige depende del reloj; prerenderizada quedaría
 * congelada la del momento del build.
 */
export default async function SignInPage() {
  await connection();
  const requiredPolicies = pendingPolicies(POLICIES, [], nowMs()).map(
    ({ key, version, title, slug }) => ({ key, version, title, slug }),
  );
  return <SignInScreen requiredPolicies={requiredPolicies} />;
}
