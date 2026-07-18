import { defineModule } from "@/modules/types";
import { newsApi, type NewsApi } from "./api";
import type { NewsConfig } from "./config";
import { newsManifest } from "./manifest";

/**
 * News module (scaffold): a future newsletter feature. Registered in
 * src/modules/registry.ts; enable it under `modules.news` in app.config.ts.
 */
export const newsModule = defineModule<NewsApi, NewsConfig>({
  ...newsManifest,
  operations: newsApi,
});

export type { NewsApi, NewsItem } from "./api";
export type { NewsConfig } from "./config";
