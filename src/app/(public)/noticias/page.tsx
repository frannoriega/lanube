import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { Pagination } from "@/components/molecules/pagination";
import { NewsCard } from "@/components/templates/landing/news/news-card";
import { NewsFilters } from "@/components/templates/landing/news/news-filters";
import { startOfDateKeyMs, endOfDateKeyMs } from "@/lib/admin/admin-timezone";
import { searchPublishedNews } from "@/lib/db/news";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Noticias — La Nube",
  description: "Novedades y anuncios de la comunidad de La Nube.",
};

interface NoticiasSearchParams {
  page?: string;
  q?: string;
  from?: string;
  to?: string;
}

const PAGE_SIZE = 12;

export default async function NoticiasIndexPage({
  searchParams,
}: {
  searchParams: Promise<NoticiasSearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = await searchPublishedNews({
    query: sp.q,
    fromMs: sp.from ? startOfDateKeyMs(sp.from) : undefined,
    toMs: sp.to ? endOfDateKeyMs(sp.to) : undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(sp.q || sp.from || sp.to);

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

        <Suspense>
          <NewsFilters q={sp.q} from={sp.from} to={sp.to} />
        </Suspense>

        {items.length === 0 ? (
          <p className="text-muted-foreground">
            {hasFilters
              ? "No encontramos noticias con esos filtros."
              : "Todavía no publicamos ninguna noticia."}
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

        <Pagination
          page={page}
          totalPages={totalPages}
          basePath="/noticias"
          query={{ q: sp.q, from: sp.from, to: sp.to }}
        />
      </Container>
    </Breakout>
  );
}
