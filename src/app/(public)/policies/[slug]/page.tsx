import { PolicyDocument } from "@/components/organisms/policies/policy-document";
import { nowMs } from "@/lib/clock";
import { currentVersion } from "@/lib/policies/pending";
import {
  getPolicyBySlug,
  POLICIES,
  POLICY_KEYS,
} from "@/lib/policies/registry";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * ISR (milestone 25, P2), en vez de renderizar en cada pedido con `connection()`. Qué versión
 * está «vigente» depende del reloj: una versión desplegada con `effectiveAt` futuro aparece
 * sola a lo sumo `revalidate` segundos después de esa hora (más la visita que dispara la
 * regeneración), sin otro deploy. El texto vive en el código, así que no hay tag que invalidar:
 * un deploy lo regenera todo. La aceptación obligatoria no depende de esta página (la decide
 * `pendingPolicies()` en cada pedido del área logueada). `public-cache.test.ts` comprueba que el
 * literal sea igual a PUBLIC_REVALIDATE_SECONDS.
 */
export const revalidate = 300;

/** Todas las políticas del registro se generan en el build. */
export function generateStaticParams() {
  return POLICY_KEYS.map((key) => ({ slug: POLICIES[key].slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const found = getPolicyBySlug((await params).slug);
  // Slug o versión desconocidos: ni siquiera se arma metadata (la página muestra "no existe").
  if (!found) notFound();
  return {
    title: `${found.policy.title} | La Nube`,
    description: found.policy.description,
  };
}

/**
 * La versión **vigente** de una política (milestone 19). Reemplaza a la página fija
 * `/policies/privacy` del milestone 18; la URL no cambió.
 *
 * "Vigente" depende del reloj: ver el comentario de `revalidate` arriba (milestone 25, P2).
 */
export default async function PolicyPage({ params }: Params) {
  const found = getPolicyBySlug((await params).slug);
  if (!found) notFound();
  const version = currentVersion(found.policy, nowMs());
  if (!version) notFound();

  return (
    <PolicyDocument
      policy={found.policy}
      version={version}
      historyHref={
        found.policy.versions.length > 1
          ? `/policies/${found.policy.slug}/versions`
          : undefined
      }
    />
  );
}
