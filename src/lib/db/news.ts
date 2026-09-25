import { nowMs } from "@/lib/clock";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { assertAuthorTransition } from "@/lib/news/transitions";
import {
  shouldFlagForReview,
  shouldRetireSlug,
  shouldStampPublishedAt,
} from "@/lib/news/publishing";
import { slugify } from "@/lib/utils/string";
import { Prisma, type NewsPost } from "@/generated/prisma/client";
import type {
  NewsPostAdminInput,
  NewsPostAmendInput,
  NewsPostInput,
} from "@/lib/schemas/news";

export type { NewsPost };

const MAX_PAGE_SIZE = 50;

export interface NewsAuthor {
  id: string;
  label: string;
}

/**
 * "Título de la nota" -> un slug garantizado único entre las notas existentes **y entre los
 * slugs retirados** (`news_post_slugs`).
 *
 * Los slugs retirados quedan reservados: si una nota nueva pudiera tomar uno, su redirect
 * empezaría a apuntar al artículo equivocado (milestone-12 D8). Un slug retirado por *esta*
 * misma nota sí se puede reclamar, que es lo que habilita `excludeId` — volver a un título
 * anterior es algo normal.
 *
 * El loop está acotado para que un título patológico no gire para siempre; pasados
 * `MAX_SLUG_ATTEMPTS` cae a un sufijo que no puede colisionar.
 */
const MAX_SLUG_ATTEMPTS = 50;

export async function uniqueSlugFor(
  title: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(title) || "nota";
  let slug = base;
  for (let i = 2; i <= MAX_SLUG_ATTEMPTS; i++) {
    const [existing, retired] = await Promise.all([
      prisma.newsPost.findUnique({ where: { slug }, select: { id: true } }),
      prisma.newsPostSlug.findUnique({
        where: { slug },
        select: { newsPostId: true },
      }),
    ]);
    const takenBy = existing?.id ?? retired?.newsPostId;
    if (!takenBy || takenBy === excludeId) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export interface ListAdminNewsOptions {
  /** Restricts to one author's posts (Comunicador scoping — enforced by the caller). */
  authorId?: string;
  status?: string;
  /** Solo las notas marcadas por la corrección en el lugar de un autor (milestone-12 D20). */
  needsReview?: boolean;
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
  if (options?.needsReview) where.needsReview = true;

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

export interface SearchPublishedNewsOptions {
  /** Free-text query over title/summary/body, via Postgres full-text search (Spanish). */
  query?: string;
  /** Inclusive publish-date range, ms. */
  fromMs?: number;
  toMs?: number;
  page?: number;
  pageSize?: number;
}

/**
 * Búsqueda/filtro público sobre las notas publicadas, para el índice completo `/news` —
 * unlike `listPublishedNews` (unfiltered landing preview), this always runs as
 * raw SQL so the query (Postgres `to_tsvector`/`plainto_tsquery`, ranked by
 * `ts_rank` when a query is given) and the date range apply together. Column
 * names are aliased to the model's camelCase field names — `$queryRaw` returns
 * raw driver rows, not Prisma's usual field mapping.
 *
 * El texto buscable pasa por `news_search_text()` en lugar de `title || ' ' || …`: concatenar
 * con `||` devuelve NULL si algún operando es NULL, lo que habría sacado la nota de todos los
 * resultados en silencio en lugar de dar error. Hoy `summary`/`body` son no nulos, así que
 * estaba latente — pero es de las latencias que nunca se anuncian. La función además es
 * IMMUTABLE para que el índice GIN de `20260924160000_news_search_index` pueda construirse
 * sobre ella (milestone-12, Parte 4).
 */
export async function searchPublishedNews(
  options?: SearchPublishedNewsOptions,
): Promise<ListNewsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, options?.pageSize ?? 12),
  );
  const query = options?.query?.trim() || null;
  const fromMs = options?.fromMs ?? null;
  const toMs = options?.toMs ?? null;

  const whereClause = Prisma.sql`
    status = 'PUBLISHED'
    AND (
      ${query}::text IS NULL
      OR to_tsvector('spanish', news_search_text(title, summary, body))
         @@ plainto_tsquery('spanish', ${query})
    )
    AND (${fromMs}::bigint IS NULL OR published_at >= ${fromMs}::bigint)
    AND (${toMs}::bigint IS NULL OR published_at <= ${toMs}::bigint)
  `;

  const selectColumns = Prisma.sql`
    id, title, slug, summary, body,
    cover_image_url AS "coverImageUrl",
    author_id AS "authorId",
    author_label AS "authorLabel",
    status, is_featured AS "isFeatured", featured_order AS "featuredOrder",
    published_at AS "publishedAt",
    decision_reason AS "decisionReason", decided_at AS "decidedAt",
    created_at AS "createdAt", updated_at AS "updatedAt"
  `;

  const [items, totalRows] = await Promise.all([
    prisma.$queryRaw<NewsPost[]>`
      SELECT ${selectColumns}
      FROM news_posts
      WHERE ${whereClause}
      ORDER BY
        (CASE WHEN ${query}::text IS NULL THEN 0
          ELSE ts_rank(
            to_tsvector('spanish', news_search_text(title, summary, body)),
            plainto_tsquery('spanish', ${query})
          )
        END) DESC,
        is_featured DESC,
        featured_order ASC,
        published_at DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM news_posts WHERE ${whereClause}
    `,
  ]);

  return { items, total: Number(totalRows[0]?.count ?? 0) };
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
      publishedAt: isPublishing ? BigInt(nowMs()) : null,
    },
  });
}

export async function updateNewsPost(
  id: string,
  input: NewsPostInput | NewsPostAmendInput | NewsPostAdminInput,
  canPublishDirectly: boolean,
): Promise<NewsPost> {
  const existing = await getNewsPostById(id);
  if (!existing) throw new DomainError("Nota no encontrada", 404);
  // The stored status is passed so an author may amend their own already-published post
  // without unpublishing it (milestone-12 D20).
  assertAuthorTransition(input.status, canPublishDirectly, existing.status);

  const slug =
    input.slug === existing.slug
      ? existing.slug
      : await uniqueSlugFor(input.slug || input.title, id);

  const firstPublish = shouldStampPublishedAt(
    input.status,
    existing.publishedAt,
  );
  const flagForReview = shouldFlagForReview(
    input.status,
    existing.status,
    canPublishDirectly,
  );
  const retireOldSlug = shouldRetireSlug(
    slug,
    existing.slug,
    existing.publishedAt,
  );

  return prisma.$transaction(async (tx) => {
    if (retireOldSlug) {
      // upsert y no create: la nota pudo haberse renombrado a X, a otra cosa, y de vuelta a X.
      await tx.newsPostSlug.upsert({
        where: { slug: existing.slug },
        create: { slug: existing.slug, newsPostId: id },
        update: { newsPostId: id },
      });
    }
    // Si la nota está (re)tomando un slug que había retirado antes, esa reserva ya es
    // redundante — y dejarla haría que el slug canónico redirija a sí mismo.
    await tx.newsPostSlug.deleteMany({ where: { slug } });

    return tx.newsPost.update({
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
        publishedAt: firstPublish ? BigInt(nowMs()) : existing.publishedAt,
        // La corrección en el lugar de un autor levanta la marca; la edición de un admin (o
        // una decisión, más abajo) la baja. Cualquier otra cosa la deja como estaba.
        ...(flagForReview
          ? { needsReview: true }
          : canPublishDirectly
            ? { needsReview: false }
            : {}),
      },
    });
  });
}

/**
 * Resuelve un slug que ya no es el vigente hacia la nota que lo tenía, para que la página de
 * detalle pueda redirigir en lugar de dar 404 (milestone-12 D8). Devuelve null si el slug nunca
 * se usó, o si su nota ya no está publicada.
 */
export async function getPublishedNewsByRetiredSlug(
  slug: string,
): Promise<NewsPost | null> {
  const retired = await prisma.newsPostSlug.findUnique({
    where: { slug },
    select: { post: true },
  });
  if (!retired?.post || retired.post.status !== "PUBLISHED") return null;
  return retired.post;
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
  const now = BigInt(nowMs());
  return prisma.newsPost.update({
    where: { id },
    data: {
      status: decision === "APPROVED" ? "PUBLISHED" : "REJECTED",
      decisionReason: reason,
      decidedAt: now,
      // Decidir sobre una nota es una revisión, así que baja la marca de corrección.
      needsReview: false,
      publishedAt: decision === "APPROVED" ? now : existing.publishedAt,
    },
  });
}

/**
 * Sidebar fodder for the article detail page: other published posts, excluding the
 * one being read. Featured lead, then newest-published — same ordering as the list.
 */
export async function getOtherPublishedNews(
  excludeSlug: string,
  limit = 4,
): Promise<NewsPost[]> {
  return prisma.newsPost.findMany({
    where: { status: "PUBLISHED", slug: { not: excludeSlug } },
    orderBy: [
      { isFeatured: "desc" },
      { featuredOrder: "asc" },
      { publishedAt: "desc" },
    ],
    take: limit,
  });
}
