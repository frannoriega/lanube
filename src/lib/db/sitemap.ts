import "server-only";
import { PUBLIC_EVENT_WHERE } from "@/lib/events/visibility";
import { prisma } from "@/lib/prisma";

/**
 * Lo que va al `sitemap.xml` (milestone 41): noticias publicadas y eventos públicos. Mismos
 * filtros que las páginas de detalle (`getPublicNewsBySlug`, `getPublicEventDetail`): lo que no
 * se puede abrir no se anuncia. Solo columnas livianas; la ruta de cada noticia la arma
 * `newsDetailPath()`.
 */
export async function listSitemapEntries() {
  const [news, events] = await Promise.all([
    prisma.newsPost.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      select: {
        slug: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.event.findMany({
      // Los privados no se anuncian (milestone 43).
      where: PUBLIC_EVENT_WHERE,
      select: { id: true, updatedAt: true },
      orderBy: { startTime: "desc" },
    }),
  ]);
  return { news, events };
}
