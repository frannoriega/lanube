/**
 * Canonical public origin for absolute URLs (metadata, sitemap, robots, JSON-LD).
 * NEXT_PUBLIC_SITE_URL lets preview deployments (e.g. lanube-gules.vercel.app)
 * override the production domain.
 */
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://lanube.cdeluruguay.gob.ar"
).replace(/\/+$/, "");

const siteName = "La Nube - Polo Tecnológico";

const siteDescription =
  "La Nube es el Polo Tecnológico de Concepción del Uruguay, Entre Ríos, Argentina. Coworking, innovación y Economía del Conocimiento para empresas, universidades y emprendedores.";

export { siteDescription, siteName, siteUrl };
