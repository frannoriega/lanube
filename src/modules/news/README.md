# News module (scaffold)

A placeholder for a future **newsletter** feature. It exists to demonstrate that a second
module plugs into the app with no core changes — following the same contract as `events`.

**Status:** scaffold. Disabled by default in `app.config.ts` (`modules.news.enabled = false`).
The data API (`api.ts`) returns empty results until the real feature is built.

## What's here

- `config.ts` — Zod config schema (`showOnLanding`, `landingLimit`) + defaults.
- `manifest.ts` — client-safe metadata + an admin nav entry (`/admin/news`).
- `api.ts` — `listLatest(limit?)` stub returning `[]`.
- `index.ts` — the assembled module definition.

## Turning it into a real module

1. Add Prisma models for news posts (`prisma/models/*.prisma`) and a `db.ts` query layer.
2. Implement `api.listLatest` (and any detail getter) against `db.ts`.
3. Add route files under `src/app/**` (admin CRUD, public read) and point the manifest nav at them.
4. Add a typed `news` getter to `src/modules/index.ts` if you want `modules.news.listLatest()` typed.
5. Enable it: `modules: { news: { enabled: true } }` in `app.config.ts`.

See [`docs/MODULES.md`](../../../docs/MODULES.md) for the full authoring guide.
