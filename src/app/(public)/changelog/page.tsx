import { pageMetadata } from "@/lib/seo/metadata";
import Container from "@/components/atoms/container";
import { SectionHeading } from "@/components/templates/landing/shared/section-heading";
import { APP_VERSION, releasesNewestFirst } from "@/lib/changelog/registry";
import { formatPolicyDate } from "@/lib/policies/format";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

/**
 * Sin `revalidate` a propósito (milestone 28): a diferencia de las políticas, nada acá depende
 * del reloj ni de la base — el registro vive en el código — así que la página es estática pura
 * y solo cambia con un deploy.
 */
export const metadata: Metadata = pageMetadata({
  title: "Novedades",
  description: "Qué cambió en cada versión de La Nube.",
  path: "/changelog",
});

/**
 * Qué significa cada número de la versión, dicho para quien usa el sitio (la regla técnica
 * está en `src/lib/changelog/registry.ts`). El orden es el de la versión: `1.2.3`.
 */
const VERSION_PARTS = [
  {
    part: "1",
    name: "Cambio grande",
    text: "Algo deja de funcionar como antes y quizás tengas que hacer algo distinto.",
  },
  {
    part: "2",
    name: "Algo nuevo",
    text: "Una función o una sección nueva para usar.",
  },
  {
    part: "3",
    name: "Arreglos",
    text: "Correcciones y mejoras que no cambian cómo se usa el sitio.",
  },
] as const;

/**
 * Índice de novedades (milestone 28): una línea de tiempo con una tarjeta por versión, la más
 * nueva primero (número y fecha a la izquierda en `sm+`, título y resumen en la tarjeta); cada
 * una lleva a su página con el detalle. En escritorio, a la derecha, un recuadro fijo explica
 * cómo leer los números de versión. Se llega desde el pie del sitio (la insignia de versión y
 * el enlace «Novedades»), no desde la barra de navegación.
 */
export default function ChangelogPage() {
  const releases = releasesNewestFirst();
  return (
    <Container className="h-fit">
      <div className="mx-4 my-12 flex flex-col gap-12 sm:mx-8">
        <SectionHeading
          as="h1"
          eyebrow="novedades"
          title="Qué hay de"
          accent="nuevo"
          lead="Cada cambio que llega al sitio tiene su número de versión. Acá está lo que trajo cada una."
        />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
          <ol className="flex flex-col">
            {releases.map((r, i) => {
              const current = r.version === APP_VERSION;
              const last = i === releases.length - 1;
              return (
                <li
                  key={r.version}
                  className="relative grid gap-3 pb-10 pl-8 last:pb-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-8"
                >
                  {/* Riel de la línea de tiempo: un punto por versión, unido al siguiente. */}
                  {!last && (
                    <span
                      aria-hidden
                      className="absolute top-3 bottom-0 left-[7px] w-px bg-border"
                    />
                  )}
                  <span
                    aria-hidden
                    className={
                      current
                        ? "absolute top-1.5 left-0 size-[15px] rounded-full border-4 border-la-nube-primary/30 bg-la-nube-primary"
                        : "absolute top-1.5 left-[3px] size-[9px] rounded-full bg-muted-foreground"
                    }
                  />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:flex-col sm:gap-1">
                    <span className="font-mono text-xl font-semibold text-la-nube-selected sm:text-2xl dark:text-la-nube-secondary">
                      v{r.version}
                    </span>
                    <time
                      dateTime={r.date}
                      className="text-sm whitespace-nowrap text-muted-foreground"
                    >
                      {formatPolicyDate(r.date)}
                    </time>
                  </div>
                  <Link
                    href={`/changelog/${r.version}`}
                    className="group flex flex-col gap-3 rounded-2xl border bg-card/70 p-6 backdrop-blur-sm transition-colors hover:border-la-nube-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-8"
                  >
                    {current && (
                      <span className="w-fit rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                        Versión actual
                      </span>
                    )}
                    <h2 className="text-2xl font-bold tracking-tight text-balance text-la-nube-ink dark:text-white">
                      {r.title}
                    </h2>
                    <p className="text-base leading-relaxed text-pretty text-foreground">
                      {r.summary}
                    </p>
                    <span className="mt-1 flex items-center gap-1 text-sm font-medium text-la-nube-selected group-hover:underline dark:text-la-nube-secondary">
                      Ver los cambios
                      <ArrowRight
                        className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="flex flex-col gap-5 rounded-2xl border bg-card/70 p-6 backdrop-blur-sm">
              <div className="flex flex-col gap-1">
                <h2 className="font-semibold text-la-nube-ink dark:text-white">
                  Cómo leer los números
                </h2>
                <p className="text-sm text-muted-foreground">
                  Cada versión tiene tres números, como{" "}
                  <span className="font-mono">1.2.3</span>. El que cambia dice
                  qué tipo de cambio es.
                </p>
              </div>
              <dl className="flex flex-col gap-4">
                {VERSION_PARTS.map((p, i) => (
                  <div key={p.part} className="flex gap-3">
                    <dt className="flex shrink-0 font-mono text-lg leading-6">
                      {["1", "2", "3"].map((n, j) => (
                        <span
                          key={n}
                          className={
                            j === i
                              ? "font-bold text-la-nube-selected dark:text-la-nube-secondary"
                              : "text-muted-foreground/60"
                          }
                        >
                          {j > 0 && "."}
                          {n}
                        </span>
                      ))}
                    </dt>
                    <dd className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {p.text}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </Container>
  );
}
