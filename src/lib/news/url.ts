import { dateKeyFromUnixMs } from "@/lib/admin/admin-timezone";

/**
 * `/news/YYYY/MM/DD/slug` — the date segments are the post's publish date
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
  return `/news/${yyyy}/${mm}/${dd}/${post.slug}`;
}

/**
 * `NewsPost.authorLabel` is stored as `"Name <email>"` (mirrors AuditLog's
 * internal actor label — see `prisma/models/news.prisma`). Public surfaces
 * show the byline but must never leak the author's email, so strip it here.
 */
export function authorDisplayName(authorLabel: string): string {
  return authorLabel.replace(/\s*<[^>]*>\s*$/, "");
}
