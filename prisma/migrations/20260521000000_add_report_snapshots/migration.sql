-- CreateTable
CREATE TABLE "report_snapshots" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "from_date" TEXT NOT NULL,
    "to_date" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),

    CONSTRAINT "report_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "report_snapshots_key_key" ON "report_snapshots"("key");
