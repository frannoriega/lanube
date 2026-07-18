import { getContact } from "@/config";
import type { SiteConfigInput } from "@/lib/schemas/config";

/**
 * Default public contact info, seeded from the whitelabel config (`app.config.ts`).
 * This is superadmin-editable at runtime and lives in the DB (`site_config` singleton,
 * seeded from these values in migration `20260901000000_space_content_and_site_config`).
 * These constants remain the canonical fallback used by `getSiteConfig()` when the row is
 * missing (e.g. a fresh DB before seed).
 *
 * Note: `addressText`/`addressUrl`/`*Text` display strings don't have a 1:1 field in
 * `ContactConfig` (which models `address` as structured parts), so they're still spelled
 * out here rather than derived — keep them in sync with `app.config.ts` by hand for now.
 */
const contact = getContact();

export const DEFAULT_SITE_CONFIG: SiteConfigInput = {
  addressText: "Maipú esquina Posadas, Concepción del Uruguay, Entre Ríos",
  addressUrl:
    "https://www.google.com/maps/search/?api=1&query=Maip%C3%BA%20esquina%20Posadas%2C%20Concepci%C3%B3n%20del%20Uruguay%2C%20Entre%20R%C3%ADos",
  email: contact.email,
  phoneText: contact.phone,
  phoneClickable: contact.clickablePhone,
  instagramUrl: contact.social.instagram?.url ?? "",
  instagramText: contact.social.instagram?.text ?? "",
  githubUrl: contact.social.github?.url ?? "",
  githubText: contact.social.github?.text ?? "",
};

/** Static fallback email for contexts that can't await `getSiteConfig()` (e.g. MDX policy pages). */
export const email = contact.email;
