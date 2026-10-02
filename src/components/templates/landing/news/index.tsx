import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { LANDING_SECTION_BG } from "@/components/templates/landing/shared/section-bg";
import { SectionHeading } from "@/components/templates/landing/shared/section-heading";
import { Reveal } from "@/components/molecules/reveal";
import {
  NewsCard,
  toNewsCardData,
} from "@/components/templates/landing/news/news-card";
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
          <SectionHeading
            eyebrow="noticias"
            title="Últimas"
            accent="noticias"
            lead="Novedades y anuncios de la comunidad de La Nube."
            id="noticias"
            action={
              <Link
                href="/news"
                className="flex items-center gap-1.5 text-sm font-medium text-la-nube-selected transition-colors hover:text-la-nube-ink dark:text-la-nube-secondary dark:hover:text-white"
              >
                Ver todas
                <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...featured, ...rest].map((post, i) => (
              <Reveal key={post.id} delay={(i % 3) * 0.08} className="h-full">
                <NewsCard post={toNewsCardData(post)} />
              </Reveal>
            ))}
          </div>
        </Container>
      </section>
    </Breakout>
  );
}
