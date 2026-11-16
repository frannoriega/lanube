import Container from "@/components/atoms/container";
import { Markdown } from "@/components/molecules/markdown";
import { TableOfContents } from "@/components/organisms/policies/table-of-contents";
import { ReadingProgress } from "@/components/templates/landing/news/reading-progress";
import { SectionHeading } from "@/components/templates/landing/shared/section-heading";
import {
  adjacentReleases,
  APP_VERSION,
  getRelease,
  RELEASES,
} from "@/lib/changelog/registry";
import { readReleaseMarkdown } from "@/lib/changelog/source";
import { readingMinutes } from "@/lib/news/reading-time";
import { formatPolicyDate } from "@/lib/policies/format";
import { ArrowLeft, ArrowRight, CalendarDays, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * Todas las versiones del registro se generan en el build, y una versión que no está en el
 * registro es 404 sin intentar renderizarla (milestone 28). Estática pura: ver `../page.tsx`.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return RELEASES.map((r) => ({ version: r.version }));
}

type Params = { params: Promise<{ version: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const release = getRelease((await params).version);
  if (!release) notFound();
  return {
    title: `v${release.version}: ${release.title} | La Nube`,
    description: release.summary,
  };
}

/** `id` del cuerpo: lo miden la píldora de progreso y el índice. */
const BODY_ID = "cambios";

/**
 * Una versión (milestone 28), con el mismo armado que una política: encabezado a lo ancho
 * (número, título, resumen como copete, fecha, tiempo de lectura), y abajo el índice fijo a la
 * izquierda en escritorio junto al detalle en markdown (`src/assets/changelog/<version>.md`),
 * con la píldora de progreso de lectura (`ReadingProgress`) mientras se lee. Al final, enlaces
 * a la versión anterior y a la siguiente. Si el archivo no se pudo leer, queda el resumen.
 *
 * Los `##` del markdown llegan como `<h3>` (el `Markdown` baja un nivel cada título) y llevan
 * `id` (`headingIds`), que es lo que lee el índice.
 */
export default async function ReleasePage({ params }: Params) {
  const release = getRelease((await params).version);
  if (!release) notFound();
  const body = await readReleaseMarkdown(release);
  const minutes = body ? readingMinutes(body) : null;
  const { older, newer } = adjacentReleases(release.version);

  return (
    <Container className="h-fit">
      <div className="mx-4 my-12 flex flex-col gap-10 sm:mx-8">
        <div className="flex flex-col gap-6">
          <Link
            href="/changelog"
            className="flex w-fit items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Todas las versiones
          </Link>
          <SectionHeading
            as="h1"
            eyebrow={`novedades · v${release.version}`}
            title={release.title}
            lead={release.summary}
          />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <CalendarDays className="size-4" aria-hidden />
              Publicada el {formatPolicyDate(release.date)}
            </p>
            {minutes !== null && (
              <p className="flex items-center gap-2">
                <Clock className="size-4" aria-hidden />
                {minutes} min de lectura
              </p>
            )}
            {release.version === APP_VERSION && (
              <span className="rounded-full border px-2 py-0.5 text-xs">
                Versión actual
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <TableOfContents
                targetId={BODY_ID}
                selector="h3[id]"
                label="Índice de la versión"
              />
            </div>
          </aside>
          <div className="flex max-w-[75ch] flex-col gap-8">
            {body && (
              <article
                id={BODY_ID}
                className="rounded-2xl border bg-card/70 p-6 backdrop-blur-sm sm:p-10"
              >
                <Markdown
                  size="reading"
                  headingIds
                  className="[&_h3]:scroll-mt-28"
                >
                  {body}
                </Markdown>
              </article>
            )}
            {(older || newer) && (
              <nav
                aria-label="Otras versiones"
                className="grid gap-3 sm:grid-cols-2"
              >
                {older ? (
                  <Link
                    href={`/changelog/${older.version}`}
                    className="flex flex-col gap-1 rounded-2xl border p-4 hover:border-la-nube-primary/60"
                  >
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ArrowLeft className="size-3" aria-hidden /> Anterior
                    </span>
                    <span className="font-medium">
                      v{older.version} · {older.title}
                    </span>
                  </Link>
                ) : (
                  <span />
                )}
                {newer && (
                  <Link
                    href={`/changelog/${newer.version}`}
                    className="flex flex-col items-end gap-1 rounded-2xl border p-4 text-right hover:border-la-nube-primary/60"
                  >
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      Siguiente <ArrowRight className="size-3" aria-hidden />
                    </span>
                    <span className="font-medium">
                      v{newer.version} · {newer.title}
                    </span>
                  </Link>
                )}
              </nav>
            )}
          </div>
        </div>
      </div>
      {minutes !== null && (
        <ReadingProgress targetId={BODY_ID} minutes={minutes} />
      )}
    </Container>
  );
}
