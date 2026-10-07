import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SITE_CONFIG } from "@/lib/constants/contact";
import type { SiteConfigInput } from "@/lib/schemas/config";
import type { SiteConfig } from "@/generated/prisma/client";

export type { SiteConfig };

const SITE_CONFIG_ID = "site";

/**
 * Reads the singleton site config, creating it from {@link DEFAULT_SITE_CONFIG} if the row is
 * missing (migration seeds it, but this keeps a fresh/un-seeded DB working). Public callers
 * (footer, about) can rely on always getting a value.
 */
// `cache()`: deduplica dentro de un render. El sitio público no la llama directo sino por
// `getPublicSiteConfig` (caché de datos con tag, `src/lib/cache/public-reads.ts`, milestone 25 P2).
export const getSiteConfig = cache(async (): Promise<SiteConfig> => {
  const existing = await prisma.siteConfig.findUnique({
    where: { id: SITE_CONFIG_ID },
  });
  if (existing) return existing;
  return prisma.siteConfig.create({
    data: { id: SITE_CONFIG_ID, ...DEFAULT_SITE_CONFIG },
  });
});

export async function updateSiteConfig(
  input: SiteConfigInput,
): Promise<SiteConfig> {
  return prisma.siteConfig.upsert({
    where: { id: SITE_CONFIG_ID },
    create: { id: SITE_CONFIG_ID, ...input },
    update: input,
  });
}
