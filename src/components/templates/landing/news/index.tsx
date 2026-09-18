import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { LANDING_SECTION_BG } from "@/components/templates/landing/shared/section-bg";
import { NewsCard } from "@/components/templates/landing/news/news-card";
import { getLandingNews } from "@/lib/db/news";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default async function NewsSection() {
  const posts = await getLandingNews(6);
  if (posts.length === 0) return null;

  const featured = posts.filter((p) => p.isFeatured);
  const rest = posts.filter((p) => !p.isFeatured);

  return (
    <Breakout className={LANDING_SECTION_BG}>
      <section className="w-full" aria-labelledby="noticias">
        <Container className="flex flex-col gap-8 px-8 py-16">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3">
              <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-la-nube-selected dark:text-la-nube-secondary">
                ~/ noticias
                <span className="animate-blink">▌</span>
              </span>
              <h2 id="noticias" className="text-5xl font-bold">
                Últimas{" "}
                <span className="bg-linear-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-transparent">
                  noticias
                </span>
              </h2>
              <p className="max-w-prose text-lg text-muted-foreground">
                Novedades y anuncios de la comunidad de La Nube.
              </p>
            </div>
            <Link
              href="/noticias"
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Ver todas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...featured, ...rest].map((post) => (
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
        </Container>
      </section>
    </Breakout>
  );
}
