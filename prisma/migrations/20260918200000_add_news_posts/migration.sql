-- CreateEnum
CREATE TYPE "news_post_statuses" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'PAUSED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'COMUNICADOR';

-- CreateTable
CREATE TABLE "news_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cover_image_url" TEXT,
    "author_id" TEXT,
    "author_label" TEXT NOT NULL,
    "status" "news_post_statuses" NOT NULL DEFAULT 'DRAFT',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "featured_order" INTEGER NOT NULL DEFAULT 0,
    "published_at" BIGINT,
    "decision_reason" TEXT,
    "decided_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
    "updated_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),

    CONSTRAINT "news_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_posts_slug_key" ON "news_posts"("slug");

-- CreateIndex
CREATE INDEX "news_posts_status_idx" ON "news_posts"("status");

-- CreateIndex
CREATE INDEX "news_posts_author_id_idx" ON "news_posts"("author_id");

-- AddForeignKey
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "registered_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
