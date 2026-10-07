import { PolicyDocument } from "@/components/organisms/policies/policy-document";
import { nowMs } from "@/lib/clock";
import { formatPolicyDate } from "@/lib/policies/format";
import { currentVersion } from "@/lib/policies/pending";
import {
  getPolicyBySlug,
  POLICIES,
  POLICY_KEYS,
} from "@/lib/policies/registry";
import { Archive } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
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

/** Cada versión publicada de cada política se genera en el build. */
export function generateStaticParams() {
  return POLICY_KEYS.flatMap((key) =>
    POLICIES[key].versions.map((v) => ({
      slug: POLICIES[key].slug,
      version: v.version,
    })),
  );
}

type Params = { params: Promise<{ slug: string; version: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, version } = await params;
  const found = getPolicyBySlug(slug);
  // Slug o versión desconocidos: ni siquiera se arma metadata (la página muestra "no existe").
  if (!found) notFound();
  if (!found.policy.versions.some((v) => v.version === version)) notFound();
  return {
    title: `${found.policy.title} (versión del ${formatPolicyDate(version)}) | La Nube`,
    // Una versión archivada no debería competir en buscadores con la vigente.
    robots: { index: false },
  };
}

/**
 * Una versión puntual de una política (milestone 19), vigente o archivada. Es lo que permite
 * mostrarle a una persona **exactamente el texto que aceptó** (Configuración → Cuenta y el
 * detalle de usuario del admin enlazan acá).
 *
 * Si no es la vigente, lo dice arriba y enlaza a la vigente. Dinámica por la misma razón que
 * `/policies/[slug]`: "vigente" depende del reloj.
 */
export default async function PolicyVersionPage({ params }: Params) {
  const { slug, version: versionId } = await params;
  const found = getPolicyBySlug(slug);
  if (!found) notFound();
  const version = found.policy.versions.find((v) => v.version === versionId);
  if (!version) notFound();

  const current = currentVersion(found.policy, nowMs());
  const isCurrent = current?.version === version.version;
  const notYet = !current || version.effectiveAt > current.effectiveAt;

  return (
    <PolicyDocument
      policy={found.policy}
      version={version}
      historyHref={`/policies/${found.policy.slug}/versions`}
      notice={
        !isCurrent && (
          <p
            role="note"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          >
            <Archive className="size-4 shrink-0" aria-hidden />
            {notYet
              ? `Esta versión todavía no rige: entra en vigencia el ${formatPolicyDate(version.effectiveAt)}.`
              : "Esta no es la versión vigente."}
            <Link
              href={`/policies/${found.policy.slug}`}
              className="font-medium underline underline-offset-4"
            >
              Ver la versión vigente
            </Link>
          </p>
        )
      }
    />
  );
}
