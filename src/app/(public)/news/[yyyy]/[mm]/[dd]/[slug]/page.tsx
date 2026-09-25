import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { LocalDate } from "@/components/molecules/local-date";
import { Markdown } from "@/components/molecules/markdown";
import { NewsCard } from "@/components/templates/landing/news/news-card";
import {
  getOtherPublishedNews,
  getPublishedNewsByRetiredSlug,
  getPublishedNewsBySlug,
} from "@/lib/db/news";
import { authorDisplayName, newsDetailPath } from "@/lib/news/url";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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

  const others = await getOtherPublishedNews(post.slug, 4);
  const author = authorDisplayName(post.authorLabel);
  const publishedMs = Number(post.publishedAt ?? post.createdAt);

  return (
    <Breakout>
      <Container className="flex flex-col gap-6 px-8 py-16">
        <Link
          href="/news"
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-foreground transition-colors hover:text-la-nube-selected dark:hover:text-la-nube-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
          Todas las noticias
        </Link>

        {/* Article column + "otras noticias" rail. The sidebar column disappears
            entirely (and the article goes full width) when there's nothing else
            published yet. */}
        <div
          className={
            others.length > 0
              ? "grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
              : "grid grid-cols-1 items-start gap-6"
          }
        >
          <div className="flex min-w-0 flex-col gap-4">
            {/* Author info */}
            <div className="flex items-center gap-3 rounded-2xl border bg-card p-5 shadow-sm">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-la-nube-primary to-la-nube-secondary font-mono text-sm font-bold text-white"
              >
                {authorInitials(author)}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">
                  {author}
                </span>
                <LocalDate
                  ms={publishedMs}
                  className="font-mono text-xs font-medium text-la-nube-selected dark:text-la-nube-secondary"
                />
              </div>
            </div>

            {/* Article */}
            <article className="w-full overflow-hidden rounded-2xl border bg-card shadow-sm">
              {post.coverImageUrl ? (
                <div className="relative aspect-16/9 w-full bg-muted">
                  <Image
                    src={post.coverImageUrl}
                    alt={post.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 760px"
                    className="object-cover"
                    priority
                  />
                </div>
              ) : null}

              <div className="flex w-full flex-col gap-6 p-6 sm:p-10">
                <h1 className="text-4xl font-bold leading-tight text-balance">
                  {post.title}
                </h1>
                <Markdown>{post.body}</Markdown>
              </div>
            </article>
          </div>

          {others.length > 0 && (
            <aside
              aria-labelledby="otras-noticias"
              className="flex flex-col gap-4 lg:sticky lg:top-24"
            >
              <h2
                id="otras-noticias"
                className="rounded-2xl border bg-card px-5 py-4 text-lg font-bold shadow-sm"
              >
                Otras noticias
              </h2>
              {others.map((other) => (
                <NewsCard
                  key={other.id}
                  post={{
                    slug: other.slug,
                    title: other.title,
                    summary: other.summary,
                    coverImageUrl: other.coverImageUrl,
                    isFeatured: false,
                    publishedAt: Number(other.publishedAt ?? other.createdAt),
                  }}
                />
              ))}
            </aside>
          )}
        </div>
      </Container>
    </Breakout>
  );
}
