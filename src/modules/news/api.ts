/**
 * Public data API for the news (newsletter) module.
 *
 * This is a scaffold: it demonstrates how a second module plugs in and exposes a
 * standardized, frontend-facing data API alongside events. The real data layer
 * (Prisma models, queries) will be added when the newsletter feature is built.
 */

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  /** Unix epoch milliseconds. */
  publishedAt: number;
  slug: string;
}

export const newsApi = {
  /** Latest published news items, newest first. Returns [] until implemented. */
  listLatest: async (_limit?: number): Promise<NewsItem[]> => {
    return [];
  },
};

export type NewsApi = typeof newsApi;
