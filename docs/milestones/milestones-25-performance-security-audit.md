# Milestone 25 — Auditoría de rendimiento y seguridad (2026-10-06)

Un milestone de **calidad**, como el 10 (frontend) y el 12 (dominio). Nació de la regresión de
`/admin/maintenance` («Finalizar» congelaba el navegador, ver milestone 22): el usuario pidió
aprovechar para auditar el rendimiento del frontend y del backend, y anotar en el camino todo
problema de seguridad.

**Estado (2026-10-07, segunda sesión): corregido completo.** La primera sesión corrigió todo
salvo lo que esperaba una decisión de producto ([Correcciones](#correcciones-2026-10-07)); el
usuario decidió ([Decisiones](#decisiones-del-usuario-2026-10-07)) y la segunda sesión lo
implementó y verificó contra la app, también en el navegador
([Segunda sesión](#segunda-sesión-2026-10-07-decisiones-implementadas)). Este documento es el
registro completo de lo encontrado, cómo se encontró, qué se propuso y qué se hizo.

## Método y límites

- Lectura estática del código (`src/`), más la lectura del código instalado de TanStack Table
  8.21.3 y `@vercel/blob` 2.5.0 para confirmar el mecanismo de cada hallazgo, no suponerlo.
- **Nada se reprodujo en ejecución.** A mitad de la sesión el clasificador del modo automático
  bloqueó la terminal y el navegador por el resto de la conversación; desde ahí solo se pudo
  leer archivos. Los hallazgos marcados **(mecanismo confirmado)** se apoyan en la lectura del
  código de la librería; ninguno se probó contra la app corriendo.
- Cobertura: todas las llamadas a `useReactTable`/`useStaticTable`; los sondeos (`useApi` con
  `refreshIntervalMs`); layout raíz y `auth()`; el mapa completo de `src/app/api/**/route.ts` con
  su guard; subidas de participantes y storage; middleware; rate limit; tokens; crons; headers.
  Patrones de consulta a la base: sección [Patrones de consulta](#patrones-de-consulta-a-la-base).
- **Fuera de alcance** (no se revisó): tamaño de los bundles, el servidor OAuth en profundidad,
  los senders de correo más allá de lo ya documentado.

## Resumen

| #   | Hallazgo                                                                  | Tipo        | Gravedad            |
| --- | ------------------------------------------------------------------------- | ----------- | ------------------- |
| R1  | `SpacesManager` congela el navegador (mismo bug que mantenimiento)        | Regresión   | Alta                |
| R2  | Las tablas de `/admin/reports` congelan el navegador al cargar el reporte | Regresión   | Alta                |
| P1  | Los sondeos siguen corriendo con la pestaña oculta                        | Rendimiento | Media               |
| P2  | Todo el sitio es dinámico: el layout raíz impide cachear páginas públicas | Rendimiento | Media               |
| P3  | Cada `auth()` hace 2–3 consultas y se llama varias veces por pedido       | Rendimiento | Media               |
| P4  | Caché de `useApi` sin desalojo; columnas recreadas en cada render         | Rendimiento | Baja                |
| S1  | XSS almacenado contra admins vía archivos de participantes                | Seguridad   | **Alta**            |
| S2  | La `url` de un archivo en una respuesta no se valida (path traversal)     | Seguridad   | Alta (con `local`)  |
| S3  | El ingreso con contraseña no tiene rate limit ni captcha; enumeración     | Seguridad   | Media               |
| S4  | El middleware consulta el mantenimiento en el origen del `Host`           | Seguridad   | Baja (Media en VPS) |
| S5  | Reinscripción de rechazados, enumeración de inscripción, tokens en claro  | Seguridad   | Baja                |
| D1  | CLAUDE.md dice que `report-snapshot` no está agendado; sí lo está         | Doc         | —                   |
| DB1 | `requirePermission` repite la lectura del rol que `auth()` acaba de hacer | Base        | Baja                |
| DB2 | `auth()` sin deduplicar dentro de un mismo render                         | Base        | Media               |
| DB3 | `actorSizeByReservationId`: todo el ledger + recorrido cuadrático en JS   | Base        | **Alta** (a escala) |
| DB4 | Dashboard de usuario filtra por `reservableId` sin índice utilizable      | Base        | Media               |
| DB5 | El calendario trae 500 ocurrencias por semana mostrada                    | Base        | Media               |
| DB6 | Reportes y conteos por día agregan en JS                                  | Base        | Baja                |
| DB7 | Sobre-lectura (cuerpo de noticias en tarjetas, includes completos)        | Base        | Baja                |
| DB8 | Subida pública consulta la base antes del rate limit                      | Base        | Baja                |
| C1  | "Hoy"/"semana"/"mes" de las estadísticas en UTC, no en hora del predio    | Correctitud | Media               |
| C2  | "Tiempo esta semana/mes" suma también las reservas futuras                | Correctitud | Media               |
| C3  | Las recurrentes se cuentan por el inicio de la serie                      | Correctitud | Media               |
| C4  | Comentario de `requireActiveSession` desactualizado                       | Doc         | —                   |

## Regresiones

### R1 — `SpacesManager` congela el navegador (mecanismo confirmado)

**Dónde:** `src/components/organisms/admin/config/spaces-manager.tsx:58`.

```ts
const spaces = (data ?? []).filter((s) => s.kind === kind);
const reorder = useTableReorder(spaces, …);
…
const table = useStaticTable(reorder.rows, columns);
```

`.filter` arma un array nuevo en **cada** render, y `useTableReorder` lo devuelve tal cual como
`rows` fuera del modo reordenar. Es exactamente el bug de `MaintenanceManager` (milestone 22).

**Mecanismo** (leído en `@tanstack/table-core` 8.21.3):

1. `getCoreRowModel()` está memoizado sobre `[table.options.data]`; cuando la identidad del array
   cambia, recalcula y llama a su `onChange`, que es `table._autoResetPageIndex()`
   (`utils/getCoreRowModel.js:61`).
2. `_autoResetPageIndex` (`features/RowPagination.js:41`): la primera vez solo se "registra";
   desde la segunda, si `autoResetPageIndex ?? !manualPagination` (verdadero por defecto, y
   `useStaticTable` no lo cambia), encola en una microtarea `table.resetPageIndex()`.
3. `resetPageIndex` → `setPagination(old => ({ ...old, pageIndex }))` → siempre un objeto nuevo →
   `setState` de React en `useReactTable` → re-render → `.filter` arma otro array → vuelta a 1.

Con la página quieta el ciclo no arranca (el primer cálculo solo registra). **Cualquier cambio de
estado lo dispara.** Acá: tocar «Eliminar» (`setDeleting`), cambiar de pestaña
Espacios/Áreas comunes (`setKind`), «Reordenar» (`setDraft`), o el propio `refetch`.

**Arreglo propuesto:** `const spaces = useMemo(() => (data ?? []).filter(...), [data, kind])`.

### R2 — `/admin/reports` congela el navegador al cargar el reporte (mecanismo confirmado)

**Dónde:** `src/components/templates/admin/report/index.tsx`, `PerResourceTable` (l. 494) y
`DurationTable` (l. 600). Ambas arman `rows` con `.slice().sort()` / spread + `.map` en el cuerpo
del render y se lo pasan a `useStaticTable`.

**Disparador:** `AdminReportsPage` (`src/app/(management)/admin/reports/page.tsx`) tiene un
`useEffect` que hace `setGeneratedAt(...)` apenas llega el reporte. Ese setState re-renderiza
`AdminReport` → las dos tablas reciben un array nuevo → ciclo de R1. Por lo tanto, lo esperable es
que **la página se congele justo después de mostrar el primer reporte**. Si por el orden de las
microtareas no ocurriera en la carga, ocurre igual con cualquier cambio de estado de la página
mientras hay un reporte en pantalla (elegir «Personalizado» y tocar el calendario cambia
`customRange`).

**Arreglo propuesto:** `useMemo` sobre `data` para `rows` en ambas tablas (y las columnas, que
dependen de `data.comparison`).

### Tablas revisadas y sanas

| Archivo                                                                                                                    | Por qué no cicla                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `maintenance-manager.tsx`                                                                                                  | Arreglado en 3b7feee (`useMemo`).                                                                                                                                                                                                                            |
| `resources-manager.tsx`, `roles-manager.tsx`, `reservation-types-manager.tsx`, `landing-themes-manager.tsx`                | `data ?? []`: el array de `useApi` es estable; mientras carga se muestra un skeleton y la tabla no pide filas (el memo de TanStack es perezoso). ⚠️ Frágil: si algún día la tabla se dibuja durante la carga, el `[]` nuevo de cada render dispara el ciclo. |
| `profile-requests-queue.tsx`                                                                                               | `manualPagination: true` → `autoResetPageIndex` es falso.                                                                                                                                                                                                    |
| `admin/users/page.tsx`                                                                                                     | `autoResetPageIndex: false` explícito.                                                                                                                                                                                                                       |
| `closed-days-table.tsx`, `audit-log-table.tsx`, `participants-table.tsx`, `events-admin-table.tsx`, `news-admin-table.tsx` | `data` llega como prop de una página de servidor: identidad estable entre renders del cliente.                                                                                                                                                               |

**Propuesta estructural (para no depender de la disciplina):** que `useStaticTable` pase
`autoResetPageIndex: false` (no pagina, así que el reinicio no le sirve de nada), o que el
`DataTable` advierta en desarrollo si `data` cambia de identidad N veces seguidas. Sin DOM en
Vitest no hay test barato; la regla de CLAUDE.md §13 queda, pero el default seguro la vuelve
innecesaria para las listas estáticas.

## Rendimiento

### P1 — Los sondeos no se pausan con la pestaña oculta

`useApi` (`src/hooks/use-api.ts:83`) usa un `setInterval` sin mirar `document.hidden`. Sondean:

- `MaintenanceProvider` (layout raíz → **todo visitante, en todas las páginas**): `/api/maintenance`
  cada 60 s.
- `NotificationBell`: `/api/user/notifications` cada 60 s — cada sondeo pasa por
  `requireActiveSession()` → `auth()` → 2–3 consultas (ver P3) + la de notificaciones.
- `useCheckedInUsers`: `/api/admin/checkin/current` cada 30 s.

En Vercel cada sondeo es una invocación facturada. **Propuesta:** en `useApi`, no disparar el
intervalo con `document.visibilityState === "hidden"` y refrescar una vez en `visibilitychange`
al volver.

### P2 — Todo el sitio es dinámico

`src/app/layout.tsx` hace `await connection()`, `auth()` y `getSiteConfig()` (consulta a la base)
en el layout raíz. Consecuencia: **ninguna página puede prerenderizarse ni cachearse en la CDN**,
incluidas la landing, noticias, espacios, «Quiénes somos» y políticas. Cada visita a la landing
cuesta una invocación más: tema activo, eventos próximos, noticias, espacios y áreas comunes,
configuración del sitio.

`connection()` existe para `serverNowMs` (`ServerTimeProvider`) y `siteConfig` para el botón de
WhatsApp. **Propuesta:** sacar del layout raíz lo que depende del pedido (la hora puede venir de
`/api/dev/server-time`-like o del primer `useApi`; el teléfono puede cachearse con
`unstable_cache`/`"use cache"` + `revalidateTag` en el PUT de site-config) y cachear las lecturas
públicas con tags que invaliden las rutas admin que las escriben.

### P3 — `auth()` cuesta 2–3 consultas y se repite en cada pedido

El callback `jwt()` (`src/lib/auth.ts:192`) recalcula en **cada** llamada:
`getRegisteredUserByEmail` (join con `user` y `bans`), un `prisma.user.findUnique` si no hay
perfil, `getPendingPoliciesForUser`, y `getRoleById` (este con caché de 30 s). Es deliberado (la
frescura del baneo/rol/políticas es un requisito, ver CLAUDE.md), pero se llama varias veces por
navegación: layout raíz, layout de `/user` o `/admin`, la página (`requirePagePermission`), cada
ruta de API (`requireActiveSession`/`requirePermission`, que además resuelve permisos de nuevo), y
`/api/auth/session` desde el `SessionProvider`.

**Propuesta:** envolver las lecturas del callback en `React.cache()` para deduplicar dentro de un
mismo render de servidor (no cambia la frescura entre pedidos), y medir antes/después.

### P4 — Menores

- La caché de `apiGet` (`src/lib/api/client.ts`) nunca desaloja: crece con cada URL visitada
  (p. ej. paginar usuarios). Acotarla (LRU chico o purgar vencidas al escribir).
- Varias tablas recrean `columns` en cada render (`spaces-manager`, `report/index.tsx`,
  `closed-days-table`, `audit-log-table`): no cicla (el reinicio solo lo dispara `data`), pero
  reconstruye el modelo de columnas cada vez.

## Seguridad

### S1 — XSS almacenado contra admins vía archivos de participantes (Alta)

**Cadena:**

1. `POST /api/forms/[slug]/upload` (público, sin sesión) → `handleParticipantUpload`
   (`src/lib/events/participant-upload.ts`) valida **solo nombre y tamaño**
   (`validateUploadMeta`: extensión según `accept`, tamaño) y guarda con
   `contentType: file.type`, el tipo que **declara el navegador** del atacante. Devuelve el
   descriptor `{ url, name, size, type }` al cliente.
2. Al enviar el formulario, la validación del campo FILE (`src/lib/events/form-engine.ts:256`)
   comprueba que `url` y `name` sean strings, el tamaño y la extensión. **`type` no se mira**:
   el atacante puede poner cualquier valor en la respuesta.
3. `GET /api/admin/events/[id]/participants/file` responde con
   `Content-Type: match.type || result.contentType` (el de la respuesta del participante) y
   `Content-Disposition: inline` por defecto, **en el origen de la app**.
4. La CSP global tiene `script-src 'self' 'unsafe-inline'` (milestone 10 lo dejó pendiente), así
   que un `<script>` inline del archivo corre. `X-Content-Type-Options: nosniff` no ayuda: el tipo
   no se olfatea, se declara.

**Ejemplo:** subir `cv.pdf` con `type: text/html` (o un `.svg`, si el campo lo acepta / no tiene
`accept`), inscribirse, esperar a que un admin toque «Ver». El script corre con la sesión del
admin y puede usar toda la API del panel (mismo origen, sin CSRF que frene): p. ej.
`PATCH /api/admin/users/[id]` con `roleId` si el admin tiene `users:roles:manage`.

**Arreglo propuesto:**

- Derivar el tipo **en el servidor** a partir de la extensión, contra una lista cerrada
  (`pdf`, `png`, `jpg`, `webp`, `doc[x]`, …); ignorar `file.type` y el `type` de la respuesta.
- En el proxy: `inline` solo para `application/pdf` e imágenes rasterizadas; todo lo demás
  `attachment`. Nunca `image/svg+xml` ni `text/*` inline.
- Agregar `Content-Security-Policy: sandbox; default-src 'none'` a esa respuesta.

### S2 — La `url` de un archivo en una respuesta no se valida (Alta con storage `local`)

El descriptor de archivo es **entrada del cliente**: `submitForm`/edición aceptan cualquier
string en `url`. El proxy de admin solo exige que la `url` pedida esté en alguna respuesta de un
participante del evento — y el atacante la puso ahí.

- **`LocalStorage.fetchPrivate`** (`src/lib/storage/local.ts`) hace
  `path.join(PRIVATE_ROOT, rel)` sin verificar que el resultado siga dentro de `PRIVATE_ROOT`:
  `local-private:../../.env` lee cualquier archivo legible por el proceso. Hoy `local` es "solo
  dev", pero el runbook del milestone 22 prevé migrar a un VPS, donde es el candidato natural si no
  se configura S3. Encadenado con S1, el script del atacante en el navegador del admin pide esa
  URL y exfiltra el contenido.
- **Vercel Blob:** `get()` (leído en `@vercel/blob` 2.5.0) exige que una URL completa termine en
  `.blob.vercel-storage.com`, pero acepta un **pathname** suelto y lo resuelve contra el store del
  token. Como prod y preview comparten store (`storageEnvRoot()`), un pathname `prod/events/…`
  forjado en una respuesta de **preview** deja que un admin de preview lea archivos privados de
  producción. (Una URL de otro store recibiría nuestro token en `Authorization`, pero ese pedido
  lo atiende Vercel, no el atacante: riesgo bajo.)

**Arreglo propuesto:** al subir, firmar el descriptor (HMAC de `url|name|size|type` + slug/evento)
y verificar la firma al enviar/editar; además, en `local.ts`, `path.resolve` + comprobar el
prefijo, y en el proxy exigir el prefijo de clave del entorno y del formulario.

### S3 — El ingreso con contraseña no tiene rate limit ni captcha (Media)

`authorize` del proveedor `credentials` (`src/lib/auth.ts:80`) no llama a `checkRateLimit` ni a
`verifyCaptcha`, a diferencia de registro, reseteo y recuperación. `signInSchema` tampoco pide
captcha. Fuerza bruta en línea ilimitada contra `/api/auth/callback/credentials`.

Agravantes:

- **Enumeración por tiempo:** `getUserByEmailAndPassword` (`src/lib/db/users.ts:391`) vuelve en
  seguida si el correo no existe y corre bcrypt (12 rondas) si existe.
- **Costo de CPU:** `bcryptjs` es JavaScript puro; cada intento cuesta ~cientos de ms de CPU
  activa (facturada en Vercel).
- Contraseña sin máximo (`min(8)` solamente).

**Arreglo propuesto:** rate limit por IP y por correo normalizado (como `/api/auth/recovery`);
`bcrypt.compare` contra un hash fijo cuando el usuario no existe; `max(128)` en los schemas de
contraseña. Captcha opcional tras N fallos.

### S4 — El middleware consulta el mantenimiento en el origen del `Host` (Baja; Media en VPS)

`apiGate` (`src/middleware.ts`) llama `loadSnapshotFor(nextUrl.origin)`; `origin` sale del header
`Host`. `loadSnapshotFor` (`src/lib/maintenance/gate.ts`) guarda **un loader por origen** en un
`Map` que nunca se purga, y hace `fetch(\`${origin}/api/maintenance?fresh=1\`)`.

- En Vercel el `Host` tiene que ser un dominio del deploy: inocuo.
- Detrás de un proxy que reenvíe el `Host` tal cual (VPS): SSRF ciega a una ruta fija desde el
  servidor, y crecimiento ilimitado del `Map` (un loader por `Host` inventado).

**Arreglo propuesto:** usar un origen fijo (`OAUTH_ISSUER`-like / `http://127.0.0.1:$PORT`) o,
como mínimo, acotar el `Map`.

Relacionado (VPS): `getClientIp` (`src/lib/request-ip.ts`) confía en `x-real-ip` /
`x-forwarded-for` porque Vercel los reescribe. En el VPS, el proxy **tiene** que pisarlos, o todo
rate limit queda con presupuesto infinito. Sumarlo al runbook del milestone 22.

### S5 — Menores

- **Reinscripción de rechazados:** `submitForm` reactiva una inscripción `REJECTED`/`CANCELLED`
  con el estado inicial del evento; en un evento sin aprobación manual eso es `APPROVED`. Un
  rechazo no vale nada en esos eventos. (Documentado como "no soportado" para re-aprobar, pero no
  el efecto inverso.) Además cualquiera puede reinscribir el correo de otra persona cuyo registro
  esté cancelado/rechazado, pisando sus respuestas.
- **Enumeración:** «Ya estás inscripto con ese email» revela si un correo está inscripto.
- **`editToken`** se guarda en claro. Es un cuid2 v3 (usa `crypto.getRandomValues`, no es
  adivinable), pero una fuga de la base da acceso a editar/cancelar toda inscripción. Guardar el
  SHA-256 como con los tokens de reseteo.
- **Subidas huérfanas:** lo subido y nunca enviado queda en el storage (12 por minuto por IP).
- **`request.formData()` antes de validar el tamaño:** en Vercel el cuerpo está topeado en
  4,5 MB; en un VPS no, y el proceso parsea todo antes de rechazar. Topear en el proxy.

### Revisado y correcto

- Toda ruta `admin/**` tiene `requirePermission` (la de incidentes es un stub 501).
- Las rutas `user/**/[id]` filtran por dueño en la consulta (`passkeys`, `change-requests`,
  `assistants`, cancelación de reservas por `reservableId`).
- SQL: los dos `$executeRawUnsafe` están parametrizados; el resto usa plantillas.
- Crons: sin `CRON_SECRET` responden 503 (fallan cerrado).
- Tokens de verificación y reseteo: 32 bytes aleatorios, guardados con hash.
- Markdown: react-markdown sin HTML crudo. El único `dangerouslySetInnerHTML` es el de
  `ui/chart.tsx` (estilos de la config estática).
- Headers: CSP (salvo `'unsafe-inline'`, ya conocido), HSTS, `nosniff`, `frame-ancestors`,
  `no-referrer` en `/forms/response/*`.

## Documentación desactualizada

- **D1:** CLAUDE.md (árbol del proyecto) dice que `cron/report-snapshot` "NO está en los `crons`
  de vercel.json — nunca corre"; `vercel.json` hoy lo agenda (`0 6 1 * *`), junto con
  `sync-holidays` (`0 7 1 * *`). Corregir al arreglar.

## Patrones de consulta a la base

Segunda pasada, también por lectura estática (sin `EXPLAIN`: no había terminal). Se recorrieron
`src/lib/db/{resourceCalendar,adminReservations,adminStats,dashboardStats,adminReports,
participants,events (listados públicos),news (listados),notifications,roles,reservations}.ts`,
`src/lib/api-auth.ts`, y los índices de `prisma/models/{reservations,events,notifications}.prisma`.
**No se leyó** el SQL de las funciones de Postgres (`get_user_next_reservations`,
`get_unavailable_slots`, `approve_reservation`…): sin `grep` no se pudo ubicar su última
definición entre las migraciones. Queda para la sesión de arreglos, con `EXPLAIN ANALYZE`.

### Costo fijo por pedido

| Pedido                         | Consultas antes de hacer nada útil                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Cualquier página (layout raíz) | `getSiteConfig` + `auth()` (si hay sesión: perfil+baneos, [cuenta], políticas pendientes; rol en caché) |
| `/user/**`, `/admin/**`        | lo anterior, **otra vez** `auth()` en el layout, y en la página (`requirePagePermission`)               |
| API con `requireActiveSession` | `auth()` → 2–3 consultas                                                                                |
| API con `requirePermission`    | `auth()` → 2–3 + `getPermissionSetForUser` → 1 más                                                      |

**DB1 — `requirePermission` repite una consulta que `auth()` acaba de hacer.** El callback
`jwt()` corre en cada `auth()` y ya resuelve el rol desde la base en ese mismo pedido
(`token.permissions`, `token.isSuperadmin`); `getPermissionSetForUser` vuelve a leer `roleId`.
El comentario de `requirePermission` justifica la segunda lectura con que "el JWT puede quedar
desactualizado", pero eso aplica al **middleware** (que lee la cookie sin correr el callback), no
a una sesión obtenida con `auth()` dentro de la ruta. **Propuesta:** usar `session.permissions`
/ `session.isSuperadmin` en `requirePermission` (verificar antes, con un test, que `auth()` en
rutas efectivamente corre `jwt()` en NextAuth v5 — si no, el comentario tiene razón y DB1 se
descarta). Ahorra una consulta por llamada de admin.

**DB2 — Deduplicación por pedido** (ver P3): `React.cache()` sobre `getRegisteredUserByEmail` y
`getPendingPoliciesForUser` colapsa las 2–4 llamadas a `auth()` de un mismo render de servidor.

### Hallazgos por consulta

**DB3 — `actorSizeByReservationId` trae el ledger entero y lo recorre en cuadrático.**
(`src/lib/db/adminReservations.ts:51`). Para conocer el `actor_size` de cada reserva listada
(hasta `RANGE_FETCH_MAX = 3000` en las vistas por rango) lee **todas** las filas de
`reservation_ledger` de esas reservas — una por bucket de 15 min por ocurrencia: una recurrente
semanal de 2 h son 8 filas por semana hacia adelante — y después, por cada reserva, hace
`ledgerRows.find(...)` y `ledgerRows.filter(...)` sobre el array completo: O(reservas × filas).
Es la consulta más cara del panel a escala. `actor_size` es constante por reserva.
**Propuesta:** `SELECT DISTINCT ON (reservation_id) reservation_id, actor_size FROM
reservation_ledger WHERE reservation_id = ANY($1) ORDER BY reservation_id,
occurrence_start_time` (o guardar `actor_size` en `reservations`), y un `Map` en vez de
`find`/`filter`.

**DB4 — `reservations` no tiene índice utilizable para `reservableId` solo.** El índice es
`@@index([reservableType, reservableId])`; Postgres 17 no hace _skip scan_, así que una consulta
que filtra solo por `reservableId` no lo usa. Las cuatro consultas de `getDashboardStatsByUserId`
(`src/lib/db/dashboardStats.ts`) filtran así → recorren la tabla en cada carga del dashboard de
usuario. **Propuesta:** agregar `reservableType: "USER"` a esos `where` (es lo correcto además:
hoy un `reservableId` de evento nunca coincide con un usuario, pero por accidente) o un índice
`(reservable_id, start_time)`.

**DB5 — El calendario de reservas trae 500 ocurrencias para mostrar una semana.**
`getCalendarDataBySpace` (`src/lib/db/resourceCalendar.ts:192`) pide
`get_user_next_reservations(user, null, 500, 0)` desde **ahora** y filtra a la semana visible en
JS; ya está documentado en el código como deuda (milestone-12) con su arreglo: pasar la ventana a
la función SQL. Cada cambio de semana repite las 500. En el log del dev server se vio
`GET /api/resources/… 200 in 4258ms` (puede ser compilación en frío; medir).

**DB6 — Reportes y estadísticas cargan filas para contar en JS.** `adminReports.fetchRangeData`
trae toda reserva del rango (un reporte anual = todas las del año) y cuenta/agrupa en memoria;
`listReservationDayCountsInRange` y `listDaysWithPendingReservationsAllServices` igual. A la
escala actual es aceptable; un `GROUP BY` lo vuelve O(días). Además `durationStats` usa
`Math.min(...array)`/`Math.max(...array)`: con ~100k elementos revienta la pila.

**DB7 — Sobre-lectura.** `getLandingNews`/`listPublishedNews`/`listAdminNewsPosts` traen la fila
completa de `NewsPost`, **con el `body` en markdown**, para dibujar tarjetas; el listado admin de
reservas incluye `space: true` entero. `getAdminAggregateStats` hace dos consultas en serie
después del `Promise.all` (podrían ir adentro). El proxy de archivos de admin carga **todas** las
inscripciones del evento con sus respuestas para validar una sola URL.

**DB8 — Rutas públicas que tocan la base antes del rate limit.** `POST /api/forms/[slug]/upload`
llama `getPublicForm` (evento + formulario + campos + conteo) antes de que
`handleParticipantUpload` aplique el límite por IP. Mover el rate limit al principio.

**Sin problemas:** `getEventOccurrencesForSpace` (índice `(space_id, status,
occurrence_start_time)` del ledger + un solo `findMany` por ids, sin N+1);
`getUpcomingPublicEventsPage` (paginado, un `findMany` + `count` en transacción + una consulta de
excepciones por lote); `listNotificationsForUser` (índices `(recipient_id, created_at)` y
`(recipient_id, read_at)`); la caché de roles; los listados admin paginados en la base;
`event_participants` tiene índices por `email`, `user_id` y `(event_id, status)`.

### Correctitud encontrada en el camino (no es rendimiento)

- **C1 — "Hoy"/"esta semana"/"este mes" en la zona del servidor.** `getAdminAggregateStats` y
  `getDashboardStatsByUserId` calculan los inicios con `setHours(0,0,0,0)` / `getDay()` sobre un
  `Date`: en Vercel eso es **UTC**, no la hora del predio (`ADMIN_TIMEZONE`). Entre las 21:00 y
  las 24:00 de Argentina, "hoy" ya es mañana.
- **C2 — "Tiempo esta semana/este mes" sin tope superior.** En `dashboardStats.ts` los rangos son
  `startTime >= inicio` sin `<= fin`: suman también todas las reservas futuras.
- **C3 — Las recurrentes cuentan una vez.** Dashboard de usuario, contadores del admin, reportes y
  los listados por rango de `/admin/reservations` filtran por `reservations.start_time`, que es el
  **inicio de la serie**: una recurrente creada hace meses no aparece en la semana actual, y en un
  reporte cuenta una sola vez con la duración de una ocurrencia. Lo correcto es leer el ledger (que
  ya está expandido) o las ocurrencias. Revisar contra lo que el milestone 12 decidió para reportes.
- **C4 — Comentario desactualizado:** `requireActiveSession` (`src/lib/api-auth.ts`) dice que
  `/api/**` no está en el matcher del middleware; desde el milestone 22 sí lo está (para el
  portero de mantenimiento; el baneo y las políticas siguen sin chequearse ahí).

### Orden de arreglo sugerido (base)

1. DB3 (la única con crecimiento cuadrático).
2. DB4 + C2 + C1 (mismo archivo, cambios chicos).
3. DB1/DB2 (medir antes y después: es el costo fijo de todo pedido).
4. DB5 (cambia la firma de una función SQL con otros callers).
5. C3 (decisión de producto: qué significa "reservas del período").
6. DB6–DB8.

## Correcciones (2026-10-07)

Hechas en `preview`, un commit sin firmar por grupo. Con el modo automático apagado la terminal
volvió, pero **el navegador siguió bloqueado** por el mismo clasificador (no dejó completar el
ingreso ni navegar), así que la verificación se hizo con tests, con `curl` contra la app local
(ingresando como los usuarios de ejemplo de `prisma/seed.ts`) y comparando resultados en la base
de dev. Lo que solo se puede ver en un navegador quedó en [Pendiente de verificar a
mano](#pendiente-de-verificar-a-mano).

| #             | Estado    | Qué se hizo                                                                                                                                                                                                                                                                                                                  | Cómo se verificó                                                                                                                                                                                                                               |
| ------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1, R2        | Corregido | `useMemo` en `SpacesManager` y en las dos tablas del reporte; `useStaticTable` pasa `autoResetPageIndex: false` como red de seguridad (esas tablas no paginan). Regla en CLAUDE.md §13.                                                                                                                                      | `tsc` + lint. **Sin navegador**: falta tocar los botones (ver abajo).                                                                                                                                                                          |
| S1            | Corregido | Tipo MIME por extensión (`contentTypeForName`), nunca el del navegador ni el de la respuesta; el proxy sirve inline solo PDF/imágenes rasterizadas (`isInlineSafe`), el resto como adjunto, con `CSP: sandbox` salvo el PDF.                                                                                                 | Subida de un `cv.pdf` declarado `text/html` → el descriptor vuelve `application/pdf`. Tests de `contentTypeForName`/`isInlineSafe`.                                                                                                            |
| S2            | Corregido | La subida firma el descriptor (HMAC con `NEXTAUTH_SECRET`, atado al evento); envío/edición solo aceptan firmados o ya guardados en esa inscripción. `privateKeyOf` canónico en los dos proveedores; el local no sale de su raíz; Blob solo URLs privadas de nuestro store; el proxy exige el prefijo de subidas del entorno. | `curl`: URL forjada `local-private:../../.env` → rechazada; descriptor firmado con el `type` cambiado → rechazado; el firmado intacto → aceptado (inscripción de prueba borrada después). 24 tests nuevos.                                     |
| DB8           | Corregido | `participantUploadRateLimit()` antes de buscar el formulario o la inscripción.                                                                                                                                                                                                                                               | Lectura + `tsc`.                                                                                                                                                                                                                               |
| S3            | Corregido | Rate limit en `authorize` por IP (20/min, castigo 15 min) y por correo (10 cada 15 min), contado antes de bcrypt; hash ficticio cuando el correo no existe; tope de 128 caracteres en las contraseñas; aviso en la pantalla.                                                                                                 | `curl` contra `/api/auth/callback/credentials`: el intento 12 redirige con `code=rate_limited`. Filas de prueba de `rate_limits` borradas.                                                                                                     |
| DB3           | Corregido | `DISTINCT ON (reservation_id)` en vez de todo el ledger + `find`/`filter`.                                                                                                                                                                                                                                                   | SQL corrido en dev. En dev ninguna reserva tiene dos `actor_size` distintos (0 de 13); se toma el bucket más temprano, como antes.                                                                                                             |
| C1, C2, DB4   | Corregido | `currentPeriodsInAdminTz` (hoy/semana/mes en hora del predio, con fin); el dashboard filtra `reservableType: "USER"` para usar el índice.                                                                                                                                                                                    | 4 tests nuevos (22:30 del martes en Argentina sigue siendo martes; diciembre). `GET /api/admin/stats` responde igual de forma.                                                                                                                 |
| DB1, DB2 (P3) | Corregido | `requirePermission`/`requirePagePermission` usan los permisos de la sesión (verificado en `@auth/core` que `auth()` corre `jwt()` siempre); `cache()` de React en las lecturas que `jwt()` repetía.                                                                                                                          | Transacciones por pedido en dev (10 muestras): `/admin/dashboard` 8→6, `/admin/spaces` 11→6, `/api/admin/stats` 13→11, la campanita 5→5. `u1` sigue recibiendo 403 en `/api/admin/*`; `a1` (ADMIN) 200 en stats, 403 en roles y mantenimiento. |
| P1, P4        | Corregido | `useApi` pausa el sondeo con la pestaña oculta y refresca al volver; la caché de `apiGet` guarda 100 URLs como mucho.                                                                                                                                                                                                        | `tsc` + lint. **Sin navegador** (ver abajo).                                                                                                                                                                                                   |
| S4            | Corregido | `MAINTENANCE_PROBE_ORIGIN` opcional (VPS) y como mucho 8 lectores. Runbook del VPS: esa variable y que el proxy pise `X-Real-IP`/`X-Forwarded-For`. No se usó `NEXTAUTH_URL` por defecto: un preview que apunte al dominio de prod leería las ventanas de prod.                                                              | Tests de mantenimiento (27) en verde.                                                                                                                                                                                                          |
| DB5           | Corregido | Migración `20261007120000_user_reservations_window`: `get_user_reservations_window` (el cuerpo de siempre con la ventana adentro) y `get_user_next_reservations` como envoltorio con `[ahora, ∞)`. El calendario pide solo la semana.                                                                                        | Salida de `get_user_next_reservations` antes/después para todos los usuarios: idéntica (207 filas). Respuesta de `/api/resources/[id]` antes/después en 3 espacios × 4 semanas (hasta 20 adelante): idéntica.                                  |
| DB6           | Corregido | Primera sesión: `durationStats` en un recorrido (el spread reventaba la pila con ~100k). Segunda sesión, con C3: los conteos de reportes y los conteos por día de `/admin/reservations` pasan a `GROUP BY` en SQL.                                                                                                           | Ver [C3](#c3--las-recurrentes-cuentan-por-ocurrencia).                                                                                                                                                                                         |
| DB7           | Parcial   | Las dos listas del tablero admin entran en el `Promise.all`. **No** se recortó el `body` de las noticias: las tarjetas calculan el tiempo de lectura con él (habría que guardar los minutos en la fila).                                                                                                                     | `GET /api/admin/stats` con los mismos campos.                                                                                                                                                                                                  |
| D1, C4        | Corregido | CLAUDE.md (crons) y el comentario de `requireActiveSession`.                                                                                                                                                                                                                                                                 | —                                                                                                                                                                                                                                              |
| P2            | Corregido | Segunda sesión (`d0534eb`): ver [P2](#p2--sitio-público-cacheable).                                                                                                                                                                                                                                                          | `next build` antes/después, `next start` contra la base de dev, invalidación por tag probada.                                                                                                                                                  |
| C3            | Corregido | Segunda sesión (`2da9d95`): ver [C3](#c3--las-recurrentes-cuentan-por-ocurrencia).                                                                                                                                                                                                                                           | Reportes contra una referencia independiente; reserva recurrente de prueba.                                                                                                                                                                    |
| S5            | Corregido | Segunda sesión: reinscripción de rechazados (`016a1cc`) y `editToken` hasheado (`3e47d10`). Ver [S5](#s5--reinscripción-de-rechazados) y [editToken](#edittoken--enlaces-hasheados-uno-por-correo).                                                                                                                          | Contra la app local con Mailpit.                                                                                                                                                                                                               |
| S1 (bis)      | Corregido | Segunda sesión (`0274301`): la `CSP: sandbox` del proxy nunca llegaba al navegador (la pisaba la CSP global de `next.config.ts`). Ver [S1 bis](#s1-bis--la-csp-sandbox-no-llegaba-al-navegador).                                                                                                                             | Headers del proxy contra la app.                                                                                                                                                                                                               |

### Decisiones del usuario (2026-10-07)

Para lo que quedó abierto. Se implementa en una sesión nueva (esta quedó con el navegador
bloqueado por el clasificador).

1. **C3 — las recurrentes cuentan por ocurrencia.** Reportes, dashboards (usuario y admin) y los
   listados por rango de `/admin/reservations` cuentan cada ocurrencia que cae en el período (con
   sus excepciones), no la serie por su fecha de inicio. Fuente: el ledger (ya expandido y con
   excepciones) agrupado por `(reservation_id, occurrence)` — ojo que está en buckets de 15 min —
   o `get_user_reservations_window`/una función hermana para todos los usuarios. Con esto, los
   conteos pasan a `GROUP BY` en SQL (cierra DB6). La retención del milestone 12 poda el ledger
   pasado: para períodos viejos el reporte ya depende de los snapshots; revisar que esa costura
   siga siendo explícita (`coverage`).
2. **S5 — una inscripción rechazada no se reactiva.** Si el correo tiene una inscripción
   `REJECTED` en ese evento, el envío se rechaza (sin tocar la fila ni rotar su token): si no,
   quien fue rechazado puede reinscribirse sin fin y spamear al admin. Una `CANCELLED` (la canceló
   la propia persona) sí puede volver a inscribirse. Para no revelar quién fue rechazado, el
   rechazo usa el **mismo mensaje** que «ya inscripto».
3. **P2 — sitio público cacheable.** Sacar del layout raíz lo que depende del pedido
   (`connection()`, `auth()`, `getSiteConfig()`), y cachear las lecturas públicas (landing,
   noticias, espacios, «Quiénes somos», políticas) con tags que invaliden las rutas admin que las
   escriben. Verificar con `next build` qué rutas quedan estáticas/ISR.
4. **`editToken` — se hashea** (buena práctica: un token portador de larga vida es una
   credencial; se guarda solo su SHA-256, como los tokens de reseteo; con 256 bits aleatorios no
   hace falta bcrypt). Consecuencia: el link no se puede volver a armar desde la base, así que
   **cada correo que lleva link rota el token** (el anterior deja de andar), y se agrega «pedir un
   enlace nuevo» (correo → se manda uno fresco, sin revelar si había inscripción, con rate limit).
   Migración: hashear los tokens existentes en el lugar (los links ya enviados siguen andando,
   porque la búsqueda hashea lo que llega). Un link viejo muestra una pantalla amable con el botón
   para pedir uno nuevo.

   **Cambiado en la segunda sesión:** al ver los pros y contras de rotar, el usuario eligió **no
   rotar** — un token nuevo por correo, los anteriores siguen valiendo, y todos vencen cuando
   termina el evento (opción C). Ver [editToken](#edittoken--enlaces-hasheados-uno-por-correo).

### Pendiente de verificar a mano

**Hecho en la segunda sesión** (resultados en
[Verificación a mano](#verificación-a-mano-pendiente-de-la-primera-sesión)). La lista original:

1. `/admin/spaces`: tocar «Eliminar» (y cancelar), cambiar a «Áreas comunes», «Reordenar» → la
   pestaña no se cuelga.
2. `/admin/reports`: cargar un reporte, cambiar de período, elegir «Personalizado» y tocar el
   calendario → no se cuelga.
3. Abrir el archivo de un participante en `/admin/events/[id]/participants`: un PDF o una imagen
   se ven en el navegador; otro tipo se descarga.
4. Sondeo: con DevTools → Network, dejar una página en segundo plano un par de minutos → no hay
   pedidos a `/api/maintenance` ni a `/api/user/notifications`; al volver, uno de cada.
5. Ingreso: 11 contraseñas mal seguidas con el mismo correo → aviso «Demasiados intentos».

## Segunda sesión (2026-10-07): decisiones implementadas

Rama `preview`, un commit sin firmar por ítem, en el orden pedido: `016a1cc` (S5), `3e47d10`
(editToken), `2da9d95` (C3/DB6), `d0534eb` (P2), más `0274301` (S1 bis, encontrado al verificar).
Esta vez la terminal y el navegador anduvieron: la verificación se hizo contra la app local
(Docker: `lanube-app` en :3000 con hora simulada —30/09/2026—, `lanube-postgres`), ingresando con
los usuarios de ejemplo (`u1`, `sa1`), con Mailpit para los correos y con un `next build` /
`next start` en un worktree aparte para P2 (así no se pisaba el `.next` del contenedor de dev).
Todo dato de prueba se borró al terminar (inscripciones, archivos subidos, filas de auditoría y
de rate limit, la reserva recurrente de C3).

### S5 — reinscripción de rechazados

- **Regla:** `blocksReRegistration(status)` en `src/lib/constants/participants.ts`: PENDING,
  APPROVED y REJECTED frenan el envío; solo CANCELLED (la canceló la propia persona) se
  reactiva. `submitForm` responde `ALREADY_REGISTERED_MESSAGE` («Ya estás inscripto con ese
  email») en los tres casos, **sin tocar la fila ni su token**: un mensaje distinto le diría a
  cualquiera que tipee el correo de otro que esa persona fue rechazada.
- **Consecuencia (documentada en CLAUDE.md y `docs/design/04-events-and-forms.md`):** un rechazo
  es definitivo. La re-aprobación de un REJECTED en el lugar sigue sin existir (necesita volver a
  chequear la capacidad), y la salida que se documentaba —«que se reinscriba»— ya no existe.
- **Enumeración (S5, segundo punto):** no se tocó. «Ya estás inscripto» sigue revelando que un
  correo tiene una inscripción activa o rechazada en ese evento; el usuario decidió unificar los
  dos mensajes, no ocultar la existencia.
- **Verificación:** test de la regla (3 casos). Contra la app: la inscripción E2E en APPROVED →
  409; en REJECTED → 409 con el mismo texto y fila/token intactos; en CANCELLED → 201 y se
  reactiva. La fila se restauró desde un respaldo JSON.

### editToken — enlaces hasheados, uno por correo

**Lo que el usuario eligió.** El plan original rotaba el token en cada correo (opción B). Antes de
dar el OK el usuario pidió los pros y contras; se le presentaron cinco opciones y eligió la **C +
vencimiento al terminar el evento**:

| Opción                                                  | Enlaces viejos siguen | Fuga de la base                    | Por qué se descartó / eligió                                                                                                                                                                           |
| ------------------------------------------------------- | --------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. Dejar en claro                                       | Sí                    | Edita/cancela toda inscripción     | Es el problema.                                                                                                                                                                                        |
| B. Hash + rotar en cada correo                          | No                    | Nada usable                        | Cada correo de cambio de sesión rompía el enlace del correo de confirmación (el que la gente busca); carreras entre envíos; el sender pasa a escribir en la base (¿mandar primero o guardar primero?). |
| **C. Hash, un token por correo, los anteriores siguen** | Sí                    | Nada usable                        | **Elegida.** Una tabla chica; el sender solo inserta, nunca pisa; sin carreras.                                                                                                                        |
| D. Cifrar el token con una clave del servidor           | Sí (el mismo siempre) | Nada, salvo que se filtre la clave | Manejo de claves; quien entra al servidor tiene base y clave.                                                                                                                                          |
| E. Hash, y los correos de sesión no llevan enlace       | Casi                  | Nada usable                        | La más barata, pero los correos de sesión pierden el «Ver mi inscripción».                                                                                                                             |

Contexto que se le dio al decidir: la ganancia de hashear es moderada — quien lee la base ya ve
las respuestas (están en la misma tabla); lo que pierde es la capacidad de **editar o cancelar**
todas las inscripciones. El token no es adivinable (cuid2 antes, 256 bits ahora).

**Qué se hizo:**

- Migración `20261008100000_participant_edit_tokens`: tabla `event_participant_edit_tokens`
  (`participant_id` → `event_participants` con cascade, `token_hash` único, `created_at`). Los
  tokens existentes se copian hasheados (`encode(sha256(convert_to(edit_token,'UTF8')),'hex')`,
  lo mismo que `hashEditToken()` en JS, con ids `legacy_<participante>`) y se borra la columna en
  claro. Los enlaces ya enviados siguen andando.
- `src/lib/events/edit-token.ts` (puro, con test): `generateEditToken` (32 bytes base64url),
  `hashEditToken`, `editLinkExpired` (mismo criterio que el cierre del formulario:
  `recurrenceEnd ?? endTime` pasado; se calcula al usar el enlace, así reprogramar el evento lo
  mueve solo) y `editLinkPath`.
- `db/participants.ts`: `issueEditToken(participantId, tx?)` inserta el hash y devuelve el token
  en claro; `resolveEditToken` busca por hash y distingue `invalid` / `expired`;
  `getParticipantByToken`, `updateParticipantAnswers` y `cancelParticipant` pasan por ahí. El
  token de la confirmación se emite **dentro de la transacción** de `submitForm`.
- Correos (`src/lib/email/edit-link.ts`): `freshEditLinkUrl(id)` emite un token por correo; lo
  usan la aprobación y los cambios de sesión (el rechazo no lleva enlace). Se llama **solo si el
  correo se va a mandar**: con los correos de eventos suspendidos por mantenimiento no se emiten
  tokens. Todo correo con enlace suma una nota: es personal, vale hasta que termina el evento,
  y cómo pedir otro.
- «Pedir un enlace nuevo»: página `/forms/response/request-link` (correo + Turnstile) y
  `POST /api/forms/request-link`: captcha, rate limit por IP (5/min) **y por correo** (3/hora,
  para que no sirva para llenarle la casilla a otro), `assertMailerAvailable`, 503 si los
  correos de eventos están suspendidos. Manda **un** correo con un enlace por inscripción activa
  (PENDING/APPROVED, evento no cancelado ni terminado). Responde siempre lo mismo y el envío
  corre en `after()`, para que tampoco el tiempo de respuesta revele si había inscripción.
- Enlace inexistente o vencido: la API responde **410** `EDIT_LINK_GONE`; la página muestra una
  pantalla propia (evento terminado → «el evento ya terminó»; inválido → explicación + botón
  «Pedir un enlace nuevo»); el formulario de edición, ante un 410, recarga la página.
- El cron diario poda los tokens de eventos terminados (`pruneExpiredEditTokens`); es limpieza,
  el vencimiento ya rige al usarlos.

**Verificación (app local + Mailpit):** el enlace legado de la inscripción E2E siguió andando
después de migrar (hash idéntico en SQL y JS); uno de un evento terminado y uno inventado
devolvieron 410 con su pantalla; una inscripción nueva → correo con enlace; aprobarla (`sa1`,
`POST …/participants/decision`) → correo con otro enlace; un cambio de sesión (el sender real
corrido con `tsx` dentro del contenedor) → un correo por participante con su enlace propio; los
cuatro enlaces (legado, inscripción, aprobación, sesión) andaban a la vez. «Pedir un enlace
nuevo»: un correo para el inscripto, ninguno para el otro, respuesta idéntica en 75 vs 84 ms; el
cuarto pedido del mismo correo en la hora → 429; captcha vacío → 400. Poda: un `SELECT`
equivalente marca solo los 3 tokens de eventos terminados. Tests: `edit-token.test.ts` (6) y el
de `event-occurrence-update` ampliado (un enlace propio por correo; ninguno con correos
suspendidos).

**No verificado en el navegador:** la página «Pedir un enlace nuevo» (se probó la API y que la
página renderiza 200/estática). **No se hizo:** borrar las subidas huérfanas ni topear el cuerpo
antes de `formData()` (los otros dos puntos menores de S5; siguen anotados arriba).

### C3 — las recurrentes cuentan por ocurrencia

- **Fuente:** el ledger no sirve — `maintain_reservations()` borra cada día los buckets pasados,
  y los reportes miran sobre todo el pasado. Migración `20261008110000_reservation_occurrences`:
  `reservation_occurrences(from, to, [tipo, dueño, espacio])`, `LANGUAGE sql STABLE`, que expande
  desde `reservations` con **la misma regla que `rebuild_reservation_ledger_forward`**: paso
  según la frecuencia del RRULE desde `start_time` hasta `min(recurrence_end, inicio + 1 año)`,
  cada ocurrencia por `effective_occurrence_window` (cancelada → afuera; reprogramada → su ventana
  nueva). Una ocurrencia pertenece al período si su **inicio efectivo** cae en `[from, to]`.
  Devuelve todos los estados; los filtros opcionales recortan series antes de expandir.
  `get_user_reservations_window` se descartó como fuente: tiene su propia expansión inline
  (equivalente hoy, pero una segunda copia de la regla).
- **Reportes** (`adminReports.ts`): dos `GROUP BY` (por espacio × estado con suma/mín/máx de
  minutos; por día en hora del predio × estado) y uno de altas de usuarios por día. Cierra DB6:
  un reporte anual ya no trae todas las reservas a memoria.
- **Costura con la retención:** el detalle crudo se cuenta desde `coverage.rawFromMs`. Antes de
  esa fecha las series terminadas ya se borraron; una serie que cruza el corte seguiría
  expandiéndose hacia atrás y mezclaría un tramo parcial con lo que el aviso de la UI dice que
  «no está contado en los totales». Recortar vuelve literal el aviso. La comparación se recorta
  igual y **sigue sin `coverage` propia** (limitación previa, no se tocó). Los snapshots
  mensuales que tome el cron desde ahora cuentan ocurrencias; los ya guardados contaron series
  (en dev no hay ninguno).
- **Tableros:** usuario — próximas (ocurrencias aprobadas desde ahora), horas de la semana y del
  mes (suma de ocurrencias aprobadas del período); admin — aprobadas futuras por ocurrencia
  (`src/lib/db/occurrences.ts`). **Pendientes y rechazadas siguen por serie**: son la cola de
  decisiones, y una serie se aprueba o rechaza entera.
- **`/admin/reservations`:** los listados por rango (agrupado por día, paginado, por espacio con
  rango) y los conteos por día devuelven ocurrencias, paginadas y contadas en la base. Cada fila
  conserva el `id` de la reserva (aprobar desde una ocurrencia decide la serie, como siempre) con
  el horario de esa ocurrencia. Sin rango, el listado por espacio sigue siendo de series.
- **Verificación:** los tres reportes (julio, sep–oct, año 2026) coinciden campo por campo
  (totales, por estado, por espacio, duraciones, cada día) con una referencia contada en Python
  sobre la lista cruda de `reservation_occurrences()`; el año pasa de 410 a 453 (las 10 series de
  eventos ahora valen 53 sesiones), pendientes/rechazadas/altas iguales. La expansión coincide con
  el ledger salvo las ocurrencias que el ledger no materializó por estar en el pasado al
  reconstruirlo. Listados y conteos por día: idénticos antes/después (en dev no había
  recurrentes de personas). Con una reserva semanal de prueba para `u1` (una ocurrencia
  cancelada y otra reprogramada): tablero 1 / 1 h / 6 h → 13 / 3 h / 12 h (lo calculado a mano),
  admin 58 → 70, la cancelada no aparece en el listado y la reprogramada cae en su día nuevo con
  su duración. Reporte anual: 2,5 ms en SQL, ~60 ms punta a punta.
- **Encontrado y no tocado:** la tarjeta «Reservas Totales» del tablero de usuario muestra
  `recentReservations.length` (como mucho 10). En dev hay 397 reservas sembradas sin ledger
  (`cmuo1zo7…`): datos de prueba de otra sesión, no un bug del código.

### P2 — sitio público cacheable

- **Layout raíz sin nada del pedido.** `ServerTimeProvider` y la sesión resuelta en el servidor
  pasan a un layout nuevo, `(management)/layout.tsx` (todos los consumidores de la hora están
  ahí). El sitio público monta `SessionProvider` sin `session`: la pide el navegador (para un
  anónimo no toca la base: sin cookie no corre `jwt()`). El botón del encabezado reserva su
  lugar mientras carga, para no mostrar «Iniciar sesión» a quien ya ingresó (el parpadeo apareció
  al verificar y se corrigió en el mismo commit).
- **Lecturas cacheadas** (`src/lib/cache/public-reads.ts`): `unstable_cache` con tags
  (`public:site-config|events|news|spaces|landing-themes`) y vencimiento de 300 s para lo que
  depende del reloj. `unstable_cache` guarda con `JSON.stringify`, que revienta con BigInt: se
  serializa con `cache/serialize.ts` (BigInt y Date etiquetados, con test). El tema de la landing
  se cachea como lista (`listEnabledLandingThemes`) y se resuelve el del día al renderizar.
- **Invalidación:** `revalidatePublic(tag)` justo después de la auditoría en toda ruta admin que
  escribe eventos, noticias, espacios, temas, configuración y tipos de reserva (los nombres de
  tipo salen en las tarjetas), en la decisión sobre participantes y en la inscripción/cancelación
  públicas (la fase «completo» de la tarjeta).
- **Páginas:** `revalidate = 300` (literal, Next lo exige). `/`, `/about`, `/spaces` y políticas
  se prerenderizan; `/events/[id]` y el detalle de noticias son ISR a demanda
  (`generateStaticParams` → `[]`); `/news` sigue dinámica (`searchParams`) pero lee de la caché.
  Las políticas dejaron `connection()`: una versión con `effectiveAt` futuro aparece a lo sumo 5
  minutos (más la visita que regenera) después de su hora. La aceptación obligatoria no depende de
  esa página.
- **Protección:** `public-cache.test.ts` falla si el layout raíz o una página pública usa
  `auth()/connection()/cookies()/headers()/getSiteConfig()`, si un `revalidate` no es igual a la
  constante, si lo público importa lecturas de `@/lib/db/*`, o si una ruta admin de esas
  entidades escribe sin invalidar.
- **Verificación.** `next build` antes: todas las páginas `ƒ`. Después: `○` con ISR 5 min para
  `/`, `/about`, `/spaces`, políticas y `request-link`; `●` para eventos y noticias. Con
  `next start` contra la base de dev, contando transacciones en `pg_stat_database` (esperando 15 s
  a que Postgres publique las estadísticas): 10 visitas a la landing, **93 → 5** (5 es el ruido de
  fondo de 15 s: el portero de mantenimiento); 10 a `/spaces`, **36 → 9**. Respuestas `HIT` con
  `s-maxage=300`. Editar el teléfono (`PUT /api/admin/site-config`) se vio en la visita siguiente
  de `/`, `/spaces` y `/about` (`MISS` → regenerada); destacar el evento E2E (bulk) apareció y
  desapareció de la landing. En dev, el área logueada sigue recibiendo `serverNowMs` y el
  encabezado público pasa a «Ir a mi perfil» con sesión.
- **Hallazgo previo, no corregido:** en `next start` sobre **http** el área logueada redirige al
  ingreso — el middleware lee la cookie con `secureCookie: NODE_ENV === "production"`
  (`__Secure-authjs.session-token`) y NextAuth la emite sin prefijo sobre http. En Vercel (https)
  coinciden; afecta solo a probar un build de producción en local, o a un VPS sin TLS.

### S1 bis — la CSP sandbox no llegaba al navegador

Al verificar el archivo de participante: la respuesta del proxy traía **solo la CSP global**. Los
headers de `next.config.ts` pisan los que pone la ruta, así que la `sandbox; default-src 'none'`
de S1 nunca se aplicó. No era explotable (lo no inline va como `attachment` +
`application/octet-stream`), pero faltaba esa capa. La regla de la CSP global ahora excluye
solo esa ruta (`/((?!api/admin/events/[^/]+/participants/file$).*)`); el resto de los headers
sigue en `/:path*`. `src/lib/security-headers.test.ts` fija la regex. Verificado: un `.html`
forjado como `text/html` → `attachment`, `octet-stream`, `CSP: sandbox`; el PDF → `inline` sin
CSP (el visor de Chrome no abre con `sandbox`); la landing conserva la global.

### Verificación a mano (pendiente de la primera sesión)

En Chrome contra la app de dev, como `sa1`:

1. **`/admin/spaces`:** «Eliminar» abre el diálogo y «Cancelar» lo cierra; «Áreas comunes»
   cambia de pestaña; la página sigue respondiendo después de cada paso. (Los timers medidos
   tardaban ~1 s en las dos páginas comparadas: la pestaña estaba oculta y Chrome los recorta;
   no era un ciclo.)
2. **`/admin/reports`:** carga el reporte, «Mes actual», «Personalizado», calendario (cambio de
   mes, dos días) y «Generar reporte»: sin colgarse. Se vio un **desajuste de hidratación** en el
   texto del período: el servidor está en hora simulada (30/09) y el navegador en la real (07/10),
   así que «mes anterior» difiere. Es de la hora simulada, previo a este milestone.
3. **Archivo de participante:** el PDF se sirve `inline` (`application/pdf`); uno de otro tipo,
   como adjunto. De acá salió S1 bis.
4. **Sondeo:** con la pestaña oculta, 136 s sin un solo pedido a `/api/maintenance` ni a
   `/api/user/notifications`; al disparar `visibilitychange` con la pestaña «visible», uno de
   cada uno.
5. **Rate limit del ingreso:** con el contador de un correo inexistente en 10, un intento desde la
   pantalla muestra «Demasiados intentos de ingreso. Esperá unos minutos y volvé a probar.»
