import { nowMs } from "@/lib/clock";
import { siteUrl as BASE_URL } from "@/lib/constants/site";
import { prisma } from "@/lib/prisma";
import type { MetadataRoute } from "next";

/**
 * Static pages: lastModified reflects the date of the last meaningful content
 * update to the landing/about/services/policies pages.
 * Update this list whenever a new static public route is added.
 */
const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: `${BASE_URL}/`, lastModified: "2026-07-07" },
  { url: `${BASE_URL}/about`, lastModified: "2026-07-07" },
  { url: `${BASE_URL}/services`, lastModified: "2026-07-07" },
  { url: `${BASE_URL}/events`, lastModified: "2026-07-07" },
  { url: `${BASE_URL}/contact`, lastModified: "2026-07-07" },
  { url: `${BASE_URL}/policies/privacy`, lastModified: "2026-07-07" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const nowNum = nowMs();
  const now = BigInt(nowNum);

  /**
   * All PUBLISHED, non-deleted events are included — even past ones — because
   * /events/[id] pages remain accessible (200) and carry indexable content
   * (name, description, type, schedule).
   *
   * We select only the fields needed by the sitemap to keep the query light.
   */
  const events = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
    },
    select: {
      id: true,
      updatedAt: true,
      form: {
        select: {
          slug: true,
          isPublished: true,
          closesAt: true,
        },
      },
    },
    orderBy: { startTime: "desc" },
  });

  const eventEntries: MetadataRoute.Sitemap = events.map((e) => ({
    url: `${BASE_URL}/events/${e.id}`,
    lastModified: new Date(Number(e.updatedAt)).toISOString().split("T")[0],
  }));

  /**
   * Registration form pages are included only while the registration window
   * is still open or upcoming (closesAt >= now). Once registration closes the
   * page degrades to a "closed" notice — still accessible but low-value for
   * crawlers, so we drop it from the sitemap rather than keeping stale entries.
   */
  const formEntries: MetadataRoute.Sitemap = events
    .filter(
      (e) =>
        e.form?.slug &&
        e.form.isPublished &&
        e.form.closesAt !== null &&
        e.form.closesAt >= now,
    )
    .map((e) => ({
      url: `${BASE_URL}/forms/${e.form!.slug}`,
      lastModified: new Date(Number(e.updatedAt)).toISOString().split("T")[0],
    }));

  return [...STATIC_PAGES, ...eventEntries, ...formEntries];
}
