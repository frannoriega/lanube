import type { EventsApi, EventsConfig } from "./events";
import type { NewsApi, NewsConfig } from "./news";
import { getModule, getModuleConfig } from "./registry";

/**
 * Standardized, typed accessor for module operations — the front door the app uses
 * to call into a module (reads and writes). Each accessor returns `undefined` when
 * the module is disabled in app.config.ts, so callers degrade gracefully:
 *
 *   const events = modules.events;
 *   if (events) await events.getUpcoming(1, events.config.landingLimit);
 *
 * Server-only (operations touch the database). Use from route delegates, Server
 * Components, and server utilities. Modules do not own routes — the app wires each
 * operation to an endpoint (see src/modules/types.ts).
 */
export const modules = {
  get events(): (EventsApi & { config: EventsConfig }) | undefined {
    const mod = getModule("events");
    if (!mod) return undefined;
    return {
      ...(mod.operations as EventsApi),
      config: getModuleConfig<EventsConfig>("events")!,
    };
  },

  get news(): (NewsApi & { config: NewsConfig }) | undefined {
    const mod = getModule("news");
    if (!mod) return undefined;
    return {
      ...(mod.operations as NewsApi),
      config: getModuleConfig<NewsConfig>("news")!,
    };
  },
};

export { getModule, getModuleConfig, getModules } from "./registry";
export {
  getModuleNav,
  getEnabledManifests,
  isModuleEnabled,
} from "./manifests";
export type {
  ModuleDefinition,
  ModuleManifest,
  NavEntry,
  NavSurface,
} from "./types";
