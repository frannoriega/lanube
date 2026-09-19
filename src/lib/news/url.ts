import { dateKeyFromUnixMs } from "@/lib/admin/admin-timezone";

/**
 * `/noticias/YYYY/MM/DD/slug` — the date segments are the post's publish date
 * (admin timezone), not part of the lookup key (the slug alone is globally
 * unique); they exist for a readable, dated URL. See
 * `[yyyy]/[mm]/[dd]/[slug]/page.tsx`, which 308-redirects to this canonical
 * path if a stale/incorrect date segment is requested.
 */
export function newsDetailPath(post: {
  slug: string;
  publishedAt: number | bigint | null;
  createdAt: number | bigint;
}): string {
  const ms = Number(post.publishedAt ?? post.createdAt);
  const [yyyy, mm, dd] = dateKeyFromUnixMs(ms).split("-");
  return `/noticias/${yyyy}/${mm}/${dd}/${post.slug}`;
}
