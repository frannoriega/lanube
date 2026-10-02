import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { LocalDate } from "@/components/molecules/local-date";
import { Markdown } from "@/components/molecules/markdown";
import {
  NewsRailItem,
  toNewsCardData,
} from "@/components/templates/landing/news/news-card";
import { ReadingProgress } from "@/components/templates/landing/news/reading-progress";
import {
  getOtherPublishedNews,
  getPublishedNewsByRetiredSlug,
  getPublishedNewsBySlug,
} from "@/lib/db/news";
import { readingMinutes } from "@/lib/news/reading-time";
import { authorDisplayName, newsDetailPath } from "@/lib/news/url";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound, redirect } from "next/navigation";

interface NoticiaParams {
  yyyy: string;
  mm: string;
  dd: string;
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<NoticiaParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  // El mismo fallback de slug retirado que la página, así un link de antes del renombre
  // previsualizado en un chat o por un crawler igual muestra el título del artículo en lugar
  // de "no encontrada".
  const post =
    (await getPublishedNewsBySlug(slug)) ??
    (await getPublishedNewsByRetiredSlug(slug));
  if (!post) return { title: "Noticia no encontrada — La Nube" };
  return {
    title: `${post.title} — La Nube`,
    description: post.summary,
  };
}

/** Id del contenedor del cuerpo: `ReadingProgress` mide el avance sobre este elemento. */
const BODY_ID = "news-body";

/** Initials for the author chip, e.g. "Ana Pérez" → "AP". */
function authorInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export default async function NoticiaDetailPage({
  params,
}: {
  params: Promise<NoticiaParams>;
}) {
  const { yyyy, mm, dd, slug } = await params;
  let post = await getPublishedNewsBySlug(slug);

  // ¿No es el slug actual? Puede ser uno con el que esta nota estuvo publicada antes — un
  // link compartido de antes de un renombre. Redirigir es mejor que dar 404 (milestone-12 D8);
  // los slugs retirados quedan reservados en `news_post_slugs`, así que esto nunca puede
  // resolver al artículo equivocado.
  if (!post) {
    post = await getPublishedNewsByRetiredSlug(slug);
  }
  if (!post) notFound();

  // The slug alone is the lookup key; the date segments are cosmetic. Redirect
  // to the canonical path if they don't match the post's actual publish date,
  // so there's only ever one reachable URL per post.
  const canonical = newsDetailPath(post);
  if (canonical !== `/news/${yyyy}/${mm}/${dd}/${slug}`) {
    redirect(canonical);
  }

  const others = (await getOtherPublishedNews(post.slug, 4)).map(
    toNewsCardData,
  );
  const author = authorDisplayName(post.authorLabel);
  const publishedMs = Number(post.publishedAt ?? post.createdAt);
  const minutes = readingMinutes(post.body);
  const next = others[0];

  return (
    <Breakout>
      <Container className="px-4 py-12 sm:px-8 sm:py-16">
        {/* Artículo + riel "Otras noticias". El riel desaparece del todo (y el artículo
            ocupa el ancho completo) cuando todavía no hay otras notas publicadas. */}
        <div
          className={
            others.length > 0
              ? "grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_300px]"
              : "grid grid-cols-1 items-start gap-10"
          }
        >
          {/* El artículo es la única tarjeta de la página: encabezado, portada, cuerpo y
              cierre viven adentro, sobre una sola columna de lectura (~65ch) centrada. */}
          <article className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm">
            <header className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-6 pt-8 pb-8 sm:px-10 sm:pt-12">
              {/* El kicker de la pantalla, como ruta: "noticias" vuelve al listado. */}
              <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-la-nube-selected dark:text-la-nube-secondary">
                ~/{" "}
                <Link
                  href="/news"
                  className="underline-offset-4 hover:underline focus-visible:underline"
                >
                  noticias
                </Link>{" "}
                / {yyyy} / {mm}
                <span className="animate-blink">▌</span>
              </p>

              <h1 className="text-3xl font-bold leading-[1.1] tracking-tight text-balance sm:text-5xl">
                {post.title}
              </h1>

              {/* El resumen hace de copete: ya existía y nunca se mostraba en el detalle. */}
              <p className="text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
                {post.summary}
              </p>

              <div className="flex items-center gap-3 border-t pt-5">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-la-nube-selected to-la-nube-primary font-mono text-sm font-bold text-white"
                >
                  {authorInitials(author)}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {author}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    <LocalDate ms={publishedMs} format="long" /> · {minutes} min
                    de lectura
                  </span>
                </div>
              </div>
            </header>

            {/* Sin portada, el encabezado y el cuerpo los separa un hairline común. (Antes era
                una línea con el degradé de marca: se leía como una barra de progreso que no
                avanzaba — el progreso real ahora es `ReadingProgress`.) */}
            {post.coverImageUrl ? (
              <div className="relative aspect-16/9 w-full bg-muted">
                <Image
                  src={post.coverImageUrl}
                  alt={post.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 900px"
                  className="object-cover"
                  priority
                />
              </div>
            ) : (
              <hr className="border-border" />
            )}

            <div
              id={BODY_ID}
              className="mx-auto w-full max-w-2xl px-6 py-10 sm:px-10 sm:py-12"
            >
              <Markdown size="reading">{post.body}</Markdown>
            </div>

            {/* Cierre: a dónde ir después de terminar de leer. */}
            <footer className="border-t bg-muted/40">
              <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-10">
                <Link
                  href="/news"
                  className="flex w-fit items-center gap-1.5 text-sm font-semibold text-foreground transition-colors hover:text-la-nube-selected dark:hover:text-la-nube-secondary"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Todas las noticias
                </Link>
                {next && (
                  <Link
                    href={newsDetailPath({
                      slug: next.slug,
                      publishedAt: next.publishedAt,
                      createdAt: next.publishedAt,
                    })}
                    className="group flex min-w-0 flex-col gap-0.5 sm:max-w-[60%] sm:items-end sm:text-right"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      Seguí leyendo
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors group-hover:text-la-nube-selected dark:group-hover:text-la-nube-secondary">
                      <span className="line-clamp-1">{next.title}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
                    </span>
                  </Link>
                )}
              </div>
            </footer>
          </article>

          {others.length > 0 && (
            <aside
              aria-labelledby="otras-noticias"
              className="flex flex-col gap-2 lg:sticky lg:top-24"
            >
              <h2
                id="otras-noticias"
                className="px-2 text-base font-semibold text-foreground"
              >
                Otras noticias
              </h2>
              <ol className="flex flex-col gap-1">
                {others.map((other, i) => (
                  <li key={other.slug}>
                    <NewsRailItem post={other} index={i + 1} />
                  </li>
                ))}
              </ol>
            </aside>
          )}
        </div>
      </Container>
      <ReadingProgress targetId={BODY_ID} minutes={minutes} />
    </Breakout>
  );
}
