import appConfigRaw from "../../app.config";
import type { AppConfig } from "./types";

/**
 * Resolved application config: the root `app.config.ts` with environment overrides
 * applied. Import from here (not `app.config.ts` directly) so env vars take effect.
 *
 * Only a small set of fields are env-overridable — everything client-visible must use
 * a `NEXT_PUBLIC_*` var so it is inlined into the client bundle.
 */
function applyEnvOverrides(config: AppConfig): AppConfig {
  return {
    ...config,
    brand: {
      ...config.brand,
      name: process.env.NEXT_PUBLIC_BRAND_NAME ?? config.brand.name,
      tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE ?? config.brand.tagline,
      description:
        process.env.NEXT_PUBLIC_BRAND_DESCRIPTION ?? config.brand.description,
    },
    contact: {
      ...config.contact,
      email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? config.contact.email,
    },
  };
}

export const appConfig: AppConfig = applyEnvOverrides(appConfigRaw);

export const getBrand = () => appConfig.brand;
export const getContact = () => appConfig.contact;
export const getCopy = () => appConfig.copy;

/** Resolved next-themes storage key (stable per deployment). */
export const getThemeStorageKey = () =>
  appConfig.brand.themeStorageKey ?? "app-theme";

/** Raw module settings for a given module id (or undefined if not configured). */
export const getModuleSettings = (id: string) => appConfig.modules[id];

export * from "./types";
