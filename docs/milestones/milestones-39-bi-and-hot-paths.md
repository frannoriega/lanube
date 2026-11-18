# Milestone 39 — BI: rutas calientes, embudos y métricas de uso

**Estado:** seed (2026-11-18). Propuesta de diseño para discutir; nada implementado. Las decisiones
que necesitan respuesta del usuario están en «Preguntas abiertas».

## Qué pidió el usuario (2026-11-18)

1. Alguna forma de **BI** (abierto a sugerencias).
2. En particular, ver las **«rutas calientes»**: cómo navegan los usuarios la app, **como un grafo**
   que muestre los caminos más comunes, **para crear atajos**.
3. Cualquier otra cosa valiosa que se me ocurra («feel free to add»).
4. Hay que pensar **cómo se accede** (VPS Ubuntu 24).

## Dónde estamos hoy

- **Hay estadística de _dominio_**, no de _navegación_: `/admin/reports` (uso por espacio y por
  período, por ocurrencia — milestone 25), reportes de eventos con asistencia por sesión
  (milestone 31), exportación a CSV/Excel (milestone 32), snapshots mensuales con retención, y el
  tablero del admin. Todo sale de datos que la app **ya guarda para funcionar**.
- **No hay ninguna medición de cómo se usa la interfaz**: ni páginas vistas, ni recorridos, ni
  embudos. El sitio público es **estático/ISR** (milestone 25, P2): la mayoría de sus visitas **no
  ejecutan código nuestro**, así que no se pueden contar del lado del servidor.
- **Política de privacidad (`2025-11-16`)**: prevé «estadísticas internas sobre el funcionamiento y
  nivel de participación» y habilita registro adicional (IP, cookies, identificadores técnicos)
  «exclusivamente con fines de seguridad, autenticación y análisis estadístico»; no cede datos a
  terceros. Esto condiciona el diseño (ver «Privacidad»).
- Memoria del proyecto relevante: el check-in se pensó para calcular un **puntaje de uso efectivo vs.
  reservado** por miembro (informar futuras aprobaciones). Este milestone no lo implementa, pero
  deja el terreno (vistas BI) para hacerlo.

## Idea central: dos capas, cada una con su herramienta

|             | **Capa 1 — Navegación y producto**       | **Capa 2 — Dominio y operación**                                 |
| ----------- | ---------------------------------------- | ---------------------------------------------------------------- |
| Pregunta    | ¿Cómo usa la gente la interfaz?          | ¿Cómo se usa el espacio y el sistema?                            |
| Fuente      | Eventos propios de navegación (nuevos)   | Tablas que ya existen                                            |
| Dónde se ve | **Dentro de la app:** `/admin/analytics` | **En la app** (reportes, ya existen) **+ Grafana** (exploración) |
| Quién       | Quien tenga el permiso `analytics:view`  | Staff (en la app) · el superadmin (Grafana)                      |

**Por qué dentro de la app y no una herramienta aparte para la capa 1** (recomendación; la
alternativa está abajo):

- El staff **no tiene acceso al VPS** ni tiene por qué: si la vista vive en el panel, se accede con
  el login y los **permisos** de siempre (`/admin/roles`), sin túnel ni otra herramienta.
- El grafo de rutas calientes **necesita conocer las rutas de la app** (`/user/spaces/[slug]`, no
  cada slug) y conviene cruzarlo con el **rol** (usuario vs. admin) sin identificar a nadie: es
  más simple y más privado hacerlo propio que configurar una herramienta genérica.
- **Cero terceros y cero servicios nuevos**: coincide con la política de privacidad y con el
  presupuesto de RAM del VPS (milestone 38).

**Alternativa evaluada: Umami autoalojado** (analítica web liviana, sin cookies, con reporte de
_Journeys_ y embudos; solo necesita Postgres, puede usar una base aparte en la misma instancia).
Es la opción de «comprar en vez de construir»: sale en una tarde y tiene retención, filtros y UI
hechas. Límites: el _journey_ es un diagrama de pasos acotados (no el grafo de transiciones
completo), no conoce los permisos de la app (otro login, otro lugar donde mirar), no distingue
«rol» sin eventos personalizados, y es **un servicio más** que mantener y exponer. **PostHog**
(Paths + embudos + _session replay_) es la herramienta más completa pero exige ClickHouse/Kafka:
inviable en este VPS. **Matomo** es PHP+MySQL, más pesado y con más superficie. **Plausible CE** no
tiene grafo de rutas y requiere ClickHouse. **Cloudflare Web Analytics** (gratis, sin cookies) ya está
«al lado», pero es un tercero y solo da páginas vistas agregadas, no recorridos.

> Recomendación: **construir la capa 1 propia y mínima**, y dejar Umami como plan B si se prefiere
> no mantener código de analítica (se puede hacer un _spike_ de una tarde para comparar antes de
> comprometerse; ver «Preguntas»).

## Capa 1 — Navegación: recolección

### Qué se registra (y qué nunca)

Un evento de navegación = **«en esta sesión, se pasó de la ruta A a la ruta B»**:

`{ sessionId, seq, route (patrón), prevRoute, ts, tier, device, source }`

- **`route` es el _patrón_ de la ruta**, no la URL: `/user/spaces/[slug]`, `/admin/events/[id]/participants`.
  Se obtiene en el cliente reemplazando cada valor de `useParams()` por `[nombre]` en el `pathname`
  (los parámetros son justamente lo variable, así que el patrón sale sin mantener una lista a mano), y
  el servidor **valida contra una lista cerrada de patrones** (generada del árbol de `src/app` en
  el build) para que nadie ensucie las tablas con basura. Nunca se guardan **query strings** ni
  fragmentos (llevan tokens: `/forms/response/<token>` es una credencial; esa ruta se **excluye** del
  registro por completo, igual que `/auth/*` con tokens y `/oauth/authorize`).
- **`sessionId`**: aleatorio, vive en `sessionStorage` (por pestaña/visita, **no persiste** ni se
  comparte entre dispositivos), sin relación con la sesión de login ni con el usuario.
- **`tier`**: `anon` / `user` / `admin` (una de tres etiquetas), **no** el usuario ni el rol exacto.
- **`device`**: `mobile` / `tablet` / `desktop` por ancho de ventana (el rediseño mobile del
  milestone 14 se puede medir). **Nunca** user agent crudo.
- **`source`**: cómo se llegó — `nav` (menú), `link` (enlace en una página), `back` (historial),
  `direct` (entrada/recarga), `redirect`. Se infiere de un atributo `data-nav-source` en los
  componentes de navegación y del evento `popstate`. Es lo que permite saber si **un ítem del menú
  se usa** o si la gente llega por otro lado.
- **No se guarda**: IP, user agent, email, ID de usuario, nombre, contenido de formularios, nada de
  lo que se escribe, ni posición del mouse. **No hay _fingerprinting_** ni `localStorage` persistente.

### Eventos de producto (además de la navegación)

Un **registro tipado** `ANALYTICS_EVENTS` (igual que `AUDIT_EVENTS`: nunca un string libre; un test
lo exige) con pocos eventos de negocio **sin datos personales**, necesarios para los embudos:
`booking.slot_selected`, `booking.dialog_opened`, `booking.submitted`, `booking.succeeded`,
`booking.failed{code}`, `event.registration_started/submitted/succeeded`, `signup.step{n}`,
`calendar.view_changed{view}`, `calendar.export`… (la lista exacta se cierra al implementar).

### Transporte

- Un `NavigationTracker` (componente cliente, en los layouts público, `user` y `admin`) que usa
  `usePathname`/`useParams` y manda **por lotes** con `navigator.sendBeacon` a
  `POST /api/analytics/events` (cada ~10 s o al ocultar la pestaña). Falla en silencio: **la
  analítica nunca rompe ni demora la app**.
- **Respeta** _Do Not Track_ / _Global Privacy Control_ (no envía nada) y se puede apagar con una
  variable de entorno.
- Ruta de API sin sesión (el sitio público también se mide), con **`checkRateLimit`** por IP
  (la IP se usa solo para limitar, no se guarda), tope de tamaño y de eventos por lote, filtro de
  _bots_ (UA conocido y no-JS no llegan igualmente) y descarte de _prefetch_. Respuesta `204`.
- **Cuidados del repo:**
  - El _gate_ de mantenimiento (milestone 22) bloquea todo `POST` en modo solo-lectura: la
    analítica **no entra en `READ_ONLY_EXEMPT_PREFIXES`** (es prescindible); el cliente ignora el
    503 sin reintentar.
  - No va bajo `/api/user/**` (ahí rige `requireActiveSession`) ni `/api/admin/**` (ahí exige
    auditoría): la ruta de recolección es pública y no muta estado de negocio, así que queda
    fuera de ambos tests por diseño; se deja escrito en el doc y en un test propio.
  - Las páginas públicas siguen **estáticas**: el rastreo ocurre en el navegador, no toca el render.
  - Escritura con `after()` e `INSERT` por lotes; a este volumen alcanza con la base actual.

### Almacenamiento

- Tabla `analytics_nav_events` en la misma Postgres, **particionada por mes** (borrar un mes viejo =
  `DROP` de una partición, sin _vacuum_) y con índices por `(ts)` y `(session_id, seq)`.
- Una tabla de **agregados diarios** (`analytics_edge_daily`: día, `tier`, `device`, origen, destino,
  conteo, sesiones distintas) que **alimenta los gráficos** y se conserva más tiempo que los eventos
  crudos (mismo patrón que los _snapshots_ mensuales de reportes, milestone 25).
- **Retención:** eventos crudos **90 días**; agregados, sin vencimiento (no son personales ni
  reconstruyen a nadie). Un cron diario `analytics-rollup` (agrega y poda). **Regla del repo:** todo
  cron nuevo se agrega a `vercel.json`, a `deploy/systemd` y a la lista de `lanube-cron`.
- Por la misma razón de privacidad, un agregado con **menos de N sesiones (p. ej. 5)** no se muestra
  en pantalla (evita reidentificar a alguien con un camino único).

## Capa 1 — Qué se muestra en `/admin/analytics`

Permiso nuevo **`analytics:view`** (sembrado solo en SUPERADMIN, criterio de «superficies técnicas
al superadmin»; se puede dar a un rol desde `/admin/roles`). **No se expone por MCP** (se suma a
`FORBIDDEN_PERMISSIONS`). Entra en `ADMIN_PATH_PERMISSIONS` del middleware, en `configNavigation`
(sección «Análisis»), en `SEGMENT_LABELS` de las migas, y la página la cubre `admin-page-guards.test.ts`.

Filtros comunes: período, `tier`, dispositivo, y «solo sesiones que empiezan en…».

### 1. Grafo de rutas calientes (lo pedido)

- **Nodos = rutas** (tamaño = visitas), **aristas dirigidas = transiciones** (grosor = cantidad,
  color = `source`: menú / enlace / atrás). Diseño en capas (_dagre_) con **React Flow**
  (`@xyflow/react`): zoom, arrastrar, hover que resalta los caminos que entran y salen de un nodo,
  clic que **fija** un nodo y muestra su detalle (de dónde viene la gente, a dónde va, qué
  porcentaje abandona).
- Umbral mínimo de arista ajustable (para no ver «espagueti») y agrupación opcional de rutas por
  sección (`/admin/events/*` como un solo nodo).
- **Vista alternativa en Sankey** (`d3-sankey`, liviano): elegís un **punto de partida** (p. ej.
  «Dashboard del usuario») y ves, paso a paso, a dónde se va la gente en los próximos 3–5 pasos.
  El grafo responde «¿cómo es el mapa?»; el Sankey, «¿qué hace la gente desde acá?». Se decide en
  un _spike_ cuál es la vista principal.

### 2. Candidatos a atajo (la conclusión accionable)

Minería de **secuencias frecuentes** (n-gramas de 3 a 5 rutas por sesión, función **pura** y
testeada en `src/lib/analytics/`): caminos que **se repiten mucho y terminan en el mismo destino
tras ≥ 2 pasos intermedios**. Cada uno se ordena por `frecuencia × pasos que ahorraría` y se
presenta como una frase: _«El 34 % de las sesiones de usuarios hace Dashboard → Espacios →
Coworking antes de reservar (3 clics, 2 que se podrían ahorrar): candidato a botón "Reservar
coworking" en el dashboard.»_ Con la etiqueta de si **hoy ya hay un atajo** (un enlace directo
existente) para no sugerir lo que ya está. Es la salida más directamente útil del pedido.

### 3. Embudos (dónde se pierde la gente)

Pasos configurables con los eventos de producto; para cada uno, conversión y abandono, partidos
por dispositivo. Embudos iniciales:

- **Reservar:** abrir un espacio → elegir hueco → abrir el diálogo → enviar → confirmada (y el
  código de las que fallan: horizonte, conflicto, baneo…).
- **Inscribirse a un evento:** landing → evento → formulario → enviado → (confirmación por email).
- **Registro de cuenta:** signup → email confirmado → perfil completo (hoy no se sabe cuánta gente
  se queda a medio camino).

### 4. Señales de fricción

- **Callejones sin salida:** páginas con alta tasa de salida que no son finales naturales.
- **Bucles A→B→A→B:** gente rebotando entre dos pantallas (suele ser que no encuentra algo).
- **Errores vistos por la gente:** páginas de error, 403/404, mensajes de validación por campo
  (qué campo del formulario de reserva rompe más; **solo el nombre del campo y el código**, nunca
  el valor).
- **Menú sin uso:** ítems de la barra lateral con muy pocos clics `source=nav` (candidatos a
  reordenarse o eliminarse) y, al revés, enlaces en páginas que sustituyen al menú.

### 5. Contexto de uso

Mapa de calor por **día de la semana y hora**, reparto por dispositivo (mobile vs. escritorio),
sesiones por visita, profundidad. Cruzado con la carga del sistema (milestone 38) sirve para
decidir cuándo desplegar y para dimensionar.

## Capa 2 — Dominio y operación (sin tracking nuevo)

Todo sale de **datos que ya existen**; no requiere medir a nadie.

**Esquema `bi` con _vistas_ SQL** (`bi.reservation_facts`, `bi.event_session_facts`,
`bi.user_cohorts`, …) como **contrato estable** y **sin columnas personales** (nada de email, DNI,
nombre; IDs opacos). Un **rol de Postgres de solo lectura** (`grafana_ro`) con permiso solo sobre `bi`.
Así Grafana (del milestone 38) explora sin tocar tablas operativas ni PII, y si el esquema cambia se
adapta la vista, no el tablero.

Métricas candidatas (ordenadas por valor/costo; las 5 primeras son la «primera tanda»):

1. **Ocupación por espacio y hora** (mapa de calor semana × hora, desde el ledger): cuándo se
   llena y cuándo sobra; base para decidir horarios y aprobaciones.
2. **Lead time y duración de las reservas** (¿con cuánta anticipación se reserva?, ¿cuánto dura?):
   dice si el horizonte de 14 días (milestone 26) alcanza.
3. **Latencia de aprobación** (de pedida a decidida) y **backlog pendiente** por antigüedad: es
   lo que el equipo siente como «lentitud». Con la tasa de **rechazo** y sus motivos.
4. **Cancelaciones y _no-show_:** reservado vs. **efectivamente usado** (cruzando con check-in,
   milestones 30–31). Habilita el **puntaje de uso efectivo** pensado en el futuro, sin construirlo
   ahora.
5. **Conversión de eventos:** inscriptos → aprobados → asistentes, por evento y por tipo, con
   inscripción a lo largo del tiempo (parte ya está en `/admin/reports/events`).
6. **Cohortes de miembros:** altas por mes, **activos** por mes (reservaron o se inscribieron),
   nuevos vs. recurrentes, **tiempo hasta la primera reserva** tras el alta, y cuántos se
   registraron pero nunca usaron nada.
7. **Uso del conector de asistentes (MCP):** llamadas por herramienta, % de reservas con
   `origin = ASSISTANT`, errores por herramienta (milestones 20–21).
8. **Salud del sistema como producto:** emails enviados/fallidos, tasa de registros que no
   confirman el email, aceptación de políticas pendientes, perfiles con pedidos de cambio abiertos.
9. **Crecimiento de datos** (ledger, auditoría, notificaciones): ayuda a decidir retención.

**Dónde se ven:** lo que el staff necesita seguir mirando se **agrega a `/admin/reports`** o a
`/admin/analytics` (con exportación, ya resuelta en el milestone 32); lo exploratorio y de
dimensionamiento va a **tableros de Grafana versionados como código** (`deploy/monitoring/grafana/`).
Regla: **no construir una pantalla nueva para algo que se mira una vez**; empezar por Grafana y
promover a la app solo lo que el staff use de verdad.

## Acceso

- **Staff:** `https://<dominio>/admin/analytics` con el login y el permiso de siempre. No hay nada
  que instalar ni a lo que acceder en el servidor.
- **Superadmin:** Grafana por el túnel SSH (o `ops.<dominio>` con Cloudflare Access), según lo que
  se decida en el milestone 38. Sin esa decisión, la capa 2 en Grafana **depende del 38**; la
  capa 1 **no** depende de él.

## Privacidad (condiciona todo lo anterior)

- **Anónimo por diseño:** ni IP, ni user agent, ni ID de usuario, ni cookies, ni almacenamiento
  persistente; la sesión es un valor aleatorio que muere con la pestaña. Con eso **no se necesita
  banner de cookies** (no hay cookies ni identificadores persistentes), pero sí **decirlo**.
- **Compatible con la política vigente** («estadísticas internas», sin cesión a terceros). Aun así,
  hay que **decidir si conviene publicar una versión aclaratoria** de la política (milestone 19,
  `reacceptance: not-required` si es solo editorial): qué se mide, que es anónimo, cuánto se guarda
  y cómo se desactiva. Aviso para quien decide: la política menciona la Ley de Protección de Datos
  Personales argentina (25.326) y a la AAIP como autoridad; no es una revisión legal, solo un
  recordatorio de consultar si hay duda.
- **Umbral de privacidad k:** no se muestran caminos con menos de N sesiones.
- **No hay análisis individual** en esta versión («qué hizo Fulano»): no se puede, a propósito. Si
  alguna vez hace falta (cohortes de retención por persona), sería **opt-in** y otro milestone.
- Los **agregados** no son personales y se conservan; los **eventos crudos** vencen a los 90 días.

## Qué se toca en el repo (cuando se implemente)

- `src/lib/analytics/` (patrones de ruta, validación, minería de secuencias, umbral k: **todo puro y
  con tests**), `src/components/…/navigation-tracker.tsx`, `src/app/api/analytics/events/route.ts`,
  `src/app/(management)/admin/analytics/` (+ componentes del grafo y del Sankey), `prisma/models/analytics.prisma`
  y una migración (tablas particionadas, rol `grafana_ro` y esquema `bi` en SQL escrito a mano:
  recordatorio: `prisma migrate dev` cuelga y propone re-agregar la FK polimórfica; se aplican con
  `migrate deploy`).
- Permiso `analytics:view` en `src/lib/rbac.ts`, `ADMIN_PATH_PERMISSIONS`, `configNavigation`,
  `SEGMENT_LABELS`, `FORBIDDEN_PERMISSIONS` del conector y seed de roles.
- Cron `analytics-rollup` en `src/app/api/cron/`, `vercel.json`, `deploy/systemd/` y `lanube-cron`.
- Si cambia la política: nuevo archivo en `src/assets/policies/privacy/`, entrada en `registry.ts` y
  su línea en `POLICY_CONTENT`; **nunca** editar la versión publicada.
- **Versionado (milestone 28):** es una funcionalidad nueva → **MINOR** con entrada de changelog.
- **Documentación** en la misma sesión: este doc, `STATUS.md`, `README.md` de milestones, `CLAUDE.md`
  (sección «Analítica») y, si aplica, `deploy/README.md`.

## Fases propuestas

1. **Capa 2 primero (barata, sin tracking):** esquema `bi` + rol de solo lectura + 3–4 tableros
   de Grafana (ocupación, aprobación, eventos, cohortes). Valor inmediato y **no toca privacidad**.
   Depende del milestone 38 (Grafana); si no está, se puede hacer con un cliente SQL por el túnel
   mientras tanto.
2. **Recolección de navegación:** `NavigationTracker`, endpoint, tablas particionadas, rollup y
   retención, política (si se decide). Sin pantalla todavía: dejar acumular datos 2–4 semanas
   (**el grafo sin datos no sirve**: conviene empezar a medir cuanto antes).
3. **`/admin/analytics`:** grafo de rutas, Sankey, candidatos a atajo.
4. **Embudos y señales de fricción** (eventos de producto tipados).
5. **Promover a la app** lo de la capa 2 que el staff pida mirar seguido.

> Ojo con el orden: la fase 2 (recolectar) es la que tiene **tiempo de espera**; como los datos
> tardan en acumularse, se puede adelantar a la fase 1 si se quiere ver el grafo cuanto antes.

## Verificación

- **Tests (vitest):** derivación del patrón de ruta desde `pathname` + `params` (casos con parámetros
  y rutas excluidas con tokens), validación contra la lista cerrada, minería de secuencias y
  puntaje de atajos sobre sesiones sintéticas, umbral k, **contrato de privacidad** (el endpoint y las
  tablas no guardan IP/UA/usuario: se verifica sobre el esquema y sobre una inserción real), registro
  `ANALYTICS_EVENTS` completo, y que `/admin/analytics` exija el permiso (guard test existente).
- **Manual:** recorrer la app con el tracker prendido y ver el grafo; con DNT activo, ver que no se
  envía nada; en modo mantenimiento, ver que no rompe; en una pestaña nueva, ver que el `sessionId`
  cambia; con el endpoint caído, ver que la app sigue igual.
- **Calidad del dato:** una semana de datos, revisar el top de rutas (¿hay patrones basura?, ¿se
  duplican por _prefetch_ o recargas?) y ajustar filtros antes de confiar en los porcentajes.

## Preguntas abiertas (para el usuario)

1. **¿Propio o Umami?** Recomendación: propio y mínimo (permisos de la app, sin otro servicio). Si
   preferís no mantener código de analítica, Umami es el plan B; ¿hacemos un _spike_ de una tarde?
2. **¿Quién debería ver `/admin/analytics`?** Por defecto solo SUPERADMIN; ¿el director o el equipo
   también (un rol nuevo)?
3. **¿Se publica una versión aclaratoria de la política de privacidad?** (qué se mide, anónimo, 90
   días).
4. **¿Medimos también a quien no inició sesión** (sitio público: landing, eventos, espacios,
   noticias)? Es donde más sirve para decidir qué mostrar, pero es lo más sensible.
5. **Umbral k** (N mínimo de sesiones por camino) y **retención cruda** (90 días propuestos).
6. **Eventos de producto iniciales:** ¿los tres embudos de arriba (reservar, inscribirse, registrarse)
   son los correctos?
7. **Capa 2:** ¿te alcanza con Grafana para vos y con lo que ya hay en `/admin/reports` para el
   staff, o querés más pantallas dentro de la app?
8. **¿Vale la pena el grafo o alcanza con la lista de «candidatos a atajo»?** El grafo es la parte
   cara de construir y la más vistosa; la lista es la más accionable. Se pueden entregar en ese
   orden.

## Relaciones

- **Milestone 38 (instrumentación):** comparte Grafana, retención y política de privacidad; el
  rendimiento y el uso se miran en la misma pantalla.
- **Milestone 36/37 (amistades, ideas):** si se hacen, aportan eventos de producto nuevos.
- **Milestone 35 (calendarios sin ruido):** sus decisiones de UI («no abrir modales», acceso del
  Calendario) se pueden **validar con datos** una vez que haya navegación medida.
- **Milestone 31/32 (reportes y exportación):** la exportación y los _snapshots_ se reusan para los
  agregados nuevos.
