-- ============================================================================
-- Milestone 23 — días cerrados (ver prisma/models/closed-days.prisma).
-- ============================================================================
CREATE TYPE "ClosedDaySource" AS ENUM ('NATIONAL_SYNC', 'MANUAL_HOLIDAY', 'MANUAL_OTHER');
CREATE TYPE "ClosedDayStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'DISMISSED');

CREATE TABLE "closed_days" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "start_time" INTEGER,
    "end_time" INTEGER,
    "source" "ClosedDaySource" NOT NULL,
    "status" "ClosedDayStatus" NOT NULL DEFAULT 'ACTIVE',
    "external_key" TEXT,
    "holiday_kind" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
    "updated_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),

    CONSTRAINT "closed_days_pkey" PRIMARY KEY ("id"),

    -- Fechas de calendario locales `YYYY-MM-DD`; el orden lexicográfico es el cronológico, así
    -- que `>=` alcanza para validar el rango.
    CONSTRAINT "closed_days_dates_format" CHECK (
        "start_date" ~ '^\d{4}-\d{2}-\d{2}$' AND "end_date" ~ '^\d{4}-\d{2}-\d{2}$'
    ),
    CONSTRAINT "closed_days_dates_order" CHECK ("end_date" >= "start_date"),

    -- Día completo (ambos nulos) o franja válida: dentro del día, múltiplos de 15 (los buckets
    -- del ledger) y con fin posterior al inicio.
    CONSTRAINT "closed_days_window" CHECK (
        ("start_time" IS NULL AND "end_time" IS NULL)
        OR (
            "start_time" IS NOT NULL AND "end_time" IS NOT NULL
            AND "start_time" >= 0 AND "end_time" <= 1440
            AND "start_time" < "end_time"
            AND "start_time" % 15 = 0 AND "end_time" % 15 = 0
        )
    ),

    CONSTRAINT "closed_days_title_length" CHECK (char_length(btrim("title")) BETWEEN 1 AND 100),

    -- La clave externa solo tiene sentido en filas sincronizadas, y toda fila sincronizada la
    -- necesita (si no, la sincronización no podría ser idempotente).
    CONSTRAINT "closed_days_sync_key" CHECK (
        ("source" = 'NATIONAL_SYNC') = ("external_key" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "closed_days_external_key_key" ON "closed_days"("external_key");

CREATE INDEX "closed_days_status_start_date_end_date_idx" ON "closed_days"("status", "start_date", "end_date");
