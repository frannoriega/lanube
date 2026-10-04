import Container from "@/components/atoms/container";
import { SectionHeading } from "@/components/templates/landing/shared/section-heading";
import { nowMs } from "@/lib/clock";
import { formatPolicyDate } from "@/lib/policies/format";
import { currentVersion } from "@/lib/policies/pending";
import { POLICIES, POLICY_KEYS } from "@/lib/policies/registry";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

export const metadata = {
  title: "Políticas | La Nube",
  description: "Las políticas que rigen el uso de La Nube.",
};

/**
 * Índice de políticas (milestone 19): una tarjeta por política con su fecha de vigencia.
 * Sale del registro, así que una política nueva aparece acá sola.
 */
export default async function PoliciesIndexPage() {
  await connection();
  const now = nowMs();
  return (
    <Container className="h-fit">
      <div className="mx-4 my-12 flex max-w-3xl flex-col gap-10 sm:mx-8">
        <SectionHeading
          as="h1"
          eyebrow="políticas"
          title="Nuestras"
          accent="políticas"
          lead="Las reglas que rigen el uso de La Nube y el tratamiento de tus datos."
        />
        <ul className="flex flex-col gap-4">
          {POLICY_KEYS.map((key) => {
            const policy = POLICIES[key];
            const current = currentVersion(policy, now);
            if (!current) return null;
            return (
              <li key={key}>
                <Link
                  href={`/policies/${policy.slug}`}
                  className="group flex items-center justify-between gap-4 rounded-2xl border bg-card/70 p-5 transition-colors hover:bg-card"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold">{policy.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {policy.description}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Vigente desde el {formatPolicyDate(current.effectiveAt)}
                    </span>
                  </div>
                  <ArrowRight
                    className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </Container>
  );
}
