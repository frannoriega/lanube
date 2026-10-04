import Container from "@/components/atoms/container";
import { SectionHeading } from "@/components/templates/landing/shared/section-heading";
import { nowMs } from "@/lib/clock";
import { formatPolicyDate, splitPolicyTitle } from "@/lib/policies/format";
import { currentVersion } from "@/lib/policies/pending";
import { getPolicyBySlug } from "@/lib/policies/registry";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const found = getPolicyBySlug((await params).slug);
  // Slug o versión desconocidos: ni siquiera se arma metadata (la página muestra "no existe").
  if (!found) notFound();
  return { title: `Versiones: ${found.policy.title} | La Nube` };
}

/**
 * Historial de versiones de una política (milestone 19): la sección 12 de la política de
 * privacidad promete publicar los cambios con su fecha; esto es esa promesa cumplida sin
 * depender de que alguien actualice una constante a mano. Más nueva primero.
 */
export default async function PolicyVersionsPage({ params }: Params) {
  await connection();
  const found = getPolicyBySlug((await params).slug);
  if (!found) notFound();
  const { policy } = found;
  const current = currentVersion(policy, nowMs());
  const heading = splitPolicyTitle(policy.title);

  return (
    <Container className="h-fit">
      <div className="mx-4 my-12 flex max-w-3xl flex-col gap-10 sm:mx-8">
        <SectionHeading
          as="h1"
          eyebrow="políticas · versiones"
          title={heading.title}
          accent={heading.accent}
          lead="Todas las versiones publicadas, con lo que cambió en cada una."
        />
        <ol className="flex flex-col gap-4">
          {[...policy.versions].reverse().map((v) => {
            const isCurrent = v.version === current?.version;
            const future =
              !current || v.effectiveAt > (current?.effectiveAt ?? "");
            return (
              <li
                key={v.version}
                className="flex flex-col gap-3 rounded-2xl border bg-card/70 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/policies/${policy.slug}/versions/${v.version}`}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    Versión del {formatPolicyDate(v.version)}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {isCurrent
                      ? "Vigente"
                      : future
                        ? `Rige desde el ${formatPolicyDate(v.effectiveAt)}`
                        : `Rigió desde el ${formatPolicyDate(v.effectiveAt)}`}
                  </span>
                </div>
                {v.changeSummary ? (
                  <ul className="list-disc pl-5 text-sm leading-relaxed">
                    {v.changeSummary.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Primera versión publicada.
                  </p>
                )}
                {v.requiresAcceptance && v.reacceptance === "required" && (
                  <p className="text-xs text-muted-foreground">
                    Requirió aceptación expresa de cada persona usuaria.
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </Container>
  );
}
