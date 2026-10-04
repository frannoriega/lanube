import { PolicyDocument } from "@/components/organisms/policies/policy-document";
import { nowMs } from "@/lib/clock";
import { currentVersion } from "@/lib/policies/pending";
import { getPolicyBySlug } from "@/lib/policies/registry";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

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
 * Se renderiza en cada request (`connection()`): "vigente" depende del reloj, y una versión
 * desplegada con `effectiveAt` futuro tiene que aparecer sola ese día, sin otro deploy. Con
 * prerender estático quedaría congelada la que regía al momento del build.
 */
export default async function PolicyPage({ params }: Params) {
  await connection();
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
