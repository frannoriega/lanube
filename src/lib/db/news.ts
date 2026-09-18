import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { assertAuthorTransition } from "@/lib/news/transitions";
import { slugify } from "@/lib/utils/string";
import { Prisma, type NewsPost } from "@/generated/prisma/client";
import type { NewsPostAdminInput, NewsPostInput } from "@/lib/schemas/news";

export type { NewsPost };

const MAX_PAGE_SIZE = 50;

export interface NewsAuthor {
  id: string;
  label: string;
}

/** "Título de la nota" -> a slug guaranteed unique among existing posts. */
export async function uniqueSlugFor(
  title: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(title) || "nota";
  let slug = base;
  for (let i = 2; ; i++) {
    const existing = await prisma.newsPost.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
}

export interface ListAdminNewsOptions {
  /** Restricts to one author's posts (Comunicador scoping — enforced by the caller). */
  authorId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface ListNewsResult {
  items: NewsPost[];
  total: number;
}

export async function listAdminNewsPosts(
  options?: ListAdminNewsOptions,
): Promise<ListNewsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, options?.pageSize ?? 20),
  );
  const where: Prisma.NewsPostWhereInput = {};
  if (options?.authorId) where.authorId = options.authorId;
  if (options?.status) where.status = options.status as never;

  const [items, total] = await Promise.all([
    prisma.newsPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.newsPost.count({ where }),
  ]);
  return { items, total };
}

export async function getNewsPostById(id: string): Promise<NewsPost | null> {
  return prisma.newsPost.findUnique({ where: { id } });
}

/** Public: only a PUBLISHED post is reachable by slug. */
export async function getPublishedNewsBySlug(
  slug: string,
): Promise<NewsPost | null> {
  return prisma.newsPost.findFirst({ where: { slug, status: "PUBLISHED" } });
}

export interface ListPublishedNewsOptions {
  page?: number;
  pageSize?: number;
}

/** Public, paginated: newest-published first, featured leading (mirrors Event ordering). */
export async function listPublishedNews(
  options?: ListPublishedNewsOptions,
): Promise<ListNewsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, options?.pageSize ?? 12),
  );
  const where: Prisma.NewsPostWhereInput = { status: "PUBLISHED" };
  const orderBy: Prisma.NewsPostOrderByWithRelationInput[] = [
    { isFeatured: "desc" },
    { featuredOrder: "asc" },
    { publishedAt: "desc" },
  ];
  const [items, total] = await Promise.all([
    prisma.newsPost.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.newsPost.count({ where }),
  ]);
  return { items, total };
}

/** Public, for the landing preview: up to `limit` posts, featured leading. */
export async function getLandingNews(limit = 6): Promise<NewsPost[]> {
  const { items } = await listPublishedNews({ page: 1, pageSize: limit });
  return items;
}

export async function createNewsPost(
  input: NewsPostInput | NewsPostAdminInput,
  author: NewsAuthor,
  canPublishDirectly: boolean,
): Promise<NewsPost> {
  assertAuthorTransition(input.status, canPublishDirectly);
  const slug = await uniqueSlugFor(input.slug || input.title);
  const isPublishing = input.status === "PUBLISHED";
  return prisma.newsPost.create({
    data: {
      title: input.title,
      slug,
      summary: input.summary,
      body: input.body,
      coverImageUrl: input.coverImageUrl ?? null,
      authorId: author.id,
      authorLabel: author.label,
      status: input.status,
      isFeatured: input.isFeatured,
      featuredOrder: input.featuredOrder,
      publishedAt: isPublishing ? BigInt(Date.now()) : null,
    },
  });
}

export async function updateNewsPost(
  id: string,
  input: NewsPostInput | NewsPostAdminInput,
  canPublishDirectly: boolean,
): Promise<NewsPost> {
  const existing = await getNewsPostById(id);
  if (!existing) throw new DomainError("Nota no encontrada", 404);
  assertAuthorTransition(input.status, canPublishDirectly);

  const slug =
    input.slug === existing.slug
      ? existing.slug
      : await uniqueSlugFor(input.slug || input.title, id);
  const becomingPublished =
    input.status === "PUBLISHED" && existing.status !== "PUBLISHED";

  return prisma.newsPost.update({
    where: { id },
    data: {
      title: input.title,
      slug,
      summary: input.summary,
      body: input.body,
      coverImageUrl: input.coverImageUrl ?? null,
      status: input.status,
      isFeatured: input.isFeatured,
      featuredOrder: input.featuredOrder,
      publishedAt: becomingPublished
        ? BigInt(Date.now())
        : existing.publishedAt,
    },
  });
}

export async function deleteNewsPost(id: string): Promise<void> {
  await prisma.newsPost.delete({ where: { id } });
}

/** Approve or reject a PENDING_REVIEW post. Throws if it isn't in that state. */
export async function decideNewsPost(
  id: string,
  decision: "APPROVED" | "REJECTED",
  reason: string | null,
): Promise<NewsPost> {
  const existing = await getNewsPostById(id);
  if (!existing) throw new DomainError("Nota no encontrada", 404);
  if (existing.status !== "PENDING_REVIEW") {
    throw new DomainError(
      "Solo se pueden aprobar o rechazar notas en revisión",
      409,
    );
  }
  const now = BigInt(Date.now());
  return prisma.newsPost.update({
    where: { id },
    data: {
      status: decision === "APPROVED" ? "PUBLISHED" : "REJECTED",
      decisionReason: reason,
      decidedAt: now,
      publishedAt: decision === "APPROVED" ? now : existing.publishedAt,
    },
  });
}
