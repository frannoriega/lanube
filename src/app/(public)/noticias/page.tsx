import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { Pagination } from "@/components/molecules/pagination";
import { NewsCard } from "@/components/templates/landing/news/news-card";
import { listPublishedNews } from "@/lib/db/news";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Noticias — La Nube",
  description: "Novedades y anuncios de la comunidad de La Nube.",
};

interface NoticiasSearchParams {
  page?: string;
}

export default async function NoticiasIndexPage({
  searchParams,
}: {
  searchParams: Promise<NoticiasSearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = await listPublishedNews({ page, pageSize: 12 });
  const totalPages = Math.max(1, Math.ceil(total / 12));

  return (
    <Breakout>
      <Container className="flex flex-col gap-8 px-8 py-16">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-la-nube-selected dark:text-la-nube-secondary">
            ~/ noticias
            <span className="animate-blink">▌</span>
          </span>
          <h1 className="text-5xl font-bold">
            Todas las{" "}
            <span className="bg-linear-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-transparent">
              noticias
            </span>
          </h1>
        </div>

        {items.length === 0 ? (
          <p className="text-muted-foreground">
            Todavía no publicamos ninguna noticia.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((post) => (
              <NewsCard
                key={post.id}
                post={{
                  slug: post.slug,
                  title: post.title,
                  summary: post.summary,
                  coverImageUrl: post.coverImageUrl,
                  isFeatured: post.isFeatured,
                  publishedAt: Number(post.publishedAt ?? post.createdAt),
                }}
              />
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} basePath="/noticias" />
      </Container>
    </Breakout>
  );
}
