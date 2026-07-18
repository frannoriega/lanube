import { appConfig } from "@/config";
import { eventsManifest } from "./events/manifest";
import { newsManifest } from "./news/manifest";
import type { ModuleManifest, NavEntry, NavSurface } from "./types";

/**
 * Client-safe module registry (manifests only — no server/database code).
 * Import this from client components (nav, layouts) to discover enabled modules
 * and their nav entries. For server-side data access, use `src/modules/registry.ts`.
 *
 * To register a new module: add its manifest to this array (and its full definition
 * to registry.ts).
 */
const ALL_MANIFESTS: ModuleManifest[] = [eventsManifest, newsManifest];

/** Is a module enabled in the active app.config.ts? */
export function isModuleEnabled(id: string): boolean {
  return appConfig.modules[id]?.enabled ?? false;
}

/** All manifests for currently-enabled modules. */
export function getEnabledManifests(): ModuleManifest[] {
  return ALL_MANIFESTS.filter((m) => isModuleEnabled(m.id));
}

/** Aggregated nav entries for a surface, across all enabled modules. */
export function getModuleNav(surface: NavSurface): NavEntry[] {
  return getEnabledManifests().flatMap((m) => m.nav?.[surface] ?? []);
}
