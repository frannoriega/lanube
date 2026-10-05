import Container from "@/components/atoms/container";
import { SectionHeading } from "@/components/templates/landing/shared/section-heading";
import { formatPolicyDate, splitPolicyTitle } from "@/lib/policies/format";
import type { PolicyDefinition, PolicyVersion } from "@/lib/policies/registry";
import { ReadingProgress } from "@/components/templates/landing/news/reading-progress";
import { readingMinutes } from "@/lib/news/reading-time";
import { readPolicyMarkdown } from "@/lib/policies/source";
import { CalendarClock, Clock, History } from "lucide-react";
import Link from "next/link";
import { PolicyContent } from "./policy-content";
import { TableOfContents } from "./table-of-contents";

/**
 * Una versión de una política, lista para leer (diseño del milestone 18, generalizado en el
 * 19 para cualquier política y versión): columna de lectura angosta (~70 caracteres por
 * renglón), la fecha de vigencia arriba y un índice fijo a la izquierda en escritorio que marca
 * la sección que se está leyendo.
 *
 * - `notice`: un aviso arriba del texto (la página de una versión archivada dice "esta no es
 *   la versión vigente").
 * - `historyHref`: si hay más de una versión, el enlace "Versiones anteriores".
 *
 * Muestra el tiempo estimado de lectura y, mientras se lee el texto, la píldora flotante de
 * progreso (`ReadingProgress`, la misma de las noticias) con el porcentaje y los minutos que
 * faltan. El tiempo se calcula del markdown fuente (`readPolicyMarkdown`); si no se pudo
 * leer, simplemente no se muestra ni el tiempo ni la píldora.
 *
 * Server Component: el MDX lo renderiza `PolicyContent` (cliente, por cómo `@next/mdx`
 * resuelve componentes).
 */
export async function PolicyDocument({
  policy,
  version,
  notice,
  historyHref,
}: {
  policy: PolicyDefinition;
  version: PolicyVersion;
  notice?: React.ReactNode;
  historyHref?: string;
}) {
  const heading = splitPolicyTitle(policy.title);
  const source = await readPolicyMarkdown(policy, version.version);
  const minutes = source ? readingMinutes(source) : null;
  return (
    <Container className="h-fit">
      <div className="mx-4 my-12 flex flex-col gap-10 sm:mx-8">
        <div className="flex flex-col gap-4">
          <SectionHeading
            as="h1"
            eyebrow="políticas"
            title={heading.title}
            accent={heading.accent}
            lead={policy.description}
          />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <CalendarClock className="size-4" aria-hidden />
              Vigente desde el {formatPolicyDate(version.effectiveAt)}
            </p>
            {minutes !== null && (
              <p className="flex items-center gap-2">
                <Clock className="size-4" aria-hidden />
                {minutes} min de lectura
              </p>
            )}
            {historyHref && (
              <Link
                href={historyHref}
                className="flex items-center gap-2 underline-offset-4 hover:text-foreground hover:underline"
              >
                <History className="size-4" aria-hidden />
                Versiones anteriores
              </Link>
            )}
          </div>
          {notice}
        </div>

        <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <TableOfContents />
            </div>
          </aside>
          <article
            id="politica"
            className="max-w-[70ch] rounded-2xl border bg-card/70 p-6 text-base leading-relaxed text-foreground backdrop-blur-sm sm:p-10 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:scroll-mt-28 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-la-nube-ink [&_h2:first-of-type]:mt-0 dark:[&_h2]:text-white [&_hr]:hidden [&_li]:my-1 [&_p]:my-3 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
          >
            <PolicyContent file={version.file} />
          </article>
        </div>
      </div>
      {minutes !== null && (
        <ReadingProgress targetId="politica" minutes={minutes} />
      )}
    </Container>
  );
}
