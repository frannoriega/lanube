import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { Pagination } from "@/components/molecules/pagination";
import {
  NewsCard,
  NewsLeadCard,
  toNewsCardData,
} from "@/components/templates/landing/news/news-card";
import { NewsFilters } from "@/components/templates/landing/news/news-filters";
import { startOfDateKeyMs, endOfDateKeyMs } from "@/lib/admin/admin-timezone";
import { getPublicNewsSearch } from "@/lib/cache/public-reads";
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

/** "1 noticia" / "12 noticias" — o "resultado(s)" cuando hay filtros aplicados. */
function resultCountLabel(total: number, hasFilters: boolean): string {
  const noun = hasFilters ? "resultado" : "noticia";
  return `${total} ${noun}${total === 1 ? "" : "s"}`;
}

export default async function NoticiasIndexPage({
  searchParams,
}: {
  searchParams: Promise<NoticiasSearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = await getPublicNewsSearch({
    query: sp.q,
    fromMs: sp.from ? startOfDateKeyMs(sp.from) : undefined,
    toMs: sp.to ? endOfDateKeyMs(sp.to) : undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(sp.q || sp.from || sp.to);
  const posts = items.map(toNewsCardData);

  // La primera nota de la primera página es la principal (destacada, o la más reciente /
  // la mejor coincidencia de la búsqueda — el orden ya lo resuelve la consulta). En las
  // páginas siguientes la grilla es uniforme: una "principal" en la página 3 no significa
  // nada. Con una sola nota no hay grilla que encabezar, así que va como tarjeta normal.
  const lead = page === 1 && posts.length > 1 ? posts[0] : null;
  const grid = lead ? posts.slice(1) : posts;

  return (
    <Breakout>
      <Container className="flex flex-col gap-8 px-4 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-la-nube-selected dark:text-la-nube-secondary">
              ~/ noticias
              <span className="animate-blink">▌</span>
            </span>
            <h1 className="text-4xl font-bold sm:text-5xl">
              Todas las{" "}
              <span className="bg-linear-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-transparent">
                noticias
              </span>
            </h1>
            <p className="max-w-prose text-lg text-pretty text-muted-foreground">
              Novedades y anuncios de la comunidad de La Nube.
            </p>
          </div>

          <Suspense>
            <NewsFilters q={sp.q} from={sp.from} to={sp.to} />
          </Suspense>
        </div>

        {posts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card/60 px-6 py-16 text-center">
            <p className="font-mono text-sm text-muted-foreground">
              {resultCountLabel(0, hasFilters)}
            </p>
            <p className="text-base text-foreground">
              {hasFilters
                ? "No encontramos noticias con esos filtros."
                : "Todavía no publicamos ninguna noticia."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p
              className="font-mono text-xs text-muted-foreground"
              aria-live="polite"
            >
              {resultCountLabel(total, hasFilters)}
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {lead && <NewsLeadCard post={lead} className="sm:col-span-2" />}
              {grid.map((post) => (
                <NewsCard key={post.slug} post={post} />
              ))}
            </div>
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          basePath="/news"
          query={{ q: sp.q, from: sp.from, to: sp.to }}
        />
      </Container>
    </Breakout>
  );
}
