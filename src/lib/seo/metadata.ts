import type { Metadata } from "next";

/**
 * Metadatos de SEO y de vista previa al compartir (milestone 41).
 *
 * Antes no había ninguna etiqueta Open Graph en todo el sitio ni `metadataBase`: WhatsApp y las
 * redes adivinaban la imagen con la primera que encontraban (el escudo municipal del header), y
 * Google, con una sola descripción genérica, armaba el fragmento con texto de la página —
 * distinto según la consulta. Este módulo es la **única fuente** de esas etiquetas: las páginas
 * llaman `pageMetadata()` en su `metadata` / `generateMetadata` en vez de armar el objeto a mano.
 *
 * Por qué cada página arma el `openGraph` completo: Next combina los metadatos de layout y página
 * de forma **superficial** — si una página define `openGraph`, reemplaza el del layout entero (se
 * perdían `siteName`, `locale` y la imagen por defecto). Por eso el helper siempre los incluye.
 */

/** Nombre del sitio, como aparece en las vistas previas y en el sufijo del título. */
export const SITE_NAME = "La Nube";

/**
 * Descripción por defecto del sitio (portada y páginas sin descripción propia). Escrita a
 * propósito, ≤ 160 caracteres, a partir del Plan Estratégico (fuente del copy institucional):
 * si Google tiene una descripción que responde a la búsqueda, la reescribe mucho menos.
 */
export const DEFAULT_DESCRIPTION =
  "Polo Tecnológico de Concepción del Uruguay: coworking, laboratorio y salas para reservar, eventos y formación en economía del conocimiento.";

/**
 * Imagen de vista previa por defecto (1200 × 630, isologo sobre los colores de marca). Es un
 * archivo estático de `public/` — nunca el escudo municipal. Se regenera con
 * `scripts/og-default.mjs` si cambia la marca.
 */
export const DEFAULT_OG_IMAGE = {
  url: "/og-default.png",
  width: 1200,
  height: 630,
  alt: "La Nube — Polo Tecnológico de Concepción del Uruguay",
} as const;

/**
 * URL canónica del sitio (origen, sin barra final). Sale de **env**, nunca del pedido: el layout
 * raíz no puede leer `headers()` (milestone 25, §19) y las páginas públicas se prerenderizan en el
 * build. Orden: `NEXT_PUBLIC_SITE_URL` (variable del repo en CI, como el resto de `NEXT_PUBLIC_*`)
 * → `NEXTAUTH_URL` → el dominio de producción de Vercel → localhost.
 */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** Une el origen del sitio con una ruta o devuelve la URL tal cual si ya es absoluta. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${siteUrl()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/**
 * Recorta un texto para una meta descripción: sin saltos de línea ni markdown básico, y como
 * mucho `max` caracteres cortando en un espacio. Devuelve `undefined` si queda vacío.
 */
export function toMetaDescription(
  text: string | null | undefined,
  max = 160,
): string | undefined {
  if (!text) return undefined;
  const plain = text
    .replace(/[#>*_`~[\]()!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return undefined;
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export interface PageMetadataInput {
  /** Título de la página **sin** el sufijo «· La Nube» (lo agrega el template del layout). */
  title?: string;
  /** Descripción; si falta, la del sitio. */
  description?: string | null;
  /** Ruta canónica (`/news/2026/11/25/slug`). */
  path: string;
  /** Imagen de la vista previa (URL absoluta o ruta del sitio); si falta, la de marca. */
  image?: string | null;
  imageAlt?: string;
  /** `article` para noticias; `website` para el resto. */
  type?: "website" | "article";
  /** ISO 8601, para `article:published_time`. */
  publishedTime?: string;
  /** Página que se puede compartir pero no debe indexarse (formularios de eventos privados). */
  noindex?: boolean;
}

/**
 * Metadatos completos de una página: título, descripción, canónica, Open Graph y Twitter. Ver el
 * comentario del módulo sobre por qué el `openGraph` va entero.
 */
export function pageMetadata(input: PageMetadataInput): Metadata {
  const description = input.description || DEFAULT_DESCRIPTION;
  const images = input.image
    ? [{ url: input.image, alt: input.imageAlt ?? input.title ?? SITE_NAME }]
    : [DEFAULT_OG_IMAGE];
  const ogTitle = input.title ?? `${SITE_NAME} · Polo Tecnológico`;
  return {
    ...(input.title ? { title: input.title } : {}),
    description,
    alternates: { canonical: input.path },
    openGraph: {
      type: input.type ?? "website",
      siteName: SITE_NAME,
      locale: "es_AR",
      url: input.path,
      title: ogTitle,
      description,
      images,
      ...(input.type === "article" && input.publishedTime
        ? { publishedTime: input.publishedTime }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: images.map((i) => i.url),
    },
    ...(input.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** Datos de contacto que usa `organizationJsonLd` (subconjunto de `SiteConfig`). */
export interface OrganizationContact {
  addressText: string;
  email: string;
  phoneClickable: string;
  instagramUrl: string;
  githubUrl: string;
}

/**
 * Datos estructurados `Organization` de la portada (schema.org, JSON-LD): ayudan a que Google
 * muestre el nombre y el logo correctos. Sale de la configuración del sitio (la misma del pie),
 * así un cambio de contacto en el panel llega solo. Pura, para testearla.
 */
export function organizationJsonLd(contact: OrganizationContact) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "La Nube — Polo Tecnológico",
    alternateName: SITE_NAME,
    url: siteUrl(),
    logo: absoluteUrl("/images/lanube-logo.svg"),
    description: DEFAULT_DESCRIPTION,
    email: contact.email,
    telephone: contact.phoneClickable,
    address: {
      "@type": "PostalAddress",
      streetAddress: contact.addressText,
      addressLocality: "Concepción del Uruguay",
      addressRegion: "Entre Ríos",
      addressCountry: "AR",
    },
    sameAs: [contact.instagramUrl, contact.githubUrl].filter(Boolean),
  };
}

/**
 * Serializa JSON-LD para un `<script type="application/ld+json">`. Escapa `<` para que un texto
 * de la base (p. ej. «</script>» en la dirección) no pueda cerrar la etiqueta.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
