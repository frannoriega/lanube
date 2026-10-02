# Milestone 15 — Rediseño visual de Noticias (listado y detalle)

> **Estado: implementado (2026-10-02)** en la rama `preview`, en tres commits sin firmar
> (el usuario los rebasea y firma después de revisar):
>
> 1. `feat(noticias): tiempo de lectura, portada generada por slug, fecha larga y escala de lectura en Markdown`
> 2. `feat(noticias): listado con nota principal, tarjetas más vivas y filtros livianos`
> 3. `feat(noticias): el detalle se lee como artículo — encabezado con copete y byline, riel compacto y cierre`
>
> Un milestone de **diseño**: no cambia el modelo, ni las consultas, ni las rutas.

## Caso de uso

El usuario pidió revisar `/news` (listado) y `/news/[yyyy]/[mm]/[dd]/[slug]` (detalle)
porque se veían "sosos, sin vida", con la condición (negociable) de **mantener los
layouts**: grilla en el listado, artículo + riel lateral en el detalle.

## Método

1. Lectura del código de ambas páginas y sus componentes (`NewsCard`, `NewsFilters`,
   `LandingCard`, `Markdown`, `LocalDate`).
2. Capturas con Playwright del estado anterior (escritorio claro/oscuro y teléfono 390px).
3. Propuesta escrita al usuario (diagnóstico + cambios + pushback + extras opcionales);
   el usuario la aprobó completa y **no eligió ninguno de los extras**.
4. Antes de escribir código visual se leyó `DESIGN.md`; sus reglas condicionaron varias
   decisiones (ver abajo).
5. Para juzgar el resultado con contenido realista se insertaron **temporalmente** 7
   notas de prueba en la base local (ids `tmpdemo-1`…`tmpdemo-7`: con y sin portada,
   cuerpos cortos y largos), se capturó en escritorio/tablet 820/teléfono 390, claro y
   oscuro, más una búsqueda, y se **borraron** al terminar. Ninguna captura mostró
   overflow horizontal a nivel de página.
6. Dos ajustes salieron de esa revisión visual (ver "Iteraciones").

## Diagnóstico (estado anterior)

El problema no era el layout sino que **todo tenía el mismo tratamiento** — tarjeta
blanca redondeada con borde fino sobre fondo pálido — así que nada guiaba la vista.

**Listado**

- Sin jerarquía: la nota destacada solo tenía un anillo tenue y un chip; mismo tamaño
  que el resto.
- Las notas sin portada mostraban un recuadro gris con un ícono de diario al 40%: se leía
  como "la imagen no cargó".
- La barra de filtros era un formulario con recuadro y etiquetas, con tanto peso visual
  como las notas.
- Las tarjetas no invitaban al clic: solo un leve desplazamiento en hover.

**Detalle**

- La tira de autor era una tarjeta aparte, con el mismo peso que el artículo: la página se
  leía como una pila de cajas.
- El cuerpo usaba `text-sm` (la escala de `Markdown`, pensada para descripciones de
  eventos) debajo de un título `text-4xl`: salto brusco e incómodo para leer.
- `post.summary` existía y **nunca se mostraba** en el detalle.
- El riel "Otras noticias" apilaba `NewsCard` completas con imágenes grandes y un título
  en su propia tarjeta: competía con el artículo.

### Hallazgo descartado

En la propuesta se señaló que la fecha del detalle aparecía como `09/25/2026` (orden
estadounidense) y se la llamó bug. **No lo era**: `LocalDate` formatea con el locale del
navegador, y la captura se tomó con Playwright en `en-US`. Con `es-AR` sale `25/09/2026`.
Igual se cambió el byline a fecha larga (ver abajo), por legibilidad, no por corrección.

## Diseño implementado

### Piezas base (commit 1)

- **`readingMinutes(markdown)`** (`src/lib/news/reading-time.ts`, con tests): minutos
  estimados a 200 palabras/minuto, redondeado, mínimo 1. Descarta bloques de código e
  imágenes, de los links cuenta solo el texto, y una "palabra" es un token con al menos
  una letra o número (los `#`, `-`, `>` sueltos no suman). Se calcula al renderizar en el
  servidor — **sin columna en la base**, así nunca se desfasa del cuerpo.
- **`coverPattern(slug)`** (`src/lib/news/cover-pattern.ts`, con tests) + **`NewsCover`**
  (`templates/landing/news/news-cover.tsx`): portada generada para notas sin imagen — uno
  de 4 degradés de marca más una "red de nodos" (11 nodos, cada uno unido a sus 2 vecinos
  más cercanos), el mismo motivo que el fondo del sitio. Es **determinística por slug**
  (hash FNV-1a + PRNG mulberry32, sin `Math.random`): la misma nota se ve igual en el
  listado, el landing y el riel, renderiza idéntico en servidor y cliente, y dos notas
  distintas casi nunca coinciden. Los degradés respetan la "Signal Cyan Rule" (el cyan
  nunca va solo); uno usa Night Station para dar contraste entre tarjetas vecinas. Es
  decorativa (`aria-hidden`). `zoomOnHover` escala la portada cuando el `group` ancestro
  está en hover o tiene el foco (respeta `prefers-reduced-motion`).
- **`LocalDate format="long"`**: "25 de septiembre de 2026" en es-AR, para bylines.
- **`Markdown size="reading"`**: cuerpo `text-base` / `sm:text-lg`, interlineado 1.75,
  `text-pretty`, más aire entre bloques; títulos con jerarquía marcada y sin el borde
  estilo GitHub; cita como bloque tintado (`la-nube-accent/40`, `la-nube-selected/20` en
  oscuro) en lugar de la franja lateral; imágenes con más margen. Las clases van después
  de las base y `cn`/tailwind-merge resuelve los choques. El tamaño `default` no cambió, así
  que las descripciones de eventos y los previews del editor se ven igual.

### Listado `/news` (commit 2)

- **Nota principal** (`NewsLeadCard`): la primera nota de la **página 1** ocupa 2
  columnas (`sm:col-span-2`: fila completa en 2 columnas, 2/3 en `lg`), portada al 55% a un
  lado y título `text-2xl`/`lg:text-3xl` + resumen al otro; en teléfono se apila. Cuál es
  la primera lo decide la consulta existente (destacada → más reciente, o mejor
  coincidencia si hay búsqueda). **No** hay principal en páginas siguientes (no significa
  nada en la página 3) ni cuando hay una sola nota (no hay grilla que encabezar).
- **`NewsCard`**: fecha como chip mono sobre la portada (arriba a la izquierda),
  "Destacada" arriba a la derecha, zoom de portada en hover/foco, título que toma el color
  de marca en hover, y un pie mono con "N min de lectura" y "Leer →" (la flecha avanza en
  hover). El "Leer" está **siempre visible**: en touch no hay hover. La sombra de hover es
  azul (`rgba(78,135,194,0.3)`, "Blue Shadow Rule" del DESIGN.md) en lugar del
  `shadow-md` gris de `LandingCard`. El badge pasó de "Destacado" a **"Destacada"**
  (concuerda con "noticia"/"nota").
- **`toNewsCardData(post)`**: proyección `NewsPost → NewsCardData` (incluye el tiempo de
  lectura y el fallback `publishedAt ?? createdAt`), que antes se repetía a mano en el
  listado, el landing y el detalle.
- **Filtros**: búsqueda y rango de fechas como píldoras (`rounded-full`, `h-10`) en la
  misma fila que el título — a la derecha en `lg`, debajo en pantallas chicas — sin
  recuadro ni etiquetas visibles. Accesibilidad: `role="search"`, `Label` `sr-only` para el
  input (`type="search"`), y el picker conserva su `ariaLabel`.
- **Contador** mono encima de la grilla ("9 noticias" / "2 resultados" con filtros), con
  `aria-live="polite"`.
- **Estado vacío** como bloque punteado con el contador en mono ("0 resultados") y el
  mensaje.
- Se sumó el subtítulo "Novedades y anuncios de la comunidad de La Nube." (el mismo del
  landing) bajo el título.
- **Landing**: la sección "Últimas noticias" usa `NewsCard`, así que hereda las tarjetas
  nuevas; su layout (grilla de 3) **no** se tocó.

### Detalle (commit 3)

- **Se eliminó la tarjeta de autor separada.** El artículo es la única tarjeta de la
  página y todo vive adentro, en una columna de lectura centrada `max-w-2xl` (~65ch al
  tamaño del cuerpo, DESIGN.md "65–75ch"):
  1. **Kicker como ruta**: `~/ noticias / 2026 / 09▌` — "noticias" es link al listado; es
     el único kicker de la pantalla, con el cursor que parpadea.
  2. Título `text-3xl`/`sm:text-5xl`, `leading-[1.1]`, `text-balance`.
  3. **Copete**: el `summary` en `text-lg`/`sm:text-xl` gris.
  4. **Byline** tras un divisor: avatar con iniciales, autor, y en mono "25 de septiembre de
     2026 · N min de lectura".
- Portada a todo el ancho de la tarjeta; sin portada, una línea de 4px con el degradé de
  marca separa encabezado y cuerpo (en el detalle **no** se usa la portada generada: un
  artículo sin imagen no necesita una ilustración grande inventada).
- Cuerpo con `Markdown size="reading"`.
- **Pie del artículo**: "← Todas las noticias" y "Seguí leyendo → {título}" (la primera de
  las "otras noticias", es decir destacada/más reciente — no hay noción de "siguiente
  cronológica" en las consultas actuales y no hacía falta agregarla).
- **Riel**: título plano "Otras noticias" (no mono: el DESIGN.md permite un solo kicker por
  pantalla) y una `<ol>` de `NewsRailItem` — índice mono `01`…`04`, miniatura 64px
  (`NewsCover`, con la portada generada si no hay imagen), título en 2 líneas, fecha corta
  y minutos. Sigue siendo `sticky` en `lg`, y sigue desapareciendo si no hay otras notas.
- La tarjeta del artículo pasó de `rounded-2xl` con dos cajas a una sola; el `gap` entre
  columnas subió de 6 a 10; el padding lateral en teléfono bajó a `px-4`.

## Reglas del DESIGN.md aplicadas

- **Un kicker por pantalla** — por eso el riel no tiene `~/ otras noticias`.
- **Blue Shadow Rule** — sombra de hover teñida de azul en las tarjetas de noticias.
- **Mono = sistema**: fechas, tiempos de lectura, contador, índices del riel; nunca títulos
  ni resúmenes.
- **Nada de franja lateral** (`border-left` > 1px) — la cita del cuerpo pasó a bloque
  tintado.
- **Texto de marca** siempre `text-la-nube-selected dark:text-la-nube-secondary`.
- **Sin glassmorphism** fuera del header: el chip de fecha sobre la portada es `bg-card`
  sólido, no `backdrop-blur`.
- **Escala tipográfica**: el hook de diseño marcó un primer intento de cuerpo a
  `1.0625rem` como fuera de la escala; se corrigió a `text-lg` (1.125rem, el paso "title"
  documentado). No se agregó ningún `ignore`.
- El degradé del título "noticias" quedó como en el resto del sitio
  (`from-la-nube-primary to-la-nube-secondary`). La "Gradient Legibility Rule" sigue
  abierta a nivel sitio y no correspondía resolverla solo en esta página.

## Iteraciones tras la revisión visual

1. **Nota principal con resumen corto**: el pie anclado abajo (`mt-auto`) dejaba un hueco
   grande entre el resumen y "Leer nota". `CardFooter` ganó `anchored` (default `true` —
   en la grilla alinea los pies de una fila); la principal pasa `false` y su texto queda
   centrado como bloque.
2. **Títulos del cuerpo**: los títulos se emiten un nivel más abajo (F2.9 de
   milestone-10), así que el `##` que usan los autores para secciones llega como `<h3>`;
   con el cuerpo en `text-lg`, un `text-xl` casi no se distinguía. Escala final en lectura:
   h2 `text-3xl`, h3 `text-2xl`, h4 `text-xl`, h5 `text-lg`.

## Propuesto y no hecho (el usuario no los eligió)

- Botones de compartir (copiar link / WhatsApp) bajo el byline.
- Barra de progreso de lectura con el degradé de marca.
- Separadores por mes en el listado (`── septiembre 2026 ──`).

## Fuera de alcance / notas

- El botón flotante de WhatsApp tapa a veces el "Leer" de una tarjeta en teléfono: es
  previo a este milestone y afecta a todo el sitio público.
- `LandingCard` sigue con su `hover:shadow-md` gris para los eventos; aplicarle la Blue
  Shadow Rule a todo el landing es un cambio aparte.
