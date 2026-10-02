# Milestone 17 — Experimento de marca y estilo del sitio público

**Estado:** implementado como **experimento** (2026-10-02) en la rama `experimental` (sale de
`preview` en `9bfe403`). No está mergeado: la idea es mirarlo, decidir qué queda y qué no, y
recién ahí llevarlo a `preview`.
**Tipo:** diseño / marca. Sin cambios de modelo, migraciones ni API.

## Pedido

Textual del usuario (2026-10-02), resumido:

1. Mirar la landing y sus secciones, y las demás páginas públicas (espacios, sección y página
   de un evento, "Quiénes somos", política de privacidad) y dar ideas para mejorar el diseño:
   "lo veo muy desnudo… muy soso" (aclarando que no sabe de diseño).
2. Una idea concreta, opcional: usar el **logo** en una animación del hero — los nodos llegan
   volando desde los bordes de la pantalla, giran como atraídos por gravedad, un destello, el
   logo, y después aparece el texto. Si la idea no sirve, al menos considerar animaciones o
   efectos como parallax, teniendo en cuenta que el **fondo de partículas ya es parte de la
   marca**.

Primero se hizo un relevamiento con capturas (escritorio 1440 y teléfono 390) y se le pasó al
usuario un diagnóstico y una lista de propuestas (ver "Diagnóstico"). Su respuesta:

- **Las tres filas de logos (Miembros / Socios / Aliados) se quedan.** Fue un requerimiento
  "de arriba"; coincide en que conviene unificarlas pero por ahora no se tocan.
- **Fechas en inglés en la página del evento: no.** "Todo tiene que estar en español."
- **Imágenes de eventos:** localmente pueden faltar porque los eventos se crearon antes de que
  la imagen fuera obligatoria; no preocuparse.
- Con todo lo demás, de acuerdo. **Hacerlo en una rama aparte (`experimental`)** y
  **documentarlo como un experimento de estilo/marca/UI**.

## Diagnóstico (lo que se le presentó al usuario)

Por qué se sentía soso:

1. **Todas las secciones de la landing tenían la misma forma** (eyebrow `~/ algo` → título con
   la última palabra en degradé → bajada gris → fila de tarjetas), seis veces seguidas. Sin
   jerarquía: nada se destacaba porque todo pesaba igual.
2. **No había fotografía arriba.** El hero era texto sobre partículas; las fotos de los
   espacios (que son buenas) aparecían recién en `/spaces`.
3. **Color tímido.** Títulos gris oscuro (`--foreground: #424242`), fondo azul lavado, botones
   primarios negros (el `--primary` neutro de shadcn). El azul y el cian de la marca sólo
   aparecían en las palabras en degradé. El footer cambiaba a casi negro (`slate-950`), sin
   relación con el resto.
4. **Tres secciones de logos idénticas** (miembros/socios/aliados) — _se mantienen por
   requerimiento_ (ver arriba).

Por página: el hero no tenía elemento visual y en teléfono **no mostraba el logo** (sólo el
botón de menú); en `/spaces` el nombre de cada espacio flotaba sobre la foto tapando lo que
mostraba y las FAQ eran bloques grises pesados; la página del evento mostraba **fechas en
inglés** con navegador en inglés, no mostraba la portada (en local), listaba trece cajas
iguales a todo el ancho y el "Inscripción cerrada" era un recuadro punteado que se cortaba;
"Quiénes somos" tenía buen contenido pero la leyenda del logo era sólo texto; la política de
privacidad era un muro de texto a todo el ancho, sin índice ni fecha.

## Qué se hizo

### 1. Tokens y piezas compartidas

- **Colores nuevos** en `@theme` (`src/app/globals.css`): `--color-la-nube-ink: #0e2a47` (azul
  noche para títulos públicos en modo claro) y `--color-la-nube-night: #0a1a2e` (fondo de las
  franjas oscuras y del footer). Derivados del `#1c62a3` del logo. Contraste: blanco sobre
  `night` ≈ 17:1; `ink` sobre `--background` ≈ 12:1.
  - **No** se tocaron `--foreground` ni `--primary` globales: cambiarían todo el admin. El
    experimento se limita al sitio público aplicando las clases nuevas donde corresponde.
    Si el experimento se adopta, evaluar si el admin también quiere el azul de marca.
  - `contrast.test.ts` no cubre estos dos colores (lee sólo los tokens de `:root`/`.dark`).
- **Variante de botón `brand`** (`src/components/ui/button.tsx`): azul de marca
  (`la-nube-selected`, blanco 6.38:1) con sombra suave; en oscuro, cian con texto noche. Se usa
  en las acciones principales del sitio público: "Reservar un espacio", "Iniciar sesión" /
  "Ir a mi perfil" del header, "Inscribirme" (`RegistrationCta`), "Reservar este espacio".
- **`SectionHeading`** (`src/components/templates/landing/shared/section-heading.tsx`): el
  encabezado `~/ eyebrow▌` + título + palabra en degradé + bajada + acción opcional, antes
  copiado a mano en cada sección con pequeñas diferencias. Títulos en `la-nube-ink`;
  `tone="inverse"` para franjas oscuras; `as="h1"` para cabeceras de página. Lo usan las
  secciones de la landing, `/spaces`, "Quiénes somos" (vía su `SectionHeader` local, que ahora
  delega) y la política de privacidad.
- **`Reveal`** (`src/components/molecules/reveal.tsx`): aparición suave al entrar en pantalla
  (sube 24px + fundido, una sola vez). Es el único efecto de scroll general, deliberadamente
  discreto porque las partículas ya se mueven. Respeta `prefers-reduced-motion`. **No se usa
  en el hero** (el HTML del servidor sale con `opacity: 0` hasta hidratar).
- **`ParallaxImage`** (`src/components/molecules/parallax-image.tsx`): foto que se desplaza
  ±6% dentro de su marco al hacer scroll (escalada 1.15 para no mostrar bordes). Sólo en fotos
  de contenido (`/spaces`, "Quiénes somos"). Quieta con `prefers-reduced-motion`.

### 2. Hero con el logo animado (la idea del usuario)

`AnimatedIsologo` (`src/components/atoms/logos/lanube/animated-isologo.tsx`) redibuja el
isologo oficial (grupo `ISOLOGO` de `LogoLaNube`: 3 trazos, 10 conectores, 8 nodos) pieza por
pieza con framer-motion (ya era dependencia). Coreografía `"fly"` (hero), ~2.4 s:

1. **0–1.25 s** — los 8 nodos llegan desde ~900 unidades fuera del logo (fuera de pantalla),
   desde ángulos repartidos alrededor, en espiral (punto intermedio girado ~50° y mucho más
   cerca), **acelerando al acercarse** (`easeIn`, la "gravedad") y con un mínimo rebote al
   llegar. Trayectorias determinísticas (sin `Math.random`).
2. **1.1 s** — **destello** radial blanco→cian desde el centro de la nube y una **onda** cian
   que se expande (`vector-effect: non-scaling-stroke` para que el trazo no engorde).
3. **1.25 s** — los tres trazos de la nube se dibujan (`pathLength`), uno tras otro; **1.6 s**
   los conectores.
4. **1.75 s** — aparece el texto (eyebrow + "La Nube" + typewriter, bajada, botones),
   escalonado.

Reglas para que no moleste (acordadas en la propuesta):

- **Una vez por sesión** (`sessionStorage["lanube-hero-intro-seen"]`): volver al inicio o
  recargar muestra el hero ya armado (fundido de 0.25 s).
- **`prefers-reduced-motion`** → logo terminado, sin animación.
- **El texto está en el DOM desde el principio** (SEO y lectores de pantalla); sólo se anima
  su opacidad. Sin JS, un `<noscript><style>` lo muestra.
- `overflow-x: clip` en el hero: los nodos que vuelan desde afuera no generan scroll lateral.
- Detalles de fidelidad: los anillos blancos de los nodos y los trazos blancos que "cortan" la
  nube se pintan con `var(--background)`, así se leen como huecos también en modo oscuro (en
  `#fff` aparecían como bandas blancas). Los círculos venían con `translate+rotate` de
  Illustrator; rotar un círculo sobre su centro no lo mueve, así que se usan `cx/cy` directos.
- **Bug encontrado al probar:** en `npm run dev` la intro no se veía nunca — el StrictMode
  corre el efecto dos veces; la primera marcaba la sesión como vista y la segunda saltaba al
  final. Se resolvió decidiendo una sola vez por montaje con una `ref`.

Layout del hero: dos columnas desde `lg` (texto a la izquierda, logo a la derecha, ~26rem);
en teléfono el logo va arriba (w-40/52) y el texto centrado debajo. "La Nube" más grande y en
azul noche; "Conocer más" pasó a "Conocer los espacios" (es adonde lleva).

### 3. Ritmo de la landing

Orden nuevo: Hero → Próximos eventos → **La Nube en números** → Noticias → Espacios →
Miembros → Socios → Aliados → **Cierre ("¿Querés ser parte de La Nube?")**.

- **Eventos:** si no hay ningún destacado, el próximo evento se muestra con la tarjeta grande
  (`FeaturedEventCard badge={false}`: sin la etiqueta "Destacado", porque no lo es) y el resto
  en el carril. Antes, con un solo evento, quedaba una tarjeta chica sola en una esquina.
- **`StatsBand`** (`src/components/templates/landing/stats/`): franja azul noche a todo el
  ancho con dos resplandores radiales, cifras grandes en cian que **cuentan desde 0** al
  entrar en pantalla (`CountUp`; el HTML del servidor trae el valor final). Las cifras se
  movieron a `src/lib/constants/ecosystem-stats.ts` porque ahora las comparten la landing y
  "Quiénes somos".
- **Espacios:** grilla de fotos (4 columnas en `lg`, 2 en `sm`) con nombre, capacidad,
  descripción y "Conocer el espacio →" sobre un degradé oscuro; zoom suave al pasar el mouse.
  Cada tarjeta lleva a `/spaces#<slug>`. Reemplaza a `SpaceCard`/`SpacesList`/
  `SpaceImagePanel` (borrados). **Bug corregido de paso:** esas tarjetas enlazaban a
  `/user/<slug>`, ruta que no existe (la de reservas es `/user/spaces/<slug>`).
- **Logos:** sólo cambió el encabezado (el compartido). La bajada de Miembros decía "Conoce a
  los profesionales…" — los miembros son universidades; ahora dice "Conocé a las
  instituciones…" (voseo, como el resto del sitio). Se agregó punto final a las bajadas de
  Socios y Aliados.
- **Cierre** (`src/components/templates/landing/cta/`): panel con degradé azul de marca →
  azul noche (no al azul claro: el texto blanco necesita ≥ 4.5:1), resplandor cian y retícula
  de puntos; botones "Reservar un espacio" y "Escribinos" (`mailto:` al correo de
  `getSiteConfig`, el mismo del footer).
- **Footer:** `bg-la-nube-night` con borde superior sutil (antes `slate-950`); los títulos de
  columna pasaron a mono en cian, como los eyebrows.
- **Header en teléfono:** ahora muestra el logo (enlace al inicio) a la izquierda del botón de
  menú; ambos en píldoras translúcidas. El botón de menú ganó `aria-label`.
- Noticias y espacios entran con `Reveal` escalonado.

### 4. Página de un evento (`/events/[id]`)

- **Fechas en español, en todo el sitio.** `LocalDate`/`LocalDateTime`/`LocalTimestamp`
  (`src/components/molecules/local-date.tsx`) formateaban con `undefined` (el idioma del
  navegador): con el navegador en inglés salía "Mon, Apr 13, 2026, 10:00 AM". Ahora el idioma
  es fijo `es-AR`; **la zona horaria sigue siendo la del visitante**. También reloj de 24 h
  (`hourCycle: "h23"`; es-AR daba "10:00 a. m. – 01:00 p. m."). Se corrigieron además los
  `toLocaleDateString()`/`toLocaleTimeString()` sin argumentos del área de gestión
  (check-in, dashboard admin, incidentes, ajustes de usuario, `ReservationInfo`,
  `ReservationCard`).
- **Dos columnas desde `lg`:** contenido (portada, título grande en azul noche, descripción,
  sesiones) + **ficha fija** a la derecha: Tipo, Horario ("Lunes y jueves · 10:00 – 13:00"),
  Fechas ("Del 13 abr al 25 may 2026 · 13 sesiones", con canceladas si hay), Lugar, y el
  bloque de inscripción. En teléfono la ficha va entre el título y la descripción
  (`EventHero` ganó `size="page"` y `afterTitle`; los formularios públicos siguen igual).
- **Bloque de inscripción** con estado explícito: punto de color + título ("Inscripciones
  abiertas" / "próximamente" / "Inscripción cerrada" / "Sin inscripción online") y, si está
  cerrada, el porqué. El recuadro punteado de `RegistrationCta` (que sigue en las tarjetas
  chicas) ganó padding horizontal y ya no se corta.
- **Sesiones:** una tarjeta con renglones divididos (no una caja por fecha), que muestra las
  próximas 4 desde la próxima a dictarse (o las últimas 4 si el evento terminó) y despliega
  todas con "Ver todas las sesiones (N)". Mantiene "Próxima", "Cancelada", "Reprogramada" y
  el motivo.
- El resumen lo calcula `summarizeSchedule()` (`src/lib/events/schedule-summary.ts`, puro y
  testeado en `schedule-summary.test.ts`): agrupa por franja horaria, ordena los días de lunes a
  domingo, une en castellano ("lunes, martes y jueves"), no cuenta canceladas y repite el año
  sólo si cambia. Se arma con `formatToParts` porque es-AR con año intercala "de" ("13 de abr
  de 2026"). En la página se calcula en el cliente (zona del visitante), como `LocalDate`.
- `Fact` vive en `event-fact.tsx` **sin** `"use client"`: la página (servidor) le pasa íconos
  de lucide, que no se pueden serializar hacia un Client Component.

### 5. Espacios (`/spaces`)

Cada espacio es una sección con `id={slug}` (destino de las tarjetas de la landing): foto
grande con parallax de un lado (alternando lados en escritorio) y del otro el nombre (ya no
encima de la foto), chips de capacidad y equipamiento (`Space.metadata`), la descripción y
**"Reservar este espacio"** (→ `/user/spaces/<slug>`, sólo si `isReservable`). Las FAQ quedan
debajo como renglones livianos sobre una tarjeta translúcida, en vez del bloque gris.

### 6. "Quiénes somos" (`/about`)

- Títulos en azul noche (encabezado compartido).
- "La Nube en números" usa la misma `StatsBand` de la landing (antes, tiles propios).
- **"La leyenda del logo"** ahora tiene el isologo al lado del relato, que **se dibuja solo al
  entrar en pantalla en el orden del texto** (coreografía `"draw"` vía `IsologoInView`: los
  tres trazos uno por vez, después los conectores y por último "llegaron los nodos").
  Deliberadamente **no** se etiqueta qué trazo es el Estado, la Academia o la Industria: la
  leyenda no lo dice y no se inventó.
- La foto del coworking usa `ParallaxImage`.

### 7. Política de privacidad (`/policies/privacy`)

- Encabezado compartido ("Política de privacidad") + **"Última actualización: 16 de noviembre
  de 2025"** — la fecha del último commit que cambió `src/assets/policies/privacy.mdx`. La
  política misma promete publicar cambios "con indicación de su fecha de actualización"
  (sección 12), así que la constante `LAST_UPDATED` de la página **hay que actualizarla cuando
  cambie el texto**.
- Columna de lectura de ~70 caracteres, en una tarjeta translúcida; el `<h1>` del MDX se omite
  (lo reemplaza el encabezado) y cada `<h2>` recibe un `id` derivado del texto.
- **Índice fijo** a la izquierda (sólo `lg`), armado leyendo los `h2[id]` del DOM (no se
  desincroniza del MDX) y marcando la sección en lectura según el scroll. Un primer intento
  con `IntersectionObserver` quedaba trabado en la última sección al volver arriba de golpe.
- La página pasó a Server Component (exporta `metadata`); el MDX se renderiza en
  `PolicyContent` (cliente), porque `@next/mdx` sin `mdx-components.tsx` usa un contexto de
  React.

## Cómo se verificó

- `npx tsc --noEmit`, `npm run lint`, `npm run format`, `npm test` (373 tests, incluidos los 7
  nuevos de `schedule-summary`).
- Capturas con Playwright (escritorio 1440 claro/oscuro, teléfono 390) de landing, eventos,
  espacios, "Quiénes somos" y privacidad, con medición de scroll horizontal (0 en todas). La
  intro se verificó cuadro a cuadro (0.1 → 2.2 s) — los nodos llegan, destello, trazos, texto.
  Las capturas usan `locale: "en-US"` a propósito, para comprobar que las fechas salen en
  español igual.
- Los scripts de captura quedaron fuera del repo (scratchpad de la sesión); para cambios de
  layout sigue valiendo `node scripts/mobile-shots.mjs`.

## Descartado / pendiente

- **Unificar Miembros/Socios/Aliados** en una sola sección "Ecosistema" (con logos en gris que
  toman color al pasar el mouse): propuesto, **bloqueado por requerimiento** — las tres filas
  se quedan por ahora.
- **No** se aplicó el azul de marca al admin (`--primary` global) ni se cambió `--foreground`:
  fuera del alcance de un experimento del sitio público.
- **No** se extendió `contrast.test.ts` a `la-nube-ink`/`la-nube-night` (el test lee sólo
  tokens semánticos de `:root`/`.dark`). Si se adoptan como tokens semánticos, sumarlos.
- `SignIn` del header envuelve un `<Button>` en un `<Link>` (interactivo dentro de
  interactivo); es previo a este milestone y no se tocó.
- `Breakout` usa `w-dvw` (incluye el ancho de la barra de scroll en escritorio); previo, sin
  efecto visible en las capturas.
- Parallax pesado o efectos ligados al scroll en toda la página: descartados a propósito
  (competirían con las partículas).

## Para decidir antes de mergear

1. ¿Queda el azul noche para títulos y footer? ¿Se lleva también al admin?
2. ¿La intro del hero se ve bien en los dispositivos reales del equipo? (Duración ~2.4 s, una
   vez por sesión.)
3. Confirmar la fecha de "Última actualización" de la política (16/11/2025, tomada de git).
4. El cambio de copy en la bajada de Miembros ("instituciones" en vez de "profesionales").

## Archivos

Nuevos: `atoms/logos/lanube/animated-isologo.tsx`, `atoms/logos/lanube/isologo-in-view.tsx`,
`molecules/reveal.tsx`, `molecules/parallax-image.tsx`,
`templates/landing/shared/section-heading.tsx`, `templates/landing/stats/{index,count-up}.tsx`,
`templates/landing/cta/index.tsx`, `lib/constants/ecosystem-stats.ts`,
`lib/events/schedule-summary{,.test}.ts`,
`app/(public)/events/[id]/{event-schedule,event-fact}.tsx`,
`app/(public)/policies/privacy/{table-of-contents,policy-content}.tsx`.

Borrados: `templates/landing/spaces/spaces-list.tsx`, `templates/landing/spaces/space-card/`.

Modificados: `globals.css`, `ui/button.tsx`, `molecules/local-date.tsx`,
`molecules/registration-cta.tsx`, `organisms/forms/event-hero.tsx`, el header (escritorio,
móvil, `signin`) y el footer públicos, todas las secciones de la landing, `app/(public)/page.tsx`,
`about`, `spaces`, `events/[id]`, `policies/privacy`, y los seis archivos de gestión con
fechas sin locale.
