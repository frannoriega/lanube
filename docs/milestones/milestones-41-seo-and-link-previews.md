# Milestone 41 — SEO y vista previa al compartir

**Estado:** done (2026-11-25). Versión 1.2.0.

## Qué pidió el usuario (2026-11-25)

1. Al compartir una noticia, un evento, etc., la **vista previa** (WhatsApp, redes) muestra el
   **logo de la municipalidad** en lugar de la imagen de la noticia o del evento.
2. Buscando el sitio en Google aparecen **descripciones distintas según la computadora**:
   - «Formación gratuita y virtual para jóvenes de 17 a 30 años…»
   - «Espacio flexible para trabajo individual y colaborativo. Ideal para programar, diseñar,
     investigar, atender reuniones breves y avanzar proyectos tecnológicos.» — con un «Leer más»
     que lleva a la sección de miembros de la portada, lo que no está bueno.

## Causa (verificada en el código)

- **No hay ninguna etiqueta Open Graph ni Twitter** en todo `src/` (ni `openGraph` en un
  `metadata`, ni `opengraph-image.*`). Sin `og:image`, WhatsApp/Facebook/X adivinan con la primera
  imagen que encuentran: el escudo de la municipalidad (`atoms/logos/municipio`) está en el header.
- **No hay `metadataBase`**, así que aunque hubiera imágenes relativas no saldrían como URL absoluta.
- La descripción global es una sola, genérica: `'Espacio de coworking e innovación "La Nube"'`
  (`src/app/layout.tsx`), y ni la portada, ni `/events/[id]`, ni `/forms/[slug]` tienen
  `generateMetadata`. Google, sin una descripción que le sirva, **arma el fragmento con texto de la
  página** — y elige distinto según la consulta y la región, por eso ve cada uno algo distinto. La
  segunda descripción es el texto del espacio Coworking (de la base); la primera parece ser el
  copete de un evento o noticia. El «Leer más» es el enlace de Google a un **fragmento de texto**
  (`#:~:text=`) que salta al lugar de la portada donde encontró esa frase; no hay ningún ancla
  `#miembros` en nuestro código.
- No hay `robots.ts` ni `sitemap.ts`.

## Diseño

### Base

- `metadataBase` en el layout raíz desde una variable pública de la URL canónica
  (`NEXT_PUBLIC_SITE_URL`; si falta, la de NextAuth). El layout raíz **no puede leer el pedido**
  (milestone 25, §19): la URL sale de env, nunca de `headers()`.
- `title.template` (`%s · La Nube`) + `title.default`, y una **descripción por defecto escrita a
  propósito** (1–2 oraciones, ≤ 160 caracteres) tomada del Plan Estratégico (fuente autorizada del
  copy institucional). Se propone el texto en la implementación y se le muestra al usuario.
- `openGraph` por defecto: `siteName: "La Nube"`, `locale: "es_AR"`, `type: "website"` y una
  **imagen de marca propia** 1200 × 630 (generada con `opengraph-image.tsx` de Next, usando el
  isologo y los colores `la-nube-night`/`la-nube-ink`) — **nunca** el escudo municipal.
  `twitter.card = "summary_large_image"`.
- `alternates.canonical` por página, así las variantes (`/noticias` → `/news`, query strings) no
  compiten.

### Por página (`generateMetadata`)

- **Noticia** (`/news/[yyyy]/[mm]/[dd]/[slug]`): título, copete como descripción, `og:type=article`,
  `publishedTime`, portada (`coverImageUrl`) como `og:image`; sin portada → la imagen generada de la
  noticia (el mismo patrón determinista de `NewsCover`, en un `opengraph-image.tsx` de la ruta).
- **Evento** (`/events/[id]`) y **formulario** (`/forms/[slug]`): nombre, `summary` como
  descripción (nunca el markdown crudo), `imageUrl` como `og:image`. El formulario de un evento
  **privado** (milestone 43) sí tiene vista previa (se comparte justamente por WhatsApp) pero lleva
  `robots: { index: false }`.
- **Espacios** (`/spaces`), **Quiénes somos**, **Noticias** (índice), **Changelog**, **Políticas**:
  título y descripción propios.
- Portada: la descripción por defecto (es la que más se busca).
- Las imágenes de `uploads/` son relativas en el VPS: con `metadataBase` salen absolutas. Las de
  Vercel Blob ya son absolutas.
- Todo sale de las **lecturas cacheadas** (`public-reads.ts`), así el `generateMetadata` y la página
  comparten la consulta (regla del milestone 25).

### Rastreo

- `src/app/robots.ts`: permite el sitio público, bloquea `/admin`, `/user`, `/api`, `/auth`,
  `/oauth`, `/forms/response` (los enlaces de edición son credenciales) y apunta al sitemap.
- `src/app/sitemap.ts`: portada, páginas fijas, noticias publicadas, eventos públicos **no
  privados**. Revalida con los mismos tags que el sitio público.
- **Datos estructurados** `Organization` (nombre, logo, dirección, contacto de la config del sitio)
  en la portada: ayuda a que Google muestre el nombre y el logo correctos. Es chico y está dentro de
  «que Google describa bien el sitio»; si el usuario no lo quiere, se saca.

### Lo que no podemos controlar (se le explica al usuario)

Google **puede reescribir** la descripción aunque tengamos una buena; lo hace menos cuando la meta
descripción responde a lo que se busca. El cambio tarda lo que tarde Google en volver a rastrear (se
puede acelerar pidiendo la reindexación en Search Console). Si después sigue sacando el fragmento de
la sección de miembros/espacios de la portada, se puede marcar ese bloque con `data-nosnippet`;
**no** se hace de entrada porque también le quita contexto a Google.

## Criterios de aceptación

- [x] El HTML de una noticia y de un evento tiene `og:title`, `og:description`, `og:image`
      absolutos con su propia imagen (test sobre `generateMetadata` + verificación con un
      depurador de Open Graph sobre el deploy de preview).
- [x] Ninguna página pública usa el escudo municipal como `og:image`.
- [x] La portada tiene una meta descripción propia; `robots.txt` y `sitemap.xml` responden.
- [x] `public-cache.test.ts` sigue verde (el layout raíz no lee el pedido).
- [ ] Los eventos privados no aparecen en el sitemap y su formulario es `noindex` (milestone 43).

## Registro

Implementado el 2026-11-25.

- `src/lib/seo/metadata.ts`: `siteUrl()`/`absoluteUrl()`, `DEFAULT_DESCRIPTION`, `DEFAULT_OG_IMAGE`,
  `toMetaDescription()`, `pageMetadata()`, `organizationJsonLd()` y `jsonLdScript()` (escapa `<`
  para que un texto de la base no cierre el `<script>`). Tests en `metadata.test.ts`.
- **Descripción por defecto** (139 caracteres): «Polo Tecnológico de Concepción del Uruguay:
  coworking, laboratorio y salas para reservar, eventos y formación en economía del conocimiento.»
  — para que el usuario la ajuste si quiere; vive en una constante.
- **Cambio frente al diseño — imagen por defecto:** en lugar de `opengraph-image.tsx` (generada en el
  servidor) es un **PNG estático** `public/og-default.png` generado una vez con
  `scripts/og-default.mjs` (Playwright, isologo en una píldora clara sobre el degradé de marca). Es
  más simple, no gasta servidor y no depende de cómo Next hereda las imágenes de archivo entre
  segmentos. Por lo mismo, una **noticia sin portada** usa la imagen de marca y no una generada con
  su patrón (las portadas son obligatorias desde el milestone 15; solo las viejas no tienen).
- `metadataBase`, `title.template` («%s · La Nube») y la vista previa por defecto en el layout raíz;
  los títulos de las páginas perdieron su sufijo a mano («| La Nube», «— La Nube»).
- `generateMetadata` nuevo en `/events/[id]` y `/forms/[slug]` (este con `cache()` de React para no
  leer dos veces); `summary` se sumó a `PublicEventDetail` y `PublicFormView`. Metadatos propios en
  portada, Quiénes somos, Espacios, Noticias, Novedades y Políticas.
- `robots.ts` y `sitemap.ts` (lectura cacheada `getPublicSitemapEntries`, tags de noticias y
  eventos; `src/lib/db/sitemap.ts`). JSON-LD `Organization` en la portada, desde la configuración
  del sitio, fuera del contenedor de franjas.
- `NEXT_PUBLIC_SITE_URL`: `env.example`, build-arg en `deploy/Dockerfile`, variable del repo en
  `.github/workflows/deploy.yml` y `deploy/README.md` §5. **Hay que crear la variable en GitHub
  antes del próximo deploy** (sin ella cae en `NEXTAUTH_URL`).
- Verificado contra el servidor local: portada, noticia y evento con `og:*` absolutos, `robots.txt`
  y `sitemap.xml`. Next 15 transmite la metadata de las páginas dinámicas al final del `<body>` para
  navegadores y en el `<head>` para bots (detecta su user agent), así que los depuradores de Open
  Graph la ven.
- Pendiente en producción: pedir la reindexación en Search Console; si Google sigue armando el
  fragmento con la sección de miembros, evaluar `data-nosnippet` (no se hizo).
- Los eventos privados (sitemap, `noindex`) llegan con el milestone 43.
