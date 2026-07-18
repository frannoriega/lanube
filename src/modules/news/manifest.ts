import { defineModuleManifest } from "@/modules/types";
import { Newspaper } from "lucide-react";
import { newsConfigSchema, newsDefaultConfig, type NewsConfig } from "./config";

/**
 * Client-safe manifest for the news module. See src/modules/news/README.md.
 * Disabled by default in app.config.ts — enable it to switch the feature on.
 */
export const newsManifest = defineModuleManifest<NewsConfig>({
  id: "news",
  name: "Noticias",
  configSchema: newsConfigSchema,
  defaultConfig: newsDefaultConfig,
  nav: {
    admin: [{ label: "Noticias", href: "/admin/news", icon: Newspaper }],
  },
});
