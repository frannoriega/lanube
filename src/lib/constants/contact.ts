import type { SiteConfigInput } from "@/lib/schemas/config";

/**
 * Default public contact info. This is now superadmin-editable and lives in the DB
 * (`site_config` singleton, seeded from these values in migration
 * `20260901000000_space_content_and_site_config`). These constants remain the canonical
 * fallback used by `getSiteConfig()` when the row is missing (e.g. a fresh DB before seed).
 */
export const DEFAULT_SITE_CONFIG: SiteConfigInput = {
  addressText: "Maipú esquina Posadas, Concepción del Uruguay, Entre Ríos",
  addressUrl:
    "https://www.google.com/maps/search/?api=1&query=Maip%C3%BA%20esquina%20Posadas%2C%20Concepci%C3%B3n%20del%20Uruguay%2C%20Entre%20R%C3%ADos",
  email: "polotecnologicolanube@gmail.com",
  phoneText: "(+54) 9 3442 550836",
  phoneClickable: "+5493442550836",
  instagramUrl: "https://www.instagram.com/lanubepolotec",
  instagramText: "lanubepolotec",
  githubUrl: "https://github.com/frannoriega/lanube",
  githubText: "lanube",
};
