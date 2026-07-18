import type { LucideIcon } from "lucide-react";
import type { ZodType } from "zod";

/**
 * Module system contract.
 *
 * A module is a self-contained feature (events, a future newsletter, …) that plugs
 * into the app. It is split into two halves to respect the server/client boundary:
 *
 *  - **manifest** (`ModuleManifest`) — client-safe metadata: id, name, nav entries,
 *    config schema. Safe to import anywhere (no database / server-only code).
 *  - **definition** (`ModuleDefinition`) — the manifest plus the server-side
 *    `operations`. Import only from Server Components, route handlers, and server
 *    utilities.
 *
 * Client code (nav, layouts) consumes manifests via `src/modules/manifests.ts`;
 * server code (landing, routes) consumes definitions via `src/modules/registry.ts`
 * and the typed `modules` accessor in `src/modules/index.ts`.
 *
 * ## Modules expose operations, not routes
 *
 * A module ships **operations** — plain server functions (reads *and* writes:
 * `getUpcoming`, `submitRegistration`, `createEvent`, …). It does **not** own HTTP
 * routes. The Next.js App Router is filesystem-based, so route files live in the app
 * (`src/app/api/**`) and are written by the integrator as thin delegates that call a
 * module operation:
 *
 *   // src/app/api/events/route.ts (owned by the app, not the module)
 *   export async function GET() {
 *     const events = modules.events;
 *     if (!events) return Response.json({ events: [] });
 *     return Response.json(await events.getUpcoming(1, events.config.landingLimit));
 *   }
 *
 * This keeps modules from colliding on endpoints, lets the integrator choose URLs,
 * auth, and rate-limiting per deployment, and keeps a module portable (its logic has
 * no framework/routing dependency).
 */

/** Where a nav entry appears. */
export type NavSurface = "admin" | "user" | "public";

/** A single navigation link contributed by a module. */
export interface NavEntry {
  label: string;
  href: string;
  /** Lucide icon (used by the management sidebar; ignored by the public header). */
  icon?: LucideIcon;
  /** Optional RBAC permission required to see this entry (see src/lib/rbac.ts). */
  permission?: string;
}

export type ModuleNav = Partial<Record<NavSurface, NavEntry[]>>;

/** Client-safe module metadata. MUST NOT import server-only code (prisma, etc.). */
export interface ModuleManifest<TConfig = unknown> {
  /** Stable identifier, e.g. "events". Matches the key under `modules` in app.config.ts. */
  id: string;
  /** Human-readable module name. */
  name: string;
  version?: string;
  /** Zod schema validating this module's `config` block from app.config.ts. */
  configSchema?: ZodType<TConfig>;
  /** Defaults merged under a deployment's config. */
  defaultConfig?: TConfig;
  /** Nav entries this module contributes, by surface. */
  nav?: ModuleNav;
  /** Permissions this module introduces (informational; RBAC is defined in rbac.ts). */
  permissions?: string[];
}

/**
 * Full module definition: manifest + server-side `operations`. The `operations` are
 * the standardized surface the app calls into — plain functions (reads and writes)
 * that route delegates, Server Components, and other server code invoke via the
 * `modules.<id>` accessor (e.g. `modules.events.getUpcoming()`). Modules never
 * register routes themselves (see the file header).
 */
export interface ModuleDefinition<
  TOperations extends Record<string, (...args: never[]) => unknown> = Record<
    string,
    (...args: never[]) => unknown
  >,
  TConfig = unknown,
> extends ModuleManifest<TConfig> {
  operations: TOperations;
}

/** Identity helper for authoring a client-safe manifest with type inference. */
export function defineModuleManifest<TConfig = unknown>(
  manifest: ModuleManifest<TConfig>,
): ModuleManifest<TConfig> {
  return manifest;
}

/** Identity helper for authoring a full module definition. */
export function defineModule<
  TOperations extends Record<string, (...args: never[]) => unknown>,
  TConfig = unknown,
>(
  definition: ModuleDefinition<TOperations, TConfig>,
): ModuleDefinition<TOperations, TConfig> {
  return definition;
}
