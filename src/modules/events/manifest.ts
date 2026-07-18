import { defineModuleManifest } from "@/modules/types";
import { CalendarDays, FileText } from "lucide-react";
import {
  eventsConfigSchema,
  eventsDefaultConfig,
  type EventsConfig,
} from "./config";

/**
 * Client-safe manifest for the events module. Contains nav + config metadata only —
 * NO database/server imports — so it can be pulled into client nav components.
 */
export const eventsManifest = defineModuleManifest<EventsConfig>({
  id: "events",
  name: "Eventos",
  configSchema: eventsConfigSchema,
  defaultConfig: eventsDefaultConfig,
  nav: {
    admin: [
      { label: "Eventos", href: "/admin/events", icon: CalendarDays },
      { label: "Formularios", href: "/admin/forms", icon: FileText },
    ],
    user: [{ label: "Mis eventos", href: "/user/events", icon: CalendarDays }],
  },
});
