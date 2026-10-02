import { LocalDate } from "@/components/molecules/local-date";
import type { NewsPost } from "@/generated/prisma/client";
import { readingMinutes } from "@/lib/news/reading-time";
import { newsDetailPath } from "@/lib/news/url";
import { cn } from "@/lib/utils";
import { ArrowRight, Star } from "lucide-react";
import Link from "next/link";
import { LandingCard } from "../shared/landing-card";
import { NewsCover } from "./news-cover";

export interface NewsCardData {
  slug: string;
  title: string;
  summary: string;
  coverImageUrl: string | null;
  isFeatured: boolean;
  publishedAt: number;
  /** Minutos estimados de lectura del cuerpo (ver `readingMinutes`). */
  readingMinutes: number;
}

/**
 * Proyección de una `NewsPost` a lo que necesitan las tarjetas. Centraliza el cálculo del
 * tiempo de lectura y el fallback `publishedAt ?? createdAt`, que antes se repetía en cada
 * página que listaba notas.
 */
export function toNewsCardData(post: NewsPost): NewsCardData {
  return {
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    coverImageUrl: post.coverImageUrl,
    isFeatured: post.isFeatured,
    publishedAt: Number(post.publishedAt ?? post.createdAt),
    readingMinutes: readingMinutes(post.body),
  };
}

function hrefFor(post: NewsCardData): string {
  return newsDetailPath({
    slug: post.slug,
    publishedAt: post.publishedAt,
    createdAt: post.publishedAt,
  });
}

/**
 * Sombra de hover teñida de Observatory Blue (la "Blue Shadow Rule" del DESIGN.md), en
 * lugar del `hover:shadow-md` gris que trae `LandingCard`.
 */
const BLUE_LIFT = "hover:shadow-[0_6px_20px_0_rgba(78,135,194,0.3)]";

/** Texto de marca accesible en ambos temas (ver CLAUDE.md, "Styling & accessibility"). */
const BRAND_TEXT = "text-la-nube-selected dark:text-la-nube-secondary";

/** "Destacada" sobre la portada. */
function FeaturedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-la-nube-selected px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm",
        className,
      )}
    >
      <Star className="h-3 w-3 fill-current" />
      Destacada
    </span>
  );
}

/** Fecha como chip mono apoyado sobre la portada — la voz del sistema, no del autor. */
function DateChip({ ms, className }: { ms: number; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full bg-card px-2.5 py-1 font-mono text-xs font-medium shadow-sm",
        BRAND_TEXT,
        className,
      )}
    >
      <LocalDate ms={ms} format="dayMonth" />
    </span>
  );
}

/**
 * Pie de tarjeta: tiempo de lectura a la izquierda y la invitación "Leer" a la derecha,
 * con la flecha que avanza en hover/foco. Siempre visible (en touch no hay hover, así que
 * la invitación no puede depender de él).
 *
 * En la grilla el pie se ancla abajo (`mt-auto`) para que las tarjetas de una fila alineen
 * su pie aunque los resúmenes tengan largos distintos. En la nota principal no: el texto va
 * centrado como un bloque, y un pie anclado dejaba un hueco grande con resúmenes cortos.
 */
function CardFooter({
  minutes,
  cta = "Leer",
  anchored = true,
}: {
  minutes: number;
  cta?: string;
  anchored?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 pt-2 font-mono text-xs",
        anchored && "mt-auto",
      )}
    >
      <span className="text-muted-foreground">{minutes} min de lectura</span>
      <span
        className={cn("flex items-center gap-1 font-medium", BRAND_TEXT)}
        aria-hidden="true"
      >
        {cta}
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1 group-focus-within:translate-x-1 motion-reduce:transition-none" />
      </span>
    </div>
  );
}

/**
 * Tarjeta de grilla: portada con zoom en hover, fecha y "Destacada" sobre la imagen,
 * título, resumen y pie con tiempo de lectura. La usan el listado `/news` y la sección de
 * noticias del landing.
 */
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
      data={{ href: hrefFor(post), label: `Leer: ${post.title}` }}
      className={cn(
        BLUE_LIFT,
        isFeatured &&
          "border-la-nube-primary/60 ring-2 ring-la-nube-primary/30",
      )}
    >
      <div className="relative">
        <NewsCover
          slug={post.slug}
          title={post.title}
          imageUrl={post.coverImageUrl}
          className="aspect-16/10 w-full"
          zoomOnHover
        />
        <DateChip ms={post.publishedAt} className="absolute left-3 top-3" />
        {isFeatured && <FeaturedBadge className="absolute right-3 top-3" />}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <h3
          className={cn(
            "line-clamp-2 text-lg font-bold leading-snug text-balance text-foreground transition-colors",
            "group-hover:text-la-nube-selected dark:group-hover:text-la-nube-secondary",
          )}
        >
          {post.title}
        </h3>
        <p className="line-clamp-3 text-sm text-pretty text-muted-foreground">
          {post.summary}
        </p>
        <CardFooter minutes={post.readingMinutes} />
      </div>
    </LandingCard>
  );
}

/**
 * Nota principal del listado: ocupa dos columnas de la grilla en `lg` (y la fila entera en
 * `sm`), portada a un lado y título grande + resumen al otro — el punto de entrada que la
 * grilla uniforme no tenía. En teléfonos se apila como una tarjeta normal más grande.
 * Mismo lenguaje que `FeaturedEventCard`, en tono más sobrio.
 */
export function NewsLeadCard({
  post,
  className,
}: {
  post: NewsCardData;
  className?: string;
}) {
  return (
    <LandingCard
      data={{ href: hrefFor(post), label: `Leer: ${post.title}` }}
      className={cn(
        "md:flex-row",
        BLUE_LIFT,
        post.isFeatured &&
          "border-la-nube-primary/60 ring-2 ring-la-nube-primary/30",
        className,
      )}
    >
      <div className="relative md:w-[55%] md:shrink-0">
        <NewsCover
          slug={post.slug}
          title={post.title}
          imageUrl={post.coverImageUrl}
          className="aspect-16/10 w-full md:aspect-auto md:h-full md:min-h-72"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 55vw, 40vw"
          priority
          zoomOnHover
        />
        <DateChip ms={post.publishedAt} className="absolute left-4 top-4" />
        {post.isFeatured && (
          <FeaturedBadge className="absolute right-4 top-4" />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6 md:justify-center lg:p-8">
        <h2
          className={cn(
            "text-2xl font-bold leading-tight text-balance text-foreground transition-colors lg:text-3xl",
            "group-hover:text-la-nube-selected dark:group-hover:text-la-nube-secondary",
          )}
        >
          {post.title}
        </h2>
        <p className="line-clamp-4 text-base text-pretty text-muted-foreground">
          {post.summary}
        </p>
        <CardFooter
          minutes={post.readingMinutes}
          cta="Leer nota"
          anchored={false}
        />
      </div>
    </LandingCard>
  );
}

/**
 * Fila compacta para el riel "Otras noticias" del detalle: índice mono, miniatura, título
 * y fecha. Mucho más liviana que una `NewsCard` completa, para que el riel acompañe al
 * artículo en lugar de competir con él.
 */
export function NewsRailItem({
  post,
  index,
}: {
  post: NewsCardData;
  /** Posición en el riel, desde 1; se muestra como `01`, `02`… */
  index: number;
}) {
  return (
    <Link
      href={hrefFor(post)}
      className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-card focus-visible:bg-card"
    >
      <span
        aria-hidden="true"
        className="w-6 shrink-0 font-mono text-xs font-medium text-muted-foreground"
      >
        {String(index).padStart(2, "0")}
      </span>
      <NewsCover
        slug={post.slug}
        title=""
        imageUrl={post.coverImageUrl}
        className="h-16 w-16 shrink-0 rounded-lg"
        sizes="64px"
      />
      <span className="flex min-w-0 flex-col gap-1">
        <span
          className={cn(
            "line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors",
            "group-hover:text-la-nube-selected dark:group-hover:text-la-nube-secondary",
          )}
        >
          {post.title}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          <LocalDate ms={post.publishedAt} format="dayMonth" /> ·{" "}
          {post.readingMinutes} min
        </span>
      </span>
    </Link>
  );
}
