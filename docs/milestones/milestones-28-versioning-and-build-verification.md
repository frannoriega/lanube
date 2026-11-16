# Milestone 28 — Versionado, novedades y verificación del build

**Estado:** implementado (2026-11-16) en `preview`. Primera versión: **1.0.0**, el lanzamiento oficial.

## Caso de uso

1. El sistema llega a su versión estable y necesita un número de versión que **sepa el servidor**
   (no solo el repo) y que se vea en el sitio, en lugar de la insignia «Beta» del pie.
2. Una sección pública de **novedades** (changelog), enlazada desde el pie (no desde la barra), con
   una entrada por versión; el texto vive en archivos markdown, como las políticas. Una guarda tiene
   que impedir que se despliegue código nuevo sin subir la versión.
3. Una forma de saber si **el sitio en producción es el que se construyó desde el repositorio**, para
   poder detectar — y documentar — que la Municipalidad despliegue cambios propios sin publicarlos,
   en violación de la AGPL-3.0.

## Decisiones

### Semver, con significado para una app web

Se discutió CalVer (`2026.11.16`), la alternativa habitual para apps que se despliegan seguido. Se
eligió **semver** porque la app sí tiene consumidores con contrato: el conector MCP (asistentes de
terceros) y la API pública (`/api/version`, `/api/maintenance`, los formularios). El significado,
documentado en `src/lib/changelog/registry.ts`:

- **MAJOR**: obliga a alguien a cambiar lo que hace (se quita una función o una URL sin redirección,
  cambia de forma incompatible el contrato del MCP o de la API, hay que reaceptar o reconfigurar).
- **MINOR**: algo nuevo que se puede usar.
- **PATCH**: arreglos y cambios internos sin función nueva.

Sin prereleases (`-rc.1`): una versión existe cuando llega a producción. `semver.ts` solo acepta
`MAJOR.MINOR.PATCH`, y `isNextVersion()` exige que cada versión sea el **siguiente salto** de la
anterior (no se saltean números).

### Fuente de verdad: el registro en código

`src/lib/changelog/registry.ts` (`RELEASES`) es la lista de versiones; la actual es la última
(`APP_VERSION`). Módulo de datos puros: lo importan el pie, `/api/version`, el MCP y los tests.
`package.json` (y `package-lock.json`) repiten el número porque la imagen y las herramientas de
npm lo leen; `registry.test.ts` falla si no coinciden.

El texto largo de cada versión es `src/assets/changelog/<version>.md`: **markdown común**, que se
dibuja con el `Markdown` existente (react-markdown, sin HTML crudo). Se descartó copiar el esquema
MDX de las políticas: el MDX obliga a un `import` estático por archivo (`POLICY_CONTENT`) y a un
Client Component, y un changelog no lo necesita. Tampoco se exige inmutabilidad por hash como en
las políticas: corregir una errata en una entrada vieja es legítimo (y la guarda lo permite, ver
abajo); una política es un texto legal aceptado, un changelog no.

### Páginas: índice + una página por versión

- `/changelog`: línea de tiempo de la más nueva a la más vieja — un riel con un punto por versión
  (el de la actual, resaltado), el número (mono, grande) y la fecha a la izquierda en `sm+`, y una
  tarjeta con «Versión actual», título, resumen y «Ver los cambios» (toda la tarjeta es el enlace).
  En escritorio, a la derecha y fijo, el recuadro «Cómo leer los números»: qué significa que cambie
  cada uno de los tres números, en palabras de usuario (`VERSION_PARTS` en la página; la regla
  técnica sigue en `registry.ts`). En el teléfono va debajo de la lista.
- `/changelog/[version]`: el mismo armado que una política — volver al índice, encabezado
  `novedades · v1.0.0`, el resumen como copete, fecha de publicación, **tiempo de lectura** y
  «Versión actual»; abajo, el **índice fijo** a la izquierda en `lg` (`TableOfContents`, que desde
  este milestone recibe `targetId`/`selector`/`label`; las políticas siguen con sus valores por
  defecto) y el markdown en tarjeta (escala `reading`, `max-w-[75ch]`), y anterior/siguiente.
  Mientras se lee aparece la **píldora de progreso** (`ReadingProgress`, la de noticias y
  políticas), medida sobre `#cambios`.
- Los títulos del markdown llevan `id` derivado del texto: `Markdown` tiene la prop `headingIds`
  (apagada por defecto; solo para texto escrito en el repo, porque en contenido de usuarios dos
  títulos iguales darían `id` repetidos). Como `Markdown` baja un nivel cada título, los `##` del
  `.md` son `<h3>`, y eso es lo que lee el índice (`selector="h3[id]"`).
- Estáticas puras: `generateStaticParams` desde el registro y `dynamicParams = false` (una versión
  que no existe es 404 sin renderizar). Sin `revalidate`: nada depende del reloj ni de la base. Los
  `.md` igual viajan con el bundle (`outputFileTracingIncludes`) por si una página se regenera.
- La URL es en inglés (`/changelog`), como el resto de las rutas públicas; el texto visible dice
  «Novedades».

Se consideró una sola página con todas las versiones desplegadas (estilo GitHub Releases). Se
mantuvo la propuesta del usuario (índice + detalle) porque con el tiempo el índice se vuelve largo, y
cada versión con URL propia se puede compartir («mirá lo que trajo la 1.2»).

### Pie del sitio

- La insignia «Beta» (con tooltip) pasa a ser `v1.0.0`, que enlaza a `/changelog`.
- «Novedades» se suma a «Enlaces rápidos» **solo en el pie** (la lista `links` es compartida con la
  barra, así que se agrega aparte).
- Una línea final: «La Nube es software libre (AGPL-3.0). Código fuente de esta versión (v1.0.0 ·
  abc1234)», enlazada al árbol del commit exacto. Ver «AGPL» abajo: es la oferta de código de la §13.
  El enlace sale del código (`SOURCE_REPOSITORY` en `build-info.ts`), **no** de la configuración del
  sitio (el `githubUrl` de contacto lo puede editar un superadmin).

### La guarda: no hay cambio sin versión

Dos capas:

1. **Coherencia** (`src/lib/changelog/registry.test.ts`, corre con `npm test`): semver válido,
   saltos consecutivos, fechas que no retroceden, archivo `.md` presente y no vacío, sin archivos
   huérfanos, y `package.json`/`package-lock.json` iguales a la última entrada.
2. **Cambio sin versión** (`scripts/check-release.ts`, `npm run release:check`, en CI antes de las
   pruebas): los **tags `v*` son la memoria de qué se publicó**.
   - Si existe `v<versión actual>`, esa versión ya salió: si desde el tag cambió algo de lo que se
     despliega (`APP_PATHS`: `src`, `prisma`, `public`, `package*.json`, configs de la raíz,
     `deploy/Dockerfile`, el script del manifiesto), falla y dice qué archivos. Los tests
     (`*.test.ts(x)`) y `src/assets/changelog/` no cuentan: no cambian lo que corre.
   - Si no existe, es una versión nueva: tiene que ser el siguiente salto del último tag.
   - `--warn` solo avisa (para usar a mano en una rama). Necesita historial completo: CI hace
     `fetch-depth: 0`.
   - El workflow crea `v<versión>` al publicar (después de mover `production`), **nunca mueve uno
     existente**. Un push que solo toca docs deja el tag donde estaba.

Por qué en CI y no en un hook de git: el trabajo se hace en `preview` con muchos commits; exigir la
versión en cada commit sería ruido. Lo que importa es que **no llegue a producción** un cambio sin
número. El costo: el error aparece después del merge a `main` (el deploy no sale y se arregla con un
commit que sube la versión).

Probado en un clon descartable: tag en `HEAD~3` → falla listando los archivos; tag en `HEAD` → pasa;
versión nueva sobre `0.9.0` → pasa.

## Verificación del build (AGPL)

### Qué se puede y qué no se puede probar

Hay que decirlo de entrada: **no existe forma de demostrar desde afuera qué código corre en un
servidor ajeno.** Cualquier cosa que el servidor «informe» (versión, commit, una huella) la puede
falsear quien controle el servidor. La única excepción práctica sería atestación remota con hardware
confiable (TEE), que no aplica a un VPS municipal.

Lo que **sí** se puede comprobar sin creerle al servidor es lo que el servidor le entrega a
cualquier navegador: el JavaScript y el CSS de `/_next/static`. Si esos archivos son byte a byte los
que construyó CI para un commit público, el código de cliente es ese. Un cambio que solo toque
código de servidor (una ruta de API, qué se hace con los datos) **no se detecta** así.

Por eso el diseño tiene tres piezas que se refuerzan:

1. **Autodeclaración** — `GET /api/version` (público): versión, commit, hora de build, huella de los
   estáticos, enlace al código. Sirve para detectar un despliegue desprolijo y, sobre todo, deja a
   quien despliega **afirmando por escrito** qué código corre: si lo que afirma no coincide con lo
   que sirve, esa contradicción es evidencia.
2. **Referencia firmada** — CI construye la imagen desde el repo público, le mete el manifiesto
   (`release-manifest.json`: SHA-256 de cada archivo de `.next/static`) y firma una **atestación de
   procedencia** (`actions/attest-build-provenance`, Sigstore, con registro público de
   transparencia) que liga el digest de la imagen con el repo, el workflow y el commit. Así «la
   imagen de CI para el commit X» es una referencia que cualquiera puede verificar
   (`gh attestation verify`).
3. **Comprobación independiente** — `scripts/verify-deployment.mjs` (`npm run release:verify --
<url>`): lee `/api/version`, comprueba que el commit esté en `origin/main` y que en ese commit
   `package.json` diga esa versión, baja la imagen de CI de ese commit y saca su manifiesto (o usa
   `--reference`), verifica la atestación si hay `gh`, y después **descarga del sitio en vivo cada
   archivo del manifiesto y compara su hash**, y recorre páginas públicas buscando scripts/estilos que
   no estén en la referencia. Salida 0 = coincide, 1 = no coincide, 2 = no concluyente; al fallar,
   pide guardar la salida con la fecha como constancia.

Además: el `buildId` de Next pasa a ser el commit (`generateBuildId` en `next.config.ts`, solo cuando
`APP_COMMIT_SHA` es un SHA válido), así cada página y las rutas `/_next/static/<buildId>/…` nombran el
commit; la imagen lleva las etiquetas OCI `revision`, `version` y `licenses`; y `serverInfo.version`
del MCP es la versión de la app (antes, un `1.1.0` propio que no seguía a nada).

**Por qué `/api/version` es público y no un endpoint oculto o una pantalla de superadmin:** la
información no es secreta (la misma huella sale de los archivos públicos), y la AGPL existe para que
cualquier persona usuaria pueda saber qué código corre. Uno oculto no protege nada y uno de
superadmin depende de que el superadmin sea quien quiere verificar — justo lo que deja de pasar si
el servidor pasa a manos de otro.

### Verificado

Con un build `standalone` real (commit en `APP_COMMIT_SHA`, base descartable como en CI):

- `/api/version` responde versión, commit, huella y 300 archivos; el pie muestra `v1.0.0`,
  «Novedades» y el enlace al commit; `/changelog` y `/changelog/1.0.0` son 200 y `/changelog/9.9.9`
  es 404; capturas a 390 px (claro/oscuro) y 1440 px sin desborde horizontal.
- El verificador contra ese build: 300/300 archivos idénticos y ninguna página carga recursos
  ajenos. (El paso 2 marcó, correctamente, que el commit de prueba no estaba en `main` y que en él
  `package.json` todavía decía 0.1.0.)
- **Simulación de manipulación**: se agregó un `console.log` a un chunk servido → el verificador
  marcó ese archivo como distinto y salió con 1.
- Se encontró y corrigió un error del propio verificador: las rutas de chunks llevan paréntesis
  (`app/(public)/page-….js`) y la expresión cortaba en `)`.
- Pendiente de ver en el primer deploy real: la atestación en GHCR y el verificador con Docker
  contra la imagen publicada.

### La parte legal (no es asesoramiento legal)

- **AGPL-3.0 §13**: si alguien **modifica** el programa y lo ofrece a usuarios por la red, tiene que
  ofrecerles el código fuente correspondiente **de su versión modificada**. El enlace «Código fuente
  de esta versión» del pie es esa oferta; un fork desplegado tiene que apuntarlo a su propio código.
  Ojo: desarrollar cambios en privado **sin desplegarlos** no viola la AGPL; la obligación nace al
  ponerlos a disposición de usuarios.
- **Quién puede exigirlo**: solo quien tenga los derechos de autor. Si el código se escribió bajo
  relación de dependencia o contrato con la Municipalidad, puede que los derechos sean de ella (en
  Argentina, la Ley 11.723 —art. 4 inc. d, agregado por la Ley 25.036— asigna al empleador el
  software que sus dependientes producen en sus funciones, salvo pacto en contrario), y entonces la
  licencia no la obliga a nada. **Hay que revisar el contrato o acuerdo de cesión con un abogado
  antes de contar con esto.** Un acuerdo escrito que diga quién es titular y que el municipio usa el
  software bajo AGPL es más útil que cualquier mecanismo técnico.
- **Qué aporta lo técnico**: no impide nada; produce **evidencia fechada** (salida del verificador,
  atestaciones públicas, el `/api/version` del sitio) de que lo que corre no es lo publicado.
- Conviene sumar, a criterio de quien asesore: una cláusula contractual que obligue a desplegar solo
  imágenes construidas por el workflow público, o acceso de lectura al servidor para el autor (con
  eso, `docker inspect` del contenedor + `gh attestation verify` del digest cubren también el código
  de servidor).

## Archivos

- `src/lib/changelog/{semver,registry,source}.ts`, `registry.test.ts`
- `src/assets/changelog/1.0.0.md`
- `src/app/(public)/changelog/page.tsx`, `[version]/page.tsx`
- `src/components/organisms/layouts/public-layout/footer/index.tsx`
- `src/lib/build-info.ts`, `src/app/api/version/route.ts`
- `scripts/check-release.ts`, `scripts/release-manifest.mjs`, `scripts/verify-deployment.mjs`
- `deploy/Dockerfile` (`GIT_SHA` → `APP_COMMIT_SHA`, manifiesto), `.github/workflows/deploy.yml`
  (guarda, etiquetas OCI, atestación, tag `v*`), `next.config.ts` (`generateBuildId`, tracing),
  `package.json` (1.0.0, `release:check`, `release:verify`), `src/lib/mcp/tools/index.ts`.

## Cómo publicar una versión nueva

1. Elegí el salto (PATCH / MINOR / MAJOR, ver arriba).
2. Agregá la entrada al final de `RELEASES` y su `src/assets/changelog/<versión>.md`, escrito para
   quien usa el sitio (castellano llano, qué cambia para la persona).
3. `npm pkg set version=<versión>` y `npm install --package-lock-only`.
4. `npm test` y `npm run release:check`.
5. Merge a `main`: CI publica la imagen, crea `v<versión>` y el servidor la despliega en su ventana.

## Fuera de alcance

- Pantalla de superadmin con la versión (el endpoint público alcanza; se puede sumar).
- Builds reproducibles bit a bit (no hacen falta: la referencia es la imagen atestada de CI).
- El manifiesto en Vercel (allí no se genera; `/api/version` informa versión y commit igual).
