import { AcceptPoliciesForm } from "@/components/organisms/policies/accept-policies-form";
import { PolicyDiff } from "@/components/organisms/policies/policy-diff";
import { auth } from "@/lib/auth";
import { getPendingPoliciesForUser } from "@/lib/db/policies";
import { formatPolicyDate } from "@/lib/policies/format";
import { safeGateNext } from "@/lib/policies/gate";
import { getPolicy, isPolicyKey } from "@/lib/policies/registry";
import { diffPolicyVersions } from "@/lib/policies/source";
import { prisma } from "@/lib/prisma";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Actualizamos nuestras políticas | La Nube",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ next?: string | string[] }> };

/**
 * El gate de políticas (milestone 19, punto (d) del pedido): a quien tenga políticas sin
 * aceptar, el middleware, los layouts de `/user` y `/admin`, y la API lo mandan acá, y no
 * puede seguir hasta aceptar.
 *
 * Dos variantes de texto: "Actualizamos nuestras políticas" cuando ya había aceptado alguna
 * versión (con el resumen de cambios y el diff contra la que aceptó), y "Antes de seguir…"
 * cuando nunca aceptó nada (las cuentas creadas antes de este milestone, la primera vez).
 *
 * Si al llegar no hay nada pendiente, la pantalla no redirige desde el servidor: la cookie
 * podría seguir diciendo "pendiente" y el middleware la mandaría de vuelta acá (loop). El
 * formulario refresca la sesión y recién después sale (ver `AcceptPoliciesForm`).
 */
export default async function AcceptPoliciesPage({ searchParams }: Props) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/auth/signin");
  if (session.banned) redirect("/banned");

  const rawNext = (await searchParams).next;
  const next = safeGateNext(Array.isArray(rawNext) ? rawNext[0] : rawNext);

  const account = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!account) redirect("/auth/signin");

  const pending = await getPendingPoliciesForUser(account.id);
  const isUpdate = pending.some((p) => p.previouslyAccepted !== null);

  const diffs = await Promise.all(
    pending.map((p) =>
      p.previouslyAccepted && isPolicyKey(p.key)
        ? diffPolicyVersions(getPolicy(p.key), p.previouslyAccepted, p.version)
        : null,
    ),
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-la-nube-ink dark:text-white">
          {isUpdate
            ? "Actualizamos nuestras políticas"
            : "Antes de seguir, aceptá nuestras políticas"}
        </h1>
        <p className="text-muted-foreground">
          {isUpdate
            ? "Cambiaron algunas de las políticas que rigen el uso de La Nube. Para seguir usando la plataforma, leelas y aceptalas."
            : "Para usar La Nube necesitamos que leas y aceptes estas políticas. Es un paso único: solo te lo vamos a volver a pedir si cambian."}
        </p>
      </div>

      {pending.length > 0 && (
        <ul className="flex flex-col gap-4">
          {pending.map((p, i) => {
            const diff = diffs[i];
            return (
              <li
                key={p.key}
                className="flex flex-col gap-3 rounded-xl border bg-background/60 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold">{p.title}</h2>
                  <span className="text-sm text-muted-foreground">
                    Vigente desde el {formatPolicyDate(p.effectiveAt)}
                  </span>
                </div>

                {p.changes.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium">Qué cambió:</p>
                    <ul className="list-disc pl-5 text-sm leading-relaxed">
                      {p.changes.flatMap((c) =>
                        c.summary.map((line) => (
                          <li key={`${c.version}-${line}`}>{line}</li>
                        )),
                      )}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <a
                    href={`/policies/${p.slug}/versions/${p.version}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium underline underline-offset-4"
                  >
                    Leer la política completa
                    <ExternalLink className="size-3" aria-hidden />
                    <span className="sr-only">(se abre en otra pestaña)</span>
                  </a>
                </div>

                {diff && p.previouslyAccepted && (
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium underline-offset-4 hover:underline">
                      Ver qué cambió en el texto (desde la versión del{" "}
                      {formatPolicyDate(p.previouslyAccepted)} que aceptaste)
                    </summary>
                    <div className="mt-3">
                      <PolicyDiff lines={diff} />
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AcceptPoliciesForm
        policies={pending.map(({ key, version, title, slug }) => ({
          key,
          version,
          title,
          slug,
        }))}
        next={next}
      />
    </div>
  );
}
