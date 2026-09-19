import { LocalDate } from "@/components/molecules/local-date";
import { newsDetailPath } from "@/lib/news/url";
import { Newspaper, Star } from "lucide-react";
import Image from "next/image";
import { LandingCard } from "../shared/landing-card";

export interface NewsCardData {
  slug: string;
  title: string;
  summary: string;
  coverImageUrl: string | null;
  isFeatured: boolean;
  publishedAt: number;
}

export function NewsCard({
  post,
  featured = false,
}: {
  post: NewsCardData;
  featured?: boolean;
}) {
  const isFeatured = featured || post.isFeatured;
  return (
    <LandingCard
      data={{
        href: newsDetailPath({
          slug: post.slug,
          publishedAt: post.publishedAt,
          createdAt: post.publishedAt,
        }),
        label: `Leer: ${post.title}`,
      }}
      className={
        isFeatured
          ? "border-la-nube-primary/40 ring-2 ring-la-nube-primary/40 shadow-md"
          : undefined
      }
    >
      <div className="relative aspect-16/10 w-full overflow-hidden bg-muted">
        {post.coverImageUrl ? (
          <Image
            src={post.coverImageUrl}
            alt={post.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Newspaper className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        {isFeatured && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-la-nube-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
            <Star className="h-3 w-3 fill-current" />
            Destacado
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <LocalDate
          ms={post.publishedAt}
          format="dayMonth"
          className="font-mono text-sm font-medium text-la-nube-selected before:content-['▸_'] dark:text-la-nube-secondary"
        />
        <h3 className="line-clamp-2 text-lg font-bold leading-tight text-foreground">
          {post.title}
        </h3>
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {post.summary}
        </p>
      </div>
    </LandingCard>
  );
}
