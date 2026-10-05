# Milestone 15 — Rediseño visual de Noticias (listado y detalle)

> **Estado: implementado (2026-10-02)** en la rama `preview`, en commits sin firmar (el
> usuario los rebasea y firma después de revisar):
>
> 1. `feat(noticias): tiempo de lectura, portada generada por slug, fecha larga y escala de lectura en Markdown`
> 2. `feat(noticias): listado con nota principal, tarjetas más vivas y filtros livianos`
> 3. `feat(noticias): el detalle se lee como artículo — encabezado con copete y byline, riel compacto y cierre`
> 4. Segunda ronda, tras la revisión del usuario (ver "Revisión del usuario"): la nota
>    principal alinea su pie con la grilla, y la línea con degradé del detalle se reemplaza
>    por un progreso de lectura real.
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
  lado y título `text-2xl`/`lg:text-3xl` + resumen al otro; en teléfono se apila. El texto
  va **arriba** (no centrado) y el pie "N min de lectura · Leer nota →" anclado abajo, con
  el mismo padding inferior que `NewsCard` (`p-5`, con `lg:px-8 lg:pt-8`), así queda a la
  misma altura que el "Leer" de la tarjeta vecina en la fila. Cuál es
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
  página y todo vive adentro, en una columna de lectura `max-w-3xl` **alineada a la izquierda**
  (2026-10-05: antes `max-w-2xl` centrada con `mx-auto`, lo que dejaba un hueco enorme a la
  izquierda; ahora comparte borde con la portada y el footer):
  1. **Kicker como ruta**: `~/ noticias / 2026 / 09▌` — "noticias" es link al listado; es
     el único kicker de la pantalla, con el cursor que parpadea.
  2. Título `text-3xl`/`sm:text-5xl`, `leading-[1.1]`, `text-balance`.
  3. **Copete**: el `summary` en `text-lg`/`sm:text-xl` gris.
  4. **Byline** tras un divisor: avatar con iniciales, autor, y en mono "25 de septiembre de
     2026 · N min de lectura".
- Portada a todo el ancho de la tarjeta; sin portada, un hairline (`<hr>`) separa
  encabezado y cuerpo (en el detalle **no** se usa la portada generada: un artículo sin
  imagen no necesita una ilustración grande inventada). En la primera ronda era una línea
  de 4px con el degradé de marca; se quitó porque se leía como una barra de progreso que no
  avanzaba (ver "Revisión del usuario").
- **Progreso de lectura** (`ReadingProgress`, `templates/landing/news/reading-progress.tsx`):
  píldora flotante abajo con el porcentaje leído, una barra **sólida** (sin degradé:
  `la-nube-selected` / `la-nube-secondary` en oscuro) y "quedan N min" ("terminaste" al
  final). Mide sobre el **cuerpo** (`#news-body`), no sobre la página: 0% cuando el inicio
  del cuerpo llega al borde superior de la ventana, 100% cuando su final llega al borde
  inferior. Aparece cuando el cuerpo ya ocupa la mitad superior de la ventana y desaparece
  (fade + desplazamiento, sin animación con `prefers-reduced-motion`) cuando su final sube
  por encima del tercio inferior; si el cuerpo entra entero en la ventana nunca aparece. Un
  cálculo por frame (`requestAnimationFrame`), listeners `passive`. Es
  `pointer-events-none` (no tapa clics) y la barra es un `role="progressbar"` con
  `aria-valuenow`. Posición: en teléfonos se estira entre el borde izquierdo y el botón de
  WhatsApp (`left-4 right-22`), desde `sm` va centrada. Fondo `bg-card` en claro y
  `bg-background` (Night Station) en oscuro — con `bg-card` se fundía con la tarjeta del
  artículo — más un borde `la-nube-primary/40` y la sombra azul.
  - **Se renderiza con un portal en `document.body`.** Dentro del árbol de la página, un
    ancestro del layout público se vuelve el bloque contenedor de los `position: fixed`
    (verificado en el navegador: la píldora quedaba en `y=1803` con la ventana en 900px,
    es decir anclada al final del contenido); el portal la saca de ese contexto. No se
    identificó qué propiedad del ancestro lo causa — las candidatas habituales
    (`transform`, `filter`, `will-change`, `contain`) dieron `none` en toda la cadena —; el
    portal lo resuelve sin depender de eso. **Cualquier otro elemento `fixed` dentro de
    `(public)` puede tener el mismo problema.**
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

1. **Nota principal con resumen corto** (revertido después): el pie anclado abajo dejaba
   un hueco entre el resumen y "Leer nota", así que se probó centrar todo el texto y no
   anclar el pie. El usuario lo rechazó (ver abajo) y se volvió al pie anclado.
2. **Títulos del cuerpo**: los títulos se emiten un nivel más abajo (F2.9 de
   milestone-10), así que el `##` que usan los autores para secciones llega como `<h3>`;
   con el cuerpo en `text-lg`, un `text-xl` casi no se distinguía. Escala final en lectura:
   h2 `text-3xl`, h3 `text-2xl`, h4 `text-xl`, h5 `text-lg`.

## Revisión del usuario (2026-10-02, segunda ronda)

1. **"Leer nota" desalineado** entre la nota principal y la tarjeta vecina, y el texto de
   la principal centrado verticalmente. Lo correcto: texto arriba y pie abajo, alineado con
   la fila. Se quitó la opción `anchored` de `CardFooter` (todas las tarjetas anclan el pie)
   y se igualó el padding inferior (ver "Listado").
2. **"La barra de progreso con degradé no funciona"**: el usuario interpretó la línea de 4px
   con degradé (un separador estático) como una barra de progreso — no seguía el scroll ni
   cambiaba. Sugirió quitarla o poner una barra normal (sin degradé), flotante abajo, con
   porcentaje; dejó la decisión a criterio. Decisión: **ambas cosas** — el separador pasa a
   hairline (nada que se parezca a un indicador) y se agrega `ReadingProgress` (ver
   "Detalle"), con porcentaje **y** minutos restantes, que es la información más útil para
   decidir si seguir leyendo. Se descartaron una barra fina pegada al borde superior
   (compite con el header flotante) y una barra de ancho completo abajo (choca con el botón
   de WhatsApp en teléfonos).

## Propuesto y no hecho (el usuario no los eligió)

- Botones de compartir (copiar link / WhatsApp) bajo el byline.
- Separadores por mes en el listado (`── septiembre 2026 ──`).
- (La "barra de progreso con el degradé de marca" de la propuesta original terminó hecha,
  sin degradé, como `ReadingProgress` — ver "Revisión del usuario".)

## Fuera de alcance / notas

- El botón flotante de WhatsApp tapa a veces el "Leer" de una tarjeta en teléfono: es
  previo a este milestone y afecta a todo el sitio público.
- `LandingCard` sigue con su `hover:shadow-md` gris para los eventos; aplicarle la Blue
  Shadow Rule a todo el landing es un cambio aparte.

## Revisión 2026-10-05: columna a la izquierda y progreso en las políticas

- La columna de lectura del detalle (encabezado, cuerpo y footer) ya no se centra: es
  `max-w-3xl` pegada al borde izquierdo de la tarjeta. Centrada, sobraba mucho espacio a la
  izquierda y el texto se sentía flotando.
- `ReadingProgress` (porcentaje + barra + "quedan N min") también se usa en las políticas:
  `PolicyDocument` calcula `readingMinutes()` del markdown fuente (`readPolicyMarkdown`) y mide
  sobre `#politica`; además muestra "N min de lectura" junto a la fecha de vigencia. Si el
  archivo no se puede leer, no se muestra ni el tiempo ni la píldora.
