import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { deserializeFromCache, serializeForCache } from "@/lib/cache/serialize";
import {
  getPublicEventDetail,
  getUpcomingPublicEventsPage,
} from "@/lib/db/events";
import { listEnabledLandingThemes } from "@/lib/db/landingThemes";
import {
  getLandingNews,
  getOtherPublishedNews,
  getPublishedNewsByRetiredSlug,
  getPublishedNewsBySlug,
  searchPublishedNews,
} from "@/lib/db/news";
import { getSiteConfig } from "@/lib/db/siteConfig";
import { getPublicSpaces, getSpacesByKind } from "@/lib/db/spaces";
import { logger } from "@/lib/logger";

/**
 * Lecturas del sitio público, cacheadas (milestone 25, P2).
 *
 * Antes el layout raíz hacía `connection()`, `auth()` y `getSiteConfig()`, así que **ninguna**
 * página podía prerenderizarse: cada visita a la landing costaba una invocación y ~10 consultas
 * (tema, eventos, noticias, espacios, áreas comunes, configuración). Ahora las páginas públicas
 * se generan una vez y se regeneran (ISR), y sus lecturas pasan por la caché de datos de Next
 * con **tags**:
 *
 * - Cada ruta que escribe algo que el sitio muestra llama a {@link revalidatePublic} con el tag
 *   de lo que cambió, y la próxima visita ve el cambio. Sin esa llamada, el sitio lo muestra
 *   recién al vencer {@link PUBLIC_REVALIDATE_SECONDS}.
 * - Lo que depende del reloj (eventos próximos, fase de inscripción, noticias programadas, tema
 *   del día) no tiene una escritura que lo invalide: lo cubre el vencimiento, que es corto.
 *
 * Una página que lea la base directo (sin pasar por acá) se vuelve a cachear igual — ISR — pero
 * no se entera de las escrituras hasta que vence. Toda lectura pública nueva va acá.
 */

/** Tags de la caché pública. Uno por cosa que el panel edita. */
export const PUBLIC_TAGS = {
  siteConfig: "public:site-config",
  events: "public:events",
  news: "public:news",
  spaces: "public:spaces",
  landingThemes: "public:landing-themes",
} as const;

export type PublicTag = (typeof PUBLIC_TAGS)[keyof typeof PUBLIC_TAGS];

/**
 * Vencimiento de toda lectura pública (y el `revalidate` de las páginas). Es el tope de cuánto
 * puede tardar en verse lo que depende del reloj — un evento que abre inscripción, una noticia
 * programada —, porque eso no tiene una escritura que lo invalide.
 */
export const PUBLIC_REVALIDATE_SECONDS = 300;

/**
 * Envuelve una lectura con `unstable_cache`, serializando BigInt/Date (ver `serialize.ts`). La
 * clave incluye los argumentos, así que una búsqueda con filtros se cachea por filtro.
 */
function cachedRead<A extends unknown[], R>(
  name: string,
  tags: PublicTag[],
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  const cached = unstable_cache(
    async (...args: A) => serializeForCache(await fn(...args)),
    ["public-read", name],
    { tags, revalidate: PUBLIC_REVALIDATE_SECONDS },
  );
  return async (...args: A) => deserializeFromCache<R>(await cached(...args));
}

/**
 * Invalida lo que el sitio público muestra de estas entidades. Nunca tira: si la caché falla,
 * la escritura ya está hecha y el sitio se pone al día al vencer el `revalidate`.
 */
export function revalidatePublic(...tags: PublicTag[]): void {
  for (const tag of tags) {
    try {
      revalidateTag(tag);
    } catch (error) {
      logger.warn("revalidatePublic failed", {
        tag,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/** Contacto, teléfono de WhatsApp, redes: pie, CTA de la landing, botón flotante. */
export const getPublicSiteConfig = cachedRead(
  "site-config",
  [PUBLIC_TAGS.siteConfig],
  () => getSiteConfig(),
);

/** Los temas habilitados de la landing; el del día lo resuelve la página con su reloj. */
export const getPublicLandingThemes = cachedRead(
  "landing-themes",
  [PUBLIC_TAGS.landingThemes],
  listEnabledLandingThemes,
);

/**
 * Próximos eventos de la landing. Depende también de los nombres de tipo y de espacio, y de
 * la cantidad de inscriptos (fase «completo»), por eso esas escrituras invalidan `events` y
 * `spaces`.
 */
export const getPublicUpcomingEventsPage = cachedRead(
  "upcoming-events-page",
  [PUBLIC_TAGS.events, PUBLIC_TAGS.spaces],
  getUpcomingPublicEventsPage,
);

export const getPublicEventDetailCached = cachedRead(
  "event-detail",
  [PUBLIC_TAGS.events, PUBLIC_TAGS.spaces],
  getPublicEventDetail,
);

export const getPublicLandingNews = cachedRead(
  "landing-news",
  [PUBLIC_TAGS.news],
  getLandingNews,
);

export const getPublicNewsSearch = cachedRead(
  "news-search",
  [PUBLIC_TAGS.news],
  searchPublishedNews,
);

export const getPublicNewsBySlug = cachedRead(
  "news-by-slug",
  [PUBLIC_TAGS.news],
  getPublishedNewsBySlug,
);

export const getPublicNewsByRetiredSlug = cachedRead(
  "news-by-retired-slug",
  [PUBLIC_TAGS.news],
  getPublishedNewsByRetiredSlug,
);

export const getPublicOtherNews = cachedRead(
  "other-news",
  [PUBLIC_TAGS.news],
  getOtherPublishedNews,
);

/** Espacios y áreas comunes juntos (`/spaces`). */
export const getPublicSpacesCached = cachedRead(
  "spaces-all",
  [PUBLIC_TAGS.spaces],
  getPublicSpaces,
);

/** Un solo tipo (secciones de la landing). */
export const getPublicSpacesByKind = cachedRead(
  "spaces-by-kind",
  [PUBLIC_TAGS.spaces],
  getSpacesByKind,
);
