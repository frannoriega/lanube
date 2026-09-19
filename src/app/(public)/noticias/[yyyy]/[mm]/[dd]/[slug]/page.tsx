import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { LocalDate } from "@/components/molecules/local-date";
import { Markdown } from "@/components/molecules/markdown";
import { getPublishedNewsBySlug } from "@/lib/db/news";
import { newsDetailPath } from "@/lib/news/url";
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
  const post = await getPublishedNewsBySlug(slug);
  if (!post) return { title: "Noticia no encontrada — La Nube" };
  return {
    title: `${post.title} — La Nube`,
    description: post.summary,
  };
}

export default async function NoticiaDetailPage({
  params,
}: {
  params: Promise<NoticiaParams>;
}) {
  const { yyyy, mm, dd, slug } = await params;
  const post = await getPublishedNewsBySlug(slug);
  if (!post) notFound();

  // The slug alone is the lookup key; the date segments are cosmetic. Redirect
  // to the canonical path if they don't match the post's actual publish date,
  // so there's only ever one reachable URL per post.
  const canonical = newsDetailPath(post);
  if (canonical !== `/noticias/${yyyy}/${mm}/${dd}/${slug}`) {
    redirect(canonical);
  }

  return (
    <Breakout>
      <Container className="flex flex-col gap-6 px-8 py-16">
        <Link
          href="/noticias"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Todas las noticias
        </Link>

        <article className="mx-auto flex w-full max-w-prose flex-col gap-6">
          {post.coverImageUrl ? (
            <div className="relative aspect-16/9 w-full overflow-hidden rounded-2xl bg-muted">
              <Image
                src={post.coverImageUrl}
                alt={post.title}
                fill
                sizes="(max-width: 768px) 100vw, 700px"
                className="object-cover"
                priority
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <LocalDate
              ms={Number(post.publishedAt ?? post.createdAt)}
              className="font-mono text-sm font-medium text-la-nube-selected dark:text-la-nube-secondary"
            />
            <h1 className="text-4xl font-bold leading-tight text-balance">
              {post.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              Por {post.authorLabel}
            </p>
          </div>

          <Markdown>{post.body}</Markdown>
        </article>
      </Container>
    </Breakout>
  );
}
