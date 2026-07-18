import { appConfig } from "@/config";
import { eventsModule } from "./events";
import { newsModule } from "./news";
import { isModuleEnabled } from "./manifests";
import type { ModuleDefinition } from "./types";

/**
 * Server-side module registry: full module definitions including their data `api`.
 * Import this (or the typed `modules` accessor in ./index) from Server Components,
 * route handlers, and server utilities. Never import it into client components — it
 * pulls in modules' server-only code (Prisma, etc.).
 *
 * To register a new module: add its definition here (and its manifest in manifests.ts).
 */
const ALL_MODULES: ModuleDefinition[] = [eventsModule, newsModule];

const enabledModules = new Map<string, ModuleDefinition>(
  ALL_MODULES.filter((m) => isModuleEnabled(m.id)).map((m) => [m.id, m]),
);

/** All enabled module definitions. */
export function getModules(): ModuleDefinition[] {
  return [...enabledModules.values()];
}

/** A single enabled module by id, or undefined if disabled/unknown. */
export function getModule(id: string): ModuleDefinition | undefined {
  return enabledModules.get(id);
}

/**
 * Resolved, validated config for a module: its `defaultConfig` merged with the
 * deployment's `modules.<id>.config` block, parsed through the module's Zod schema.
 * Returns undefined if the module is disabled.
 */
export function getModuleConfig<T>(id: string): T | undefined {
  const mod = enabledModules.get(id);
  if (!mod) return undefined;
  const raw = appConfig.modules[id]?.config ?? {};
  const merged = { ...(mod.defaultConfig ?? {}), ...raw };
  return (mod.configSchema ? mod.configSchema.parse(merged) : merged) as T;
}
