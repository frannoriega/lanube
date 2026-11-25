import { getPublicSitemapEntries } from "@/lib/cache/public-reads";
import { newsDetailPath } from "@/lib/news/url";
import { absoluteUrl } from "@/lib/seo/metadata";
import type { MetadataRoute } from "next";

/**
 * `sitemap.xml` (milestone 41): las páginas fijas del sitio público, las noticias publicadas y
 * los eventos públicos. Sale de una lectura cacheada con los tags de noticias y eventos, así una
 * publicación nueva aparece cuando el panel invalida el tag; lo demás, a lo sumo en
 * `revalidate` segundos. Nunca lista el panel, `/forms/response` ni nada que pida sesión.
 */
export const revalidate = 300;

const STATIC_PATHS = [
  "/",
  "/about",
  "/spaces",
  "/news",
  "/policies",
  "/changelog",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { news, events } = await getPublicSitemapEntries();
  return [
    ...STATIC_PATHS.map((path) => ({ url: absoluteUrl(path) })),
    ...news.map((post) => ({
      url: absoluteUrl(newsDetailPath(post)),
      lastModified: new Date(Number(post.updatedAt)),
    })),
    ...events.map((event) => ({
      url: absoluteUrl(`/events/${event.id}`),
      lastModified: new Date(Number(event.updatedAt)),
    })),
  ];
}
