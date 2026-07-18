# Modules

Features are packaged as **modules** under `src/modules/<id>/`. A module is a
self-contained vertical (events today; a newsletter tomorrow) that:

- exposes **standardized operations** (reads _and_ writes) the app calls into,
- contributes **navigation** entries to the admin/user shells,
- carries its own **config schema** (validated per deployment),
- can be **enabled/disabled** from `app.config.ts` with no code changes.

**A module exposes operations, not routes.** Because the Next.js App Router is
filesystem-based, a module can't register endpoints. It ships plain server functions;
the **app** owns the route files (`src/app/**`) and wires each one to a module
operation. This prevents modules from colliding on URLs and lets the integrator choose
paths, auth, and rate-limiting per deployment.

Built-in modules: **events** (`src/modules/events`) and **news** (`src/modules/news`,
a scaffold). Enable/disable them under `modules` in `app.config.ts`.

## The server/client split (important)

Next.js App Router bundles client components separately, and module data code touches the
database (server-only). So every module is split in two:

| File          | Runs on | Contains                                          | Safe to import from                |
| ------------- | ------- | ------------------------------------------------- | ---------------------------------- |
| `manifest.ts` | both    | id, name, nav entries, config schema — **no db**  | anywhere (incl. client nav)        |
| `index.ts`    | server  | the manifest **+** `operations` (db queries etc.) | Server Components, route delegates |

Two registries mirror this split:

- `src/modules/manifests.ts` — **client-safe**. `getModuleNav(surface)`, `isModuleEnabled(id)`.
- `src/modules/registry.ts` + `src/modules/index.ts` — **server**. `getModule`, `getModuleConfig`, and the typed `modules` accessor.

> Rule of thumb: client components import `@/modules/manifests`; server code imports `@/modules`.

## Calling a module's operations

Use the typed `modules` accessor. Each property is `undefined` when the module is disabled,
so callers degrade gracefully. Use it from a **route delegate** (the app-owned `route.ts`)
or any Server Component:

```tsx
// src/app/api/events/route.ts — owned by the app, delegates to the module
import { modules } from "@/modules";

export async function GET() {
  const events = modules.events; // (EventsApi & { config }) | undefined
  if (!events) return Response.json({ events: [] }); // module off → empty
  const { events: items } = await events.getUpcoming(
    1,
    events.config.landingLimit,
  );
  return Response.json({ events: items });
}
```

The events operations surface (`src/modules/events/api.ts`):

- `getUpcoming(page, pageSize)` — paginated upcoming published events
- `listUpcoming(limit?)` — flat list, newest first
- `getDetail(id)` — full public detail, or `null`

> Writes belong here too. A `submitRegistration(...)` / `createEvent(...)` operation lives on
> the module; the app's `route.ts` validates input, checks auth/RBAC, and calls the operation.

## Authoring a new module

Create `src/modules/<id>/` with these files (copy `src/modules/news` as a starting point):

**1. `config.ts`** — a Zod schema + defaults:

```ts
import { z } from "zod";
export const myConfigSchema = z.object({
  showOnLanding: z.boolean().default(true),
});
export type MyConfig = z.infer<typeof myConfigSchema>;
export const myDefaultConfig: MyConfig = { showOnLanding: true };
```

**2. `manifest.ts`** — client-safe metadata (nav uses Lucide icons):

```ts
import { defineModuleManifest } from "@/modules/types";
import { Newspaper } from "lucide-react";
import { myConfigSchema, myDefaultConfig, type MyConfig } from "./config";

export const myManifest = defineModuleManifest<MyConfig>({
  id: "my-feature",
  name: "My Feature",
  configSchema: myConfigSchema,
  defaultConfig: myDefaultConfig,
  nav: {
    admin: [
      { label: "My Feature", href: "/admin/my-feature", icon: Newspaper },
    ],
  },
});
```

**3. `api.ts`** — server operations, reads and writes (may import a `./db` layer / prisma):

```ts
export const myApi = {
  listLatest: async (limit?: number) => [],
  create: async (input: MyInput) => {
    /* ... */
  },
};
export type MyApi = typeof myApi;
```

**4. `index.ts`** — combine into a definition:

```ts
import { defineModule } from "@/modules/types";
import { myApi, type MyApi } from "./api";
import type { MyConfig } from "./config";
import { myManifest } from "./manifest";

export const myModule = defineModule<MyApi, MyConfig>({
  ...myManifest,
  operations: myApi,
});
export type { MyApi } from "./api";
export type { MyConfig } from "./config";
```

**5. Register it (two one-line edits):**

- `src/modules/manifests.ts` → add `myManifest` to `ALL_MANIFESTS`.
- `src/modules/registry.ts` → add `myModule` to `ALL_MODULES`.

Optionally add a typed getter to the `modules` accessor in `src/modules/index.ts`, and
enable it in `app.config.ts`:

```ts
modules: { "my-feature": { enabled: true } }
```

## Routes (owned by the app, not the module)

Next.js routes are file-based, so a module can't inject routes at runtime — and by design
it shouldn't. Add the route files under `src/app/**` yourself and keep them **thin**: parse
input, enforce auth/RBAC, then call a module operation via the `modules` accessor.

```ts
// src/app/api/events/[id]/register/route.ts
import { modules } from "@/modules";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const events = modules.events;
  if (!events) return new Response("Not found", { status: 404 });
  const body = await req.json();
  const result = await events.submitRegistration(params.id, body);
  return Response.json(result);
}
```

Route handlers should call **operations**, not reach into a module's internal `db/` layer —
that keeps the module's surface area explicit and the module portable. Nav entries in the
manifest point at the routes you created.

## Prisma models

Database schema is app-wide (`prisma/models/*.prisma`), not per-module — a module owns the
**query/logic layer** for its tables, not the schema files.
