import { defineModule } from "@/modules/types";
import { eventsApi, type EventsApi } from "./api";
import type { EventsConfig } from "./config";
import { eventsManifest } from "./manifest";

/**
 * Events module: admin-run workshops/classes with public registration forms.
 * Server-side definition (manifest + data api). Registered in src/modules/registry.ts.
 */
export const eventsModule = defineModule<EventsApi, EventsConfig>({
  ...eventsManifest,
  operations: eventsApi,
});

export type { EventsApi } from "./api";
export type { EventsConfig } from "./config";
