-- Seeds the coworking's anniversary theme (Sept 25, recurring every year).
-- Idempotent: skipped if a theme with this id already exists (e.g. re-run in dev).
INSERT INTO "landing_themes" (
    "id",
    "name",
    "is_enabled",
    "priority",
    "recurring",
    "start_month_day",
    "end_month_day",
    "entrance_effect",
    "emoji_list",
    "particle_count",
    "hero_eyebrow_override",
    "hero_extra_keyword"
)
SELECT
    'landing-theme-anniversary',
    'Aniversario',
    true,
    10,
    true,
    '09-25',
    '09-25',
    'EMOJI_SHOWER',
    '🎉 🎊 🥳',
    50,
    '🎉 Hoy celebramos nuestro aniversario',
    'celebración'
WHERE NOT EXISTS (
    SELECT 1 FROM "landing_themes" WHERE "id" = 'landing-theme-anniversary'
);
