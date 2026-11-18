# Milestone 38 — Instrumentación: métricas, trazabilidad y logs

**Estado:** seed (2026-11-18). Propuesta de diseño para discutir; nada implementado. Las decisiones
que necesitan respuesta del usuario están en «Preguntas abiertas».

## Qué pidió el usuario (2026-11-18)

1. **Métricas**, sobre todo de **uso de recursos**.
2. **Trazabilidad** (si se puede).
3. **Logs con sentido** (si no los hay ya), sobre todo de **fallas**.
4. La app corre en un **VPS Ubuntu 24**: hay que pensar **cómo se accede fácil** a las herramientas de
   monitoreo.
5. Lo de recursos **no tiene por qué vivir en la app**: puede ser un _sidecar_ u otro proceso que mire
   la app desde afuera.

## Dónde estamos hoy (verificado en el código, 2026-11-18)

- **Logger propio** (`src/lib/logger.ts`): una línea JSON por evento a `console`. En producción **solo
  emite `error` y `warn`**; `info` queda apagado salvo `LOG_VERBOSE=1`. Sus comentarios hablan del
  _free tier_ de Vercel: ya no aplica (el deploy es el VPS, `deploy/`).
- **`apiCatch`** (`src/lib/api/response.ts`) loguea las fallas de las rutas y nunca le muestra al
  cliente el texto interno. Los error boundaries solo muestran el `digest` de Next.
- **No hay identificador de request**: una línea de log no se puede atar a otra, ni a lo que vio la
  persona, ni al usuario (ni siquiera al ID opaco).
- **No hay métricas ni trazas** de ningún tipo, ni `instrumentation.ts`.
- **Quedan ~13 `console.*` sueltos** fuera del logger.
- **Caddy** escribe `/var/log/caddy/access.log` (se lee a mano con `tail`); los logs de la app se leen
  con `docker compose logs`. Docker no rota logs si no se le pide (hay que verificar `compose.yml`:
  no tiene `logging:`).
- **Nada avisa** si el sitio se cae, si falla un timer (backup, cron de reservas, autodeploy) o si el
  disco se llena. `deploy/README.md` §8 lo reconoce («Monitorización y alertas» y «Notificación de
  fallos de despliegue»). Este milestone cierra esas dos limitaciones.
- `lanube-doctor` revisa el estado **en el momento en que se lo corre**: no guarda historia ni avisa.

## Principios

1. **Lo de recursos se mira desde afuera** (pedido del usuario): el host, los contenedores y Postgres
   se miden con agentes/exportadores que no tocan el código de la app. En la app solo va lo que **solo
   la app sabe** (event loop, pool de Prisma, resultados de emails, cron, rate limits…).
2. **Superficie nueva = cero hacia internet.** Ningún puerto de monitoreo se publica. Recordatorio del
   repo: Docker publica puertos **salteándose UFW**, así que todo va por la red interna de Docker o en
   `127.0.0.1`, nunca `0.0.0.0` (misma regla que `compose.yml`).
3. **No pisar config ajena** (regla de `deploy/`): archivos con nombre propio (`lanube-*`), sin tocar
   los de otro.
4. **Tres señales, una correlación.** Métricas dicen _que_ algo pasa, logs dicen _qué_ pasó, trazas
   dicen _dónde_ se fue el tiempo; las tres comparten `requestId`/`traceId` para saltar de una a otra.
5. **Presupuesto de recursos explícito.** El monitoreo no puede ser lo que tumbe al VPS: cada
   contenedor lleva `mem_limit`/`cpus` y la retención se mide en días, no «para siempre».
6. **Nada de datos personales ni secretos en logs/trazas** (ver «Logs»).

## Stack propuesto (recomendación)

**Grafana + Prometheus + Loki + Tempo, con Grafana Alloy como único recolector**, autoalojado en un
`deploy/monitoring/compose.yml` aparte (se levanta y se baja sin tocar la app).

| Pieza          | Para qué                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Alloy**      | Un solo agente: trae _embebidos_ los exportadores de host (`unix`), contenedores (`cadvisor`), Postgres y _blackbox_; además lee logs de Docker y de Caddy y recibe OTLP de la app. Evita correr 4 exportadores sueltos (y cAdvisor suele pedir privilegios que choca con el endurecimiento del resto: `cap_drop: ALL`). |
| **Prometheus** | Métricas (scrape cada 30 s, retención ~30 días). Es también el motor de **alertas** (con Alertmanager o las reglas de Grafana).                                                                                                                                                                                          |
| **Loki**       | Logs de la app (JSON), de Caddy (access log JSON) y de `journald` (timers, autodeploy, backup). Retención por tipo (ver abajo).                                                                                                                                                                                          |
| **Tempo**      | Trazas OpenTelemetry de la app. Se salta a ellas desde un log (`traceId`) o desde un punto de la métrica (_exemplars_).                                                                                                                                                                                                  |
| **Grafana**    | UI única. Mismo Grafana que usará el milestone 39 para explorar la base (datasource Postgres de solo lectura).                                                                                                                                                                                                           |

**Por qué este y no otro** (alternativas evaluadas):

- **SaaS (Grafana Cloud free, Datadog, Sentry cloud):** cero mantenimiento, pero **sale información
  del servidor** y la política de privacidad dice que no se cede a terceros; además los logs pueden
  tener IPs. Descartado como base; Sentry/GlitchTip queda como opcional para errores de cliente.
- **Netdata / Beszel + Uptime Kuma + Dozzle:** muy livianos y se instalan en minutos; sirven si el
  VPS es muy chico. **Pierden**: sin logs estructurados consultables, sin trazas, sin correlación, y
  son 3 UIs distintas. Es la **alternativa B** si el presupuesto de RAM no da (ver preguntas).
- **OpenObserve / SigNoz:** una sola herramienta para las tres señales; OpenObserve es un binario
  liviano. Menos estándar que el trío Grafana, con menos material para aprender y para pedir ayuda.
  **Alternativa C** si se quiere menos piezas.
- **VictoriaMetrics + VictoriaLogs:** más livianos que Prometheus/Loki, mismas consultas de Grafana.
  Optimización posible **si** el presupuesto de RAM aprieta; no se parte de ahí por ser menos común.

### Presupuesto de recursos (a medir, no a suponer)

Orden de magnitud para este tráfico: Prometheus 150–300 MB, Loki 150–300 MB, Tempo 100–200 MB,
Grafana 100–200 MB, Alloy 80–150 MB → **~0,6–1,2 GB de RAM** y unos GB de disco para ~30 días.
**No sé cuánta RAM tiene el VPS** (no está en `deploy/README.md`): es la primera pregunta abierta. Se
aplican `mem_limit`, `cpus` y `restart: unless-stopped`, y el propio stack se vigila (Alloy y
Prometheus se miden a sí mismos).

## Acceso al monitoreo (pedido del usuario: «que se acceda fácil»)

Hay tres formas, de menos a más expuesta. **Recomendación: A como base y B opcional.**

| Opción                                             | Cómo se entra                                                                                                                                                                            | Superficie nueva                                                                         | Comodidad                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **A. Túnel SSH**                                   | Grafana en `127.0.0.1:3001`; `ssh -L 3001:127.0.0.1:3001 <servidor>` y se abre `localhost:3001`. Se deja un alias en `~/.ssh/config` y un script `lanube-ops-tunnel`.                    | **Ninguna** (SSH ya está restringido: `SSH_ALLOW_FROM`, claves/contraseñas por usuario). | Un comando. Solo desde la máquina de quien tenga SSH (hoy: el superadmin/VPN). |
| **B. `ops.<dominio>` detrás de Cloudflare Access** | URL pública con login (Zero Trust, gratis hasta 50 personas) que Caddy publica con el mismo `X-Origin-Token` y certificado de origen que el sitio. Grafana además tiene su propio login. | Un vhost nuevo, protegido dos veces.                                                     | Desde el celular y sin VPN; es lo cómodo para «mirar qué pasa».                |
| **C. Grafana público con login propio**            | `ops.<dominio>` sin Access.                                                                                                                                                              | Alta (fuerza bruta, CVEs de Grafana).                                                    | — **Descartada.**                                                              |

Reglas comunes: Grafana **sin registro** ni usuarios anónimos, contraseña de admin generada por el
bootstrap (como los demás secretos, en `monitoring.env`, que `lanube-backup` no incluye: hay que
sumarlo a la recomendación de guardar secretos fuera), organización única, y las vistas pensadas para
mirarse **desde el teléfono** (un tablero «Estado» con 6 números grandes).

`lanube-doctor` gana una sección «Monitoreo» (contenedores arriba, puertos solo en loopback, espacio
de los volúmenes de Prometheus/Loki/Tempo).

## Métricas

### 1. Host (desde afuera: Alloy `unix`)

CPU (uso, _steal_, _iowait_), carga, RAM (usada/disponible, **swap**, presión PSI), **disco** de `/`
y de `/data` (uso, **crecimiento por día**, inodos, I/O), red, descriptores de archivo, reinicios y
_uptime_. Estado de **unidades systemd** (`lanube-*`: backup, cron, autodeploy,
cloudflare-ips): colector `systemd` del exportador.

**Últimos éxitos de las tareas programadas** (para alertar cuando _no_ corrió): un _textfile collector_
donde `lanube-backup`, `lanube-cron` y `lanube-deploy` escriben, al terminar, `lanube_job_last_success_timestamp{job="…"}`
y `lanube_job_duration_seconds`. Son 2–3 líneas de shell por script. Es lo que cierra el hueco «falla
un timer y nadie se entera».

### 2. Contenedores (Alloy `cadvisor`)

Por contenedor (`app`, `postgres`, y los de monitoreo): CPU, RAM vs límite, **OOM kills**, reinicios,
red, I/O de disco. Alerta de «el contenedor se reinició» y «la RAM de `app` supera el 85 % del límite
sostenida».

### 3. PostgreSQL (Alloy `postgres`)

Conexiones usadas vs `max_connections`, tasa de _commits/rollbacks_, **_cache hit ratio_**, bloqueos
y **_deadlocks_**, transacciones largas, tamaño de la base y de las tablas más grandes (las de
`ReservationLedger`, `audit_logs`, `notifications`, `rate_limits` merecen una mirada propia: son las
que crecen), _autovacuum_/_bloat_, y **consultas lentas** con `pg_stat_statements` (se habilita en
`postgres.env`/comando; incluye `log_min_duration_statement=500ms` para que las lentas lleguen a
Loki). Útil también para dimensionar: el ledger y las funciones SQL de reservas son el punto caliente
conocido (milestones 12 y 25).

### 4. HTTP (sin tocar la app: access log de Caddy → Loki)

Caddy ya ve cada request. Pasando su log a **JSON** (`log { format json }`) y leyéndolo con Alloy se
obtienen, **sin una línea en la app**: tasa por ruta, % de 4xx/5xx, latencia p50/p95/p99, tamaño de
respuesta, user agents de bots, y el ruteo de Cloudflare (`cf-ray`). Alloy lo convierte en métricas
(`loki.process` + `stage.metrics`) con **rutas normalizadas** (`/user/spaces/:slug`, nunca la URL con
IDs: cardinalidad). Es la fuente de las métricas RED y de la latencia del sitio **público**, que es
estático/ISR y casi nunca pasa por código propio (milestone 25).

### 5. La app (solo lo que solo ella sabe)

Un endpoint de métricas **que no pasa por Caddy ni por el middleware**: en `instrumentation.ts`
(`register()`, runtime Node) se levanta un **servidor HTTP mínimo en otro puerto (p. ej. 9464)**, sin
publicarlo, accesible solo por la red interna de Docker. Así no lo toca el _gate_ de mantenimiento
(milestone 22) ni hace falta autenticarlo. Debe protegerse contra el doble registro del modo dev/HMR.

Métricas (`prom-client` o el SDK de OpenTelemetry; ver «Preguntas»):

- **Proceso Node:** _lag_ del event loop, heap, GC, handles activos.
- **Pool de Prisma/`pg`:** conexiones activas/esperando, tiempo de espera, errores. Es la métrica que
  explica un «se congeló» (precedente: el congelamiento del milestone 25).
- **Dominio técnico (contadores/histogramas con pocas etiquetas):**
  `lanube_emails_sent_total{kind,result}` y su duración (SMTP caído = la falla más probable);
  `lanube_notify_total{channel,result}`; `lanube_rate_limit_blocked_total{endpoint}`;
  `lanube_cron_runs_total{job,result}` y `lanube_cron_duration_seconds{job}`;
  `lanube_mcp_tool_calls_total{tool,result}`; `lanube_auth_signin_total{result}`;
  `lanube_maintenance_gate_blocked_total`; `lanube_audit_write_failures_total` (el _pipe_ de auditoría
  «nunca tira», así que hoy sus fallas no se ven); `lanube_reservation_sql_duration_seconds{fn}` para
  `create_reservation`/`approve_reservation`.
- **Build:** `lanube_build_info{version,commit}` (ya existe `src/lib/build-info.ts`) para ver desde
  qué versión empezó un problema y **marcar los despliegues** en los gráficos.

**Regla de cardinalidad:** etiquetas solo de conjuntos cerrados (tool, kind, endpoint, resultado). Nunca
`userId`, email, slug, URL cruda ni mensaje de error como etiqueta.

### 6. Disponibilidad desde afuera (_blackbox_)

Sondas de Alloy `blackbox` contra la URL **pública** (pasando por Cloudflare, no `localhost`):
`/api/maintenance` (liviana, ya sugerida en el README), `/` y `/api/version` (¿versión esperada?), con
duración por fase y **vencimiento del certificado**. Y la limitación inevitable: **un monitor que vive
en el mismo servidor no avisa si el servidor se cae**. Por eso se agrega un monitor **externo**
(UptimeRobot/BetterStack gratis, o un Uptime Kuma en otra máquina) apuntado a la URL pública, más un
_heartbeat_ saliente (_dead-man's switch_) que el servidor emite cada N minutos y cuyo silencio avisa.
Es una dependencia de terceros **mínima y sin datos de usuarios** (solo «¿responde?»): se menciona en
«Preguntas».

## Alertas

Pocas, accionables y con un destino claro; cada alerta lleva un enlace al tablero y la sugerencia de
qué mirar. Propuesta inicial:

| Alerta                | Condición (aprox.)                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Sitio caído           | sonda pública falla 3 veces seguidas (2 min) — la dispara el monitor **externo**                 |
| Disco `/data`         | > 80 % o llena en < 7 días al ritmo actual                                                       |
| RAM / swap / OOM      | RAM disponible < 10 % 10 min, swap en uso sostenido, cualquier OOM kill                          |
| Contenedor reiniciado | `app` o `postgres` reiniciaron                                                                   |
| Errores 5xx           | > 2 % de requests 10 min, o ≥ N 5xx en 5 min                                                     |
| Latencia              | p95 de rutas dinámicas > 2 s 10 min                                                              |
| Postgres              | conexiones > 80 % de `max_connections`, _deadlock_, transacción > 5 min                          |
| **Backup**            | `lanube_job_last_success_timestamp{job="backup"}` con más de 26 h                                |
| **Cron**              | `maintain-reservations` sin éxito en 26 h (es un **requisito de correctitud**, ver CLAUDE.md §4) |
| **Autodeploy**        | falló un despliegue o se hizo _rollback_ (cierra la limitación de §8)                            |
| SMTP                  | tasa de fallo de emails > 20 % o `assertMailerAvailable` fallando                                |
| Certificado           | vence en < 14 días                                                                               |

**Destino de los avisos:** abierto (ver preguntas). Importante: **no depender solo del email del
propio sistema** — si SMTP es lo que falla, la alerta de SMTP nunca llegaría. Se recomienda un canal
independiente (ntfy, Telegram o similar) con email como respaldo.

## Logs

### Qué cambia respecto del logger actual

1. **Contexto de request con `AsyncLocalStorage`.** Se abre en el borde de cada request (un _wrapper_
   de rutas y el middleware, que fija `x-request-id`; si viene de Caddy se reutiliza, si no se genera)
   y el logger **agrega solo** `requestId`, `route` (patrón, no la URL), `method`, y el **ID opaco**
   del usuario si hay sesión. Cualquier `logger.*` desde cualquier capa (DB, email, MCP) queda
   atado a su request sin pasar argumentos.
2. **El `requestId` vuelve al cliente** (`x-request-id` en la respuesta y, en los errores del envelope
   `apiError`, un campo `requestId`; el `ErrorBoundaryScreen` muestra el `digest` **y** ese ID).
   Cuando alguien escriba «me dio error», con ese código se llega al log exacto.
3. **Esquema estable de cada línea:** `ts` (ISO), `level`, `msg`, `service`, `version`/`commit`,
   `requestId`, `traceId`/`spanId` (si hay traza), `route`, `method`, `status`, `durationMs`, `userId`
   (opaco), `code` (código de dominio, p. ej. `POLICIES_PENDING`, `EDIT_LINK_GONE`) y `err`
   `{name, message, stack, cause}`. Los mensajes son **constantes** y lo variable va en campos: así
   se agrupan y se alertan.
4. **Niveles con criterio (`LOG_LEVEL`, reemplaza a `LOG_VERBOSE`)**: `error` = algo falló y no estaba
   previsto; `warn` = falló y estaba previsto/degradó (SMTP, rate limit, 403/409 de dominio
   inesperados); `info` = **eventos de negocio y de operación definidos** (no ruido): inicio y fin de
   cada cron con duración y conteos, despliegue/arranque con versión, ventana de mantenimiento
   iniciada/terminada, decisión sobre una reserva, grant OAuth creado/revocado; `debug` = apagado en
   prod. En producción `info` se activa de fábrica pero acotado a ese catálogo.
5. **Logs de fallas completos** en todos los caminos que hoy se tragan el error: `after()` (emails
   posteriores al commit), `notify()`, `recordAudit`/`emitAudit` («nunca tiran» ⇒ **siempre loguean**),
   los _fan-out_ de emails de eventos, el MCP (`DomainError` → resultado `isError`, ahí falta la
   línea de log con `tool`), y los `catch` vacíos que haya (hay que auditarlos: es parte del trabajo).
6. **Errores no capturados:** `instrumentation.ts` exporta **`onRequestError`** (Next 15), que recibe
   cada error de render/route handler con su `digest` y la ruta: se loguea con el **mismo `digest`
   que ve la persona** en pantalla. Más `process.on('unhandledRejection' | 'uncaughtException')`
   (log + métrica + salida controlada para que Docker reinicie).
7. **Errores del navegador (opcional, fase aparte):** los error boundaries mandan un reporte mínimo
   (mensaje, `digest`, ruta, versión) a `POST /api/client-errors` (con `checkRateLimit`, sin datos
   personales, tamaño máximo), que lo escribe como `warn`. Sin esto, un fallo solo-cliente es
   invisible.
8. **Consultas lentas:** eventos de Prisma con umbral (> 500 ms) como `warn` con el nombre de la
   operación (nunca los parámetros), más `log_min_duration_statement` en Postgres.
9. **Se acaba el `console.*` suelto:** regla de ESLint `no-console` (excepto en `logger.ts`) y un test
   que la fija, igual que el repo hace con otras invariantes.
10. **Redacción obligatoria:** el logger elimina por nombre de campo (`password`, `token`,
    `authorization`, `cookie`, `secret`, `code`, `hash`, `dni`, `email`…) y **nunca** registra cuerpos
    de request ni de respuesta. Test de contrato con casos de campos anidados. El email **no** se
    loguea (se usa el ID opaco); en los pocos lugares donde hoy se loguea hay que sacarlo.

### Destino, rotación y retención

- Docker `logging: { driver: json-file, options: { max-size: "20m", max-file: "5" } }` en todos los
  servicios de `compose.yml` (hoy sin límite: un servicio ruidoso puede llenar `/data`). **Esto se
  puede hacer sin esperar al resto del milestone** y es la parte de mayor valor por menor costo.
- Loki con retención **por tipo**: app y `journald` 30 días, **access log de Caddy 14 días** (tiene
  IPs; ver privacidad), errores 90 días.
- Se mantiene `docker compose logs` y `journalctl` como forma de leer **sin** el stack nuevo
  (`lanube-doctor` sigue siendo la herramienta de emergencia).

### Privacidad

Los logs de app llevan un **ID opaco**, nunca email, DNI ni nombre. El **access log de Caddy tiene IP**
(la real, vía `cf-connecting-ip`) y user agent. La política de privacidad vigente (`2025-11-16`)
admite «mecanismos de registro adicional (por ejemplo, dirección IP, cookies o identificadores
técnicos) exclusivamente con fines de seguridad, autenticación y análisis estadístico» y no cede
datos a terceros: **es compatible**, pero hay que decidir si alcanza o si conviene publicar una
versión nueva (mecanismo del milestone 19, `reacceptance: not-required` si es solo aclaratoria) que
diga **qué se registra y por cuánto tiempo**. Mitigaciones de diseño: retención corta de IPs,
truncado del último octeto en el log que se retiene más de 14 días, y Loki/Grafana sin acceso fuera
del superadmin.

## Trazabilidad (trazas distribuidas)

**Qué es realista acá:** un solo servicio y una sola base, así que la traza útil es **dentro de la
app**: request → _handler_ → consultas SQL → SMTP/`fetch`. El valor es ver **dónde se va el tiempo**
de una reserva lenta o de la aprobación de una con conflictos, no seguir un microservicio.

- **OpenTelemetry** desde `instrumentation.ts` (`@vercel/otel` o `@opentelemetry/sdk-node`; a
  decidir en el _spike_): auto-instrumentación de `http`/`fetch`, de Prisma (`@prisma/instrumentation`,
  que genera un span por consulta) y de `pg`. Export **OTLP** a Alloy → Tempo.
- **Spans manuales** (pocos, con nombre estable) en lo que importa: `reservation.create`,
  `reservation.approve` (con `autoRejected` como atributo), el _fan-out_ de notificaciones, cada
  `mcp.tool`, cada cron, el envío de cada email y las funciones SQL críticas. **Sin atributos
  personales.**
- **Correlación:** `traceId` en cada línea de log (ver arriba) y `x-request-id` = `traceId` cuando hay
  traza. En Grafana: de un error en Loki a su traza en Tempo con un clic, y de un pico de latencia
  a sus trazas más lentas (_exemplars_).
- **Muestreo:** a este volumen se puede arrancar con **100 %** y bajar a 10–20 % si el costo en CPU/
  disco molesta; las trazas con error o lentas se conservan siempre (_tail sampling_ en Alloy).
  Retención corta (7 días).
- **Alcance de traza distribuida:** el navegador no se instrumenta (no hay _web SDK_); a lo sumo se
  pasa `traceparent` en los `fetch` de `apiGet/apiSend` para atar el request del cliente. Cloudflare y
  Caddy no propagan trazas: la traza **nace en la app**, el `cf-ray` queda como atributo.
- **Marcador de despliegues:** `lanube-deploy` registra una anotación (Grafana API o una métrica
  `deploy_info`) con la versión y el _sha_, para correlacionar «empezó con el 1.6.0».

## Cómo se instala y se opera (`deploy/`)

- `deploy/monitoring/` con `compose.yml`, `alloy.river` (config), `prometheus/rules/*.yml` (alertas),
  `grafana/provisioning/` (datasources y tableros **como código**, versionados) y `monitoring.env.example`.
- **Provisionamiento:** un paso nuevo y **opcional** en el _bootstrap_ (o `03-monitoring.sh`), que
  respeta «no pisar config ajena»: archivos de nombre propio, vhost de Caddy con marca, reglas UFW
  identificables por comentario. Re-ejecutable.
- **Versión fijada por _digest_/tag** de cada imagen (la limitación de «etiquetas mutables» de
  `deploy/README.md` §8 aplica igual) y actualización manual documentada en «Mantenimiento periódico».
- **Tableros iniciales (como código):** _Estado_ (el de 6 números para el teléfono), _Host_,
  _Contenedores_, _Postgres_, _App/HTTP_ (RED), _Tareas programadas_, _Logs de errores_.
- **Documentación:** nueva sección en `deploy/README.md` («Monitoreo»), actualización de §7 y §8, y un
  bloque en `CLAUDE.md` (sección «Instrumentación»).

## Fases propuestas

Cada fase se entrega sola y deja valor aunque no se llegue a la siguiente.

0. **Logs sin infra nueva** (rápido, alto valor): `requestId` + `AsyncLocalStorage`, esquema y
   niveles, redacción, `onRequestError` y _handlers_ globales, auditoría de `catch` silenciosos,
   `no-console`, **rotación de logs de Docker**, access log de Caddy en JSON, `requestId` en
   errores y pantallas de error. Actualizar el comentario obsoleto de Vercel en `logger.ts`.
1. **Métricas externas + alertas + acceso:** stack con Alloy/Prometheus/Grafana, host + contenedores +
   Postgres + _blackbox_, textfile de tareas programadas, alertas, acceso A (túnel) y, si se decide,
   B (Cloudflare Access). Monitor externo. Sección en `lanube-doctor`.
2. **Loki:** logs de app, Caddy (con métricas RED derivadas) y `journald`; tablero de errores.
3. **Métricas de la app:** servidor de métricas interno, pool, dominio técnico, `build_info`.
4. **Trazas:** OpenTelemetry, spans manuales, Tempo, correlación, marcadores de despliegue.
5. **(Opcional)** reporte de errores del navegador.

## Qué se toca en el repo (cuando se implemente)

- `src/lib/logger.ts` (contexto, esquema, niveles, redacción), nuevo `src/instrumentation.ts`,
  `src/lib/observability/` (contexto de request, métricas, trazas), `src/lib/api/response.ts`
  (`requestId` en el envelope), `ErrorBoundaryScreen`, ESLint.
- `src/middleware.ts`: fijar `x-request-id`. Ojo con el _gate_ de mantenimiento (milestone 22): el
  middleware ya corre para `/api/**`; el endpoint de métricas va por **otro puerto** justamente para
  no depender de él.
- `deploy/`: `compose.yml` (logging), `monitoring/`, `caddy/` (log JSON), scripts de tareas
  (`lanube-backup`, `lanube-cron`, `lanube-deploy` escriben el textfile), `lanube-doctor`,
  `systemd/` si se agrega alguno, y `deploy/README.md`.
- **Versionado (milestone 28):** lo que llega al servidor lleva _bump_ + entrada de changelog
  (`RELEASES` + `src/assets/changelog/<versión>.md`). Verificar si `deploy/` entra en `APP_PATHS`
  (`scripts/check-release.ts`); si no entra, los cambios solo de infra no fuerzan versión. Esperable:
  la fase 0 es **MINOR** (`x-request-id` visible, mensajes de error con código) o **PATCH** si se
  considera interno.
- **Documentación** (misma sesión que cada cambio): este doc, `STATUS.md`, `README.md` de milestones,
  `CLAUDE.md` y `deploy/README.md`.

## Verificación

- **Tests (vitest):** redacción de campos (anidados, arrays), esquema de la línea, propagación del
  `requestId` por `AsyncLocalStorage` entre `await`s, normalización de rutas para etiquetas, que
  `no-console` falle ante un `console.log` nuevo, y que el servidor de métricas no se registre dos veces.
- **Manual:** provocar un 500 y encontrar su línea por `requestId` y su traza; parar SMTP y ver subir
  `lanube_emails_sent_total{result="error"}` y disparar la alerta; llenar un volumen de prueba; matar
  `app` y ver el reinicio; correr `lanube-backup` y ver el textfile; apagar el servidor y comprobar que
  **el monitor externo** avisa.
- **Costo:** medir CPU/RAM/disco del stack una semana y ajustar retención y muestreo antes de dar la
  fase por cerrada. Documentar el número real.

## Preguntas abiertas (para el usuario)

1. **¿Cuánta RAM/CPU/disco tiene el VPS?** Decide entre el stack completo (recomendado) y la
   alternativa liviana (Netdata/Beszel + Uptime Kuma + Dozzle, o VictoriaMetrics).
2. **¿Cómo querés acceder?** A (túnel SSH) como base; ¿sumamos B (`ops.<dominio>` con Cloudflare
   Access) para mirar desde el celular?
3. **¿Adónde llegan las alertas?** ¿ntfy/Telegram/email? ¿A quién? (No depender solo del SMTP propio.)
4. **¿Aceptás un monitor externo** (UptimeRobot/BetterStack gratis o un Kuma en otra máquina)? Es la
   única forma de enterarse de que el servidor entero está caído.
5. **Privacidad:** ¿alcanza la política `2025-11-16` para IPs en el access log con retención de 14
   días o publicamos una versión aclaratoria (milestone 19)?
6. **Métricas de la app:** `prom-client` (simple, solo métricas) vs **OpenTelemetry para todo**
   (métricas + trazas con un solo SDK). Recomendación: OpenTelemetry, para no tener dos sistemas.
7. **¿Reporte de errores del navegador** en esta tanda o más adelante?
8. **¿Quién ve esto?** Hoy solo el superadmin con acceso SSH; si más personas, Grafana con roles.

## Relaciones

- **Milestone 39 (BI y rutas calientes):** reusa este Grafana (datasource Postgres de solo lectura) y
  comparte la política de privacidad y retención; las métricas de uso sirven también para dimensionar.
- **Milestone 22 (mantenimiento):** el servidor de métricas y las sondas no deben depender del _gate_;
  el _blackbox_ debe distinguir un 503 `MAINTENANCE` (esperado) de una caída.
- **Milestone 25 (rendimiento/seguridad):** las métricas dan los números que ese milestone midió a
  mano (congelamiento, consultas lentas).
- **Milestone 28 (versionado):** `lanube_build_info` y los marcadores de despliegue.
