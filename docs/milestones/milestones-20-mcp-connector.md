# Milestone 20 — Conector MCP: "traé tu propio asistente"

**Estado:** **implementado (2026-10-04)** en `preview`, slices 1–5; falta la slice 6 (probar de
punta a punta con Claude web y ChatGPT contra un deploy público — ver
[Implementación](#implementación-2026-10-04)). Diseño del mismo día; depende del milestone 19
(el gate de políticas aplica también acá). Las decisiones que estaban **(abierta)** se
cerraron con la recomendación del diseño (ver "Decisiones cerradas").
**Tipo:** feature — integración externa + autorización (La Nube pasa a ser un servidor
OAuth).

## Pedido

Textual del usuario (2026-10-04), traducido:

> No es prioridad, pero me gustaría que los usuarios "traigan su propio asistente de IA"
> (Claude, ChatGPT, etc.), ofreciendo un endpoint MCP que puedan configurar. Por ejemplo, en
> Claude van a la web → conectores → agregar MCP personalizado, y listo. Por ahora solo
> funcionalidad básica: solicitar una reserva y cancelar una reserva.

## Contexto encontrado

- **La lógica de reservar y cancelar vive en el route handler**, no en una función de
  dominio: `src/app/api/resources/[spaceId]/route.ts` (`POST` y `DELETE`) hace la
  validación (grilla de 15 min, no en el pasado, 24 h de anticipación con
  `hasMinimumNotice`, ventana horaria con `checkBookingWindow`, tipo de reserva válido) y
  recién después llama a `createReservation()` / `createReservationException()` /
  `deleteReservation()`. Un segundo cliente (MCP) que llamara a `createReservation()`
  directo **se saltearía todas esas reglas**. → Prerrequisito: extraerlas (§5).
- `requireActiveSession()` (`src/lib/api-auth.ts`) resuelve la identidad desde la cookie de
  NextAuth. MCP no tiene cookie: trae un `Authorization: Bearer`. Hace falta un guard
  hermano que resuelva el usuario desde un token y aplique **las mismas** condiciones
  (perfil completo, no baneado, políticas aceptadas).
- El ingreso (`auth/signin/page.tsx`) **no respeta `callbackUrl`** hoy. El flujo OAuth
  necesita "ingresá y volvé a la pantalla de autorización". → Prerrequisito chico.
- El middleware no matchea `/api/**` ni `/.well-known/**`: no estorba a los endpoints de
  OAuth/MCP.
- Los tokens de alta entropía ya tienen un patrón en el repo: los códigos de recuperación
  (milestone 17) se guardan con SHA-256 (no bcrypt) porque su entropía lo permite. Los
  tokens de OAuth siguen ese mismo criterio.

### Estado del protocolo (verificado el 2026-10-04)

- La revisión vigente de MCP es la **2026-07-28**, que hizo el protocolo **sin estado**
  (sin `initialize` ni `Mcp-Session-Id`). Encaja con funciones serverless de Vercel: cada
  request es independiente.
- Autorización: el servidor MCP es un **resource server OAuth 2.1** (PKCE obligatorio),
  descubrible por **Protected Resource Metadata (RFC 9728)** y un `401` con
  `WWW-Authenticate`. El registro de clientes preferido pasó a ser **Client ID Metadata
  Documents (CIMD)**; **Dynamic Client Registration (RFC 7591) quedó deprecado** en esa
  revisión, con una ventana de al menos 12 meses.
- Claude (web → Conectores → "Agregar conector personalizado") soporta OAuth con DCR, con
  CIMD, y sin autenticación. OAuth solo es necesario si el conector toca datos privados —
  que es el caso.
- Fuentes: [Claude — autenticación de conectores](https://claude.com/docs/connectors/building/authentication),
  [Anthropic — conectores personalizados vía MCP remoto](https://support.anthropic.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers).
  **Volver a verificar al implementar**: el SDK de MCP elegido tiene que soportar la
  2026-07-28.

## Diseño

### 1. Forma general

```
Asistente (Claude/ChatGPT)                      La Nube
──────────────────────────                      ───────
POST /api/mcp  (sin token) ───────────────────► 401 + WWW-Authenticate: resource_metadata=…
GET /.well-known/oauth-protected-resource ────► { authorization_servers: [https://lanube…] }
GET /.well-known/oauth-authorization-server ──► endpoints, PKCE S256, CIMD/DCR soportados
(CIMD: client_id = URL de su metadata; DCR: POST /api/oauth/register)
navegador → /oauth/authorize?…&code_challenge=… ► (ingresa si hace falta) pantalla de consentimiento
                                                  «Claude quiere: ver tus reservas, pedir y cancelar»
                                    ◄─────────── redirect con ?code=…
POST /api/oauth/token (code + verifier) ──────► access_token (1 h) + refresh_token (30 d, rota)
POST /api/mcp  Authorization: Bearer … ───────► tools
```

**La Nube es su propio servidor de autorización** **(propuesta)**: el usuario ya tiene
cuenta acá (contraseña/passkey), y delegar a un tercero (Auth0, WorkOS, Clerk) significaría
duplicar identidades o federar NextAuth hacia afuera, que es más trabajo que un AS mínimo.
"Mínimo" quiere decir: authorization code + PKCE S256 + refresh token, nada de
`client_credentials`, `implicit`, ni OpenID Connect.

**¿Librería o a mano?** **(abierta, recomendación: a mano + SDK solo para MCP)**.

- `oidc-provider` es completo pero pesado, con su propio modelo de sesión y almacenamiento,
  y choca con NextAuth.
- Las piezas de OAuth que hacen falta son ~4 endpoints chicos y bien especificados; el
  riesgo está en los detalles (PKCE, validación exacta de `redirect_uri`, rotación de
  refresh, códigos de un solo uso) y se cubren con tests.
- Para el transporte MCP: el SDK oficial de TypeScript (`@modelcontextprotocol/sdk`) o
  `mcp-handler` de Vercel (adaptador para Next.js), el que soporte la revisión 2026-07-28.

### 2. Modelo de datos

```prisma
model OAuthClient {            // un asistente que se registró (DCR) o que conocimos por CIMD
  id            String   @id @default(cuid(2))
  clientId      String   @unique   // DCR: generado; CIMD: la URL del documento
  kind          OAuthClientKind    // DCR | CIMD
  name          String             // "Claude", tal como lo declara — se muestra con cautela (§6)
  redirectUris  String[]
  logoUri       String?
  createdAt     BigInt
  metadataFetchedAt BigInt?        // CIMD: cache del documento
}

model OAuthGrant {             // "la usuaria X autorizó al cliente Y con estos scopes"
  id          String   @id @default(cuid(2))
  userId      String             // → User
  clientId    String             // → OAuthClient
  scopes      String[]
  createdAt   BigInt
  lastUsedAt  BigInt?
  revokedAt   BigInt?
  @@unique([userId, clientId])
}

model OAuthAuthorizationCode { // un solo uso, 60 s
  codeHash      String  @id      // sha256
  grantId       String
  redirectUri   String
  codeChallenge String           // S256
  scopes        String[]
  expiresAt     BigInt
  usedAt        BigInt?
}

model OAuthToken {
  id               String  @id @default(cuid(2))
  grantId          String
  accessTokenHash  String  @unique   // sha256
  refreshTokenHash String? @unique
  accessExpiresAt  BigInt            // +1 h
  refreshExpiresAt BigInt?           // +30 d
  replacedById     String?           // rotación de refresh
  revokedAt        BigInt?
}
```

- Tokens **opacos** (256 bits aleatorios) y guardados solo como hash. No JWT: con tokens
  opacos, revocar es borrar/marcar una fila y el chequeo de baneo/políticas igual requiere ir
  a la base en cada llamada.
- **Detección de reuso de refresh token**: si llega un refresh ya rotado, se revoca toda la
  cadena del grant (patrón estándar de OAuth 2.1 para clientes públicos).
- Limpieza: el cron diario (`maintain-reservations`, o uno propio) borra códigos y tokens
  vencidos hace más de N días.

### 3. Scopes y herramientas

Scopes **(propuesta)**: `reservations:read` y `reservations:write`. Se piden juntos en la
práctica, pero separarlos deja la puerta abierta a "solo consultar".

Herramientas. El pedido es **pedir** y **cancelar**; para que un asistente pueda hacer eso
necesita saber qué espacios hay, qué horarios están libres y qué reservas tiene el usuario
(para obtener el id a cancelar). Las tres de lectura son **soporte mínimo**, no
funcionalidad extra:

| Tool                   | Scope | Qué hace                                                                                                    | Anotaciones       |
| ---------------------- | ----- | ----------------------------------------------------------------------------------------------------------- | ----------------- |
| `list_spaces`          | read  | Espacios reservables: id, nombre, capacidad, horario de apertura. Reusa `getReservableSpaces()`.            | `readOnlyHint`    |
| `get_availability`     | read  | Huecos libres de un espacio en un rango (máx. 14 días). Reusa `getUnavailableSlots()` + la ventana horaria. | `readOnlyHint`    |
| `list_my_reservations` | read  | Reservas futuras del usuario (id, espacio, inicio/fin, estado, si es recurrente).                           | `readOnlyHint`    |
| `request_reservation`  | write | Pide una reserva. Queda **PENDIENTE** de aprobación del admin, igual que desde la web.                      | —                 |
| `cancel_reservation`   | write | Cancela una reserva propia, o una ocurrencia de una recurrente.                                             | `destructiveHint` |

Detalles:

- **Las reglas son las mismas que en la web, porque son el mismo código** (§5). Los mensajes
  de error vuelven como resultado de tool con `isError: true` y el texto en castellano que
  hoy ve el usuario ("Las reservas deben empezar y terminar en intervalos de 15 minutos"),
  así el asistente puede corregirse solo.
- **Fechas**: la entrada es ISO 8601 **con offset obligatorio** (`2026-10-10T14:00:00-03:00`);
  sin offset → error explicando el formato. La salida da ISO con el offset del predio
  (America/Argentina/Buenos_Aires) y además un texto `es-AR` ("viernes 10/10, 14:00–16:00"),
  coherente con la regla de fechas del proyecto.
- **El humano en el medio ya existe**: `request_reservation` no confirma nada, crea una
  solicitud PENDIENTE que un admin aprueba. Es la mitigación natural de "el asistente
  entendió mal".
- **`cancel_reservation` es irreversible**: `destructiveHint` hace que los clientes pidan
  confirmación. La descripción de la tool le pide al modelo confirmar con el usuario
  mostrando espacio y horario antes de llamar.
- **Sin herramientas para eventos, inscripciones, perfil, ni nada admin**, aunque el usuario
  tenga permisos de admin: el conector actúa como "usuario común" sobre sus propias
  reservas, y nada más. Ampliarlo es otro milestone.

### 4. Guard del endpoint MCP

`requireMcpUser(request, scope)` en `src/lib/mcp/auth.ts`:

1. `Authorization: Bearer <token>` → hash → `OAuthToken` vigente, no revocado, grant no
   revocado, scope incluido. Si no → `401` con `WWW-Authenticate` (RFC 9728) o `403
insufficient_scope`.
2. Usuario: `RegisteredUser` existente (perfil completo), **sin baneo activo**, **sin
   políticas pendientes** (milestone 19, misma función `pendingPolicies`). Estos tres fallos
   se devuelven **como resultado de tool con error legible**, no como 401: un 401 haría que
   el cliente reintente el OAuth en loop, cuando lo que hace falta es que el usuario entre a
   la web. Ej.: «Antes de seguir, aceptá las políticas actualizadas en https://…/policies/accept».
3. Actualiza `grant.lastUsedAt` (como mucho una vez por minuto, para no escribir en cada
   llamada).

**Rate limit** con el `checkRateLimit()` existente, por usuario: p. ej. 60 llamadas/min de
lectura y 10 escrituras/hora **(propuesta)**. Un asistente en loop no debe poder llenar el
calendario de solicitudes.

### 5. Prerrequisito: reglas de reserva como dominio

Extraer de `api/resources/[spaceId]/route.ts` a `src/lib/reservations/user-actions.ts`:

```ts
requestUserReservation(userId, { spaceId, startMs, endMs, reason, eventType }) → Reservation
cancelUserReservation(userId, { reservationId, occurrenceStartMs? }) → void
```

que tiran `DomainError` (convención existente) con los mismos mensajes. El route handler
queda como parseo + llamada + `apiCatch`; el handler MCP igual. Tests unitarios de las
reglas que hoy no tienen (grilla, pasado, anticipación, ownership). Este slice tiene valor
por sí solo aunque el MCP no se haga nunca.

### 6. Consentimiento y gestión por el usuario

**`/oauth/authorize`** (página, dentro del matcher del middleware para heredar
ingreso/baneo/gate de políticas):

- Si no hay sesión → `/auth/signin?callbackUrl=<authorize con sus parámetros>` (requiere el
  prerrequisito de `callbackUrl`).
- Valida `client_id`, `redirect_uri` (**coincidencia exacta** con las registradas),
  `code_challenge_method=S256`, `response_type=code`, `state`, y `resource` (debe ser la URL
  de `/api/mcp`). Si `client_id` o `redirect_uri` no validan → error en pantalla, **nunca**
  redirect (evita open redirect).
- Pantalla: «**Claude** quiere acceder a tu cuenta de La Nube» con la lista de lo que podrá
  hacer en castellano llano («Ver tus reservas», «Pedir reservas en tu nombre», «Cancelar
  tus reservas»), el dominio del `redirect_uri` visible, y «Permitir» / «Cancelar».
  - El nombre del cliente lo declara el propio cliente: se muestra junto al **dominio**
    de su `redirect_uri`/CIMD, que es lo único verificable. **(propuesta)** Sin lista de
    clientes "verificados" por ahora.
- Si ya existe un grant vigente con los mismos scopes, se puede saltear la pantalla
  **(abierta)** — recomendado no saltearla en la primera versión.

**Configuración → Seguridad** (milestone 17): sección nueva «Asistentes conectados» con cada
grant (nombre + dominio, permisos, conectado el…, último uso) y «Desconectar» (revoca grant
y tokens). Y un bloque «Conectar un asistente» con la URL a pegar
(`https://<host>/api/mcp`, con `CopyField`) e instrucciones de dos líneas para Claude y
ChatGPT. **Esa URL es lo único que el usuario tiene que saber.**

**Admin**: sin pantalla nueva en esta pasada. **(abierta)** si conviene marcar las reservas
creadas por un asistente (`Reservation.createdVia: WEB | MCP` + nombre del cliente) para que
el admin lo vea al aprobar — recomendado, es una columna y un chip.

**Baneo / cambio de contraseña**: el baneo ya corta todo vía §4. **(abierta)** si cambiar la
contraseña o canjear un código de recuperación debe revocar todos los grants (recomendado:
sí, es lo que se espera tras un "me robaron la cuenta").

### 7. Seguridad — lista de chequeo

- PKCE S256 obligatorio; `plain` rechazado.
- `redirect_uri` exacto; en CIMD, el documento se trae con protección SSRF (solo `https`,
  sin IPs privadas/loopback, timeout corto, tamaño máximo, cache con TTL) y su `client_id`
  tiene que ser igual a la URL de la que se trajo.
- Códigos de autorización de un solo uso y 60 s; un segundo uso revoca los tokens emitidos
  con él.
- Tokens solo por header (nunca en query string), solo hash en la base, nunca en logs
  (convención de `logger`).
- Audiencia: los tokens se emiten para el `resource` `/api/mcp` y solo se aceptan ahí; no
  sirven contra el resto de `/api/**` (que sigue usando la cookie).
- CORS: `/api/mcp` y `/api/oauth/token` responden a orígenes externos (los clientes web
  llaman desde el navegador); `/oauth/authorize` es una página normal.
- Prompt injection: los datos que devuelven las tools son del propio usuario (sus reservas,
  nombres de espacios que carga un superadmin), así que la superficie es chica. Igual, los
  textos libres (motivo de una reserva) se devuelven como datos, no como instrucciones.

## Plan de implementación (slices)

1. **Reglas de reserva como dominio** (§5) + tests. Independiente; vale por sí solo.
2. **`callbackUrl` en el ingreso** (validado: solo rutas internas).
3. **Servidor OAuth**: modelos, metadata (`/.well-known/*`), DCR + CIMD, `/oauth/authorize`
   con consentimiento, `/api/oauth/token` (code + refresh con rotación), revocación. Tests
   de cada endpoint (PKCE, redirect exacto, reuso de código y de refresh).
4. **Endpoint MCP** `/api/mcp` + `requireMcpUser` + las cinco tools + rate limit.
5. **«Asistentes conectados»** en Seguridad.
6. Probar de punta a punta con Claude web (conector personalizado) y ChatGPT contra un
   preview de Vercel; documentar en CLAUDE.md y acá.

## Fuera de alcance

- Tools de eventos/inscripciones, perfil, check-in, o cualquier acción de admin.
- Reservas recurrentes desde el asistente (la web las permite; la tool pide reservas
  simples). **(abierta)**
- Tokens personales (pegar un token a mano), para clientes sin OAuth. El caso de uso pedido
  (Claude web) usa OAuth.
- Listado de clientes verificados, o bloquear clientes desde el admin.

## Implementación (2026-10-04)

El usuario preguntó primero si MCP requería otro servidor y si funcionaba en Vercel (plan
gratuito) y luego en un VPS; con la respuesta ("es una ruta más, funciona en los dos") pidió
implementarlo en la misma sesión, decidiendo las preguntas abiertas con las recomendaciones.

### Hosting: ¿otro servidor? ¿Vercel gratuito? ¿VPS?

- **No hay otro servidor.** El endpoint MCP es una ruta de la app (`src/app/api/mcp/route.ts`).
  La revisión 2026-07-28 es sin estado y el SDK v2 (`@modelcontextprotocol/server` 2.3,
  verificado ese día: "v2 implements the 2026-07-28 MCP spec") arma una instancia nueva de
  `McpServer` por request con `createMcpHandler(factory).fetch(request)` — un handler
  web-standard `Request → Response`, que es exactamente lo que es un route handler de Next.
- **Vercel gratuito: sin problema.** Cada llamada es un POST corto con respuesta JSON; no hay
  conexiones largas, SSE sostenido ni WebSockets. El tráfico de la era 2025 (clientes que
  todavía mandan `initialize`) lo atiende el mismo handler en modo "stateless legacy" (default
  del SDK), que responde un SSE de **un solo mensaje** y cierra — igual de corto. Las
  invocaciones entran holgadas en la cuota gratuita.
- **VPS: sin manejo especial.** Es la misma ruta bajo `next start`. Lo único a cuidar es lo
  mismo que ya cuidan las passkeys: las URLs públicas (issuer OAuth, `resource` de los tokens,
  la URL que se muestra en Seguridad) salen de `X-Forwarded-Host`/`Host` + `X-Forwarded-Proto`
  (`src/lib/oauth/origin.ts`), así que el reverse proxy tiene que pasar esos headers (lo
  estándar en nginx/Caddy). `OAUTH_ISSUER` lo fija a mano si no. El rate limit y los códigos
  viven en la base, no en memoria, así que varias instancias tampoco son problema.

### Decisiones cerradas (antes "abiertas")

| Pregunta                                     | Decisión                                                                                                                                                                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OAuth a mano o con librería                  | **A mano** (`src/lib/oauth/`, ~4 endpoints) + SDK oficial v2 solo para el transporte MCP. Se descartó `mcp-handler` de Vercel: es un adaptador del mismo SDK y suma una dependencia sin aportar nada con el handler web-standard del v2. |
| ¿Saltear el consentimiento si ya hay grant?  | **No**: la pantalla se muestra siempre.                                                                                                                                                                                                  |
| Marcar reservas creadas por un asistente     | **Sí**: `Reservation.origin` (`WEB`/`ASSISTANT`) + `originClientName`; chip «Vía asistente: Claude» en el detalle de la reserva del admin.                                                                                               |
| ¿Cambiar contraseña / canjear código revoca? | **Sí**: `consumeResetToken` y `redeemRecoveryCode` llaman a `revokeAllGrantsForUser` en la misma transacción que la contraseña nueva.                                                                                                    |
| Reservas recurrentes desde el asistente      | **Fuera** de esta versión (la tool pide reservas simples).                                                                                                                                                                               |

### Qué se construyó, por slice

**Slice 1 — reglas de reserva como dominio.**
`src/lib/reservations/user-rules.ts` (`validateUserReservationWindow`, puro: valores numéricos,
inicio < fin, grilla de 15 min, pasado, 24 h, ventana horaria — en el mismo orden en que las
chequeaba el route handler, con los mismos mensajes) y `src/lib/reservations/user-actions.ts`
(`requestUserReservation`, `cancelUserReservation`, tiran `DomainError`). `POST/DELETE
/api/resources/[spaceId]` quedaron como parseo + llamada + `apiCatch`. Tests en
`user-rules.test.ts`. Dos endurecimientos al extraer (los dos cierran agujeros, ninguno cambia
la experiencia de la web):

- **Un espacio no reservable responde 404** (la página de reserva ya daba 404, pero la API
  aceptaba el id).
- **Cancelar una reserva ajena responde 404, no 403** (la consulta ya filtra por dueño, así que
  no confirma que el id exista).

**Slice 2 — `callbackUrl` en el ingreso.** `src/lib/signin/callback-url.ts`
(`safeCallbackUrl`, `signInUrl`; mismo criterio que `safeGateNext`: solo rutas internas de
`/user`, `/admin`, `/oauth/authorize`). La pantalla de ingreso lo usa en los tres `signIn`
(contraseña, passkey, código de recuperación); el middleware manda a
`/auth/signin?callbackUrl=<ruta pedida>` en lugar de a `/auth/signin` pelado, y a quien ya
tiene sesión y entra a `/auth/*` lo devuelve al `callbackUrl` validado. (El helper vive en
`src/lib/signin/` y no en `src/lib/auth/` para no chocar con el módulo `src/lib/auth.ts`.)

**Slice 3 — servidor OAuth.** Modelos en `prisma/models/oauth.prisma` (migración
`20261005100000_oauth_mcp_connector`, escrita a mano desde `prisma migrate diff` porque el diff
contra la base trae ruido ajeno — en particular re-agregar la FK polimórfica de
`reservable_id`). Diferencias con el boceto de §2:

- `OAuthGrant` **sin** `@@unique([userId, clientId])`: un grant revocado se conserva como
  historia, y reconectar crea uno nuevo. `createAuthorizationCode` reutiliza el grant
  **vigente** del par cuenta+cliente (con los scopes recién consentidos), así "Asistentes
  conectados" no muestra duplicados.
- `OAuthAuthorizationCode` y `OAuthToken` guardan el `resource` (audiencia) y los scopes.

Módulos (`src/lib/oauth/`): `config.ts` (scopes, textos en castellano, vidas: código 60 s,
access 1 h, refresh 30 d, cache CIMD 24 h), `crypto.ts` (token opaco de 256 bits, SHA-256,
PKCE S256 en tiempo constante), `redirect-uri.ts` (https / loopback http / esquema privado
para registrar; **coincidencia exacta**, salvo el puerto en loopback por RFC 8252 §7.3),
`ssrf.ts` + `cimd.ts` (CIMD con la IP validada **al conectar** vía `lookup` de
`https.request` — cubre DNS rebinding —, sin redirects, 5 s, 64 KB, y `client_id` del
documento == URL), `clients.ts` (DCR + resolución CIMD con cache), `authorize.ts` (validación
compartida página/API: si `client_id` o `redirect_uri` no validan → error **en pantalla**,
nunca redirect; el resto vuelve al cliente con `error` + `state` + `iss` de RFC 9207),
`server.ts` (código de un solo uso con `UPDATE … WHERE used_at IS NULL` atómico; reuso de
código o de refresh rotado → se revoca el grant entero; verificación de access token por
audiencia; gestión de grants; poda), `http.ts` (CORS `*` — seguro porque nada usa cookies —,
errores RFC 6749, metadata RFC 8414 / RFC 9728).

Rutas: `/.well-known/oauth-protected-resource[/…]` y `/.well-known/oauth-authorization-server[/…]`
(catch-all opcional: los clientes las piden con y sin el path del recurso),
`POST /api/oauth/register` (DCR; rate limit 100/h por IP), `POST /api/oauth/token` (form o
JSON; 300/min por IP), `POST /api/oauth/revoke` (RFC 7009, 200 siempre), la página
`/oauth/authorize` (en el grupo `(gate)`, con su shell de logo) y `POST /api/oauth/authorize`
(la decisión; `requireActiveSession()` + `Origin` propio + revalida todo).

- **Rate limits generosos a propósito** en registro y token: los asistentes web los llaman
  desde los servidores de su proveedor, compartidos entre muchas personas.
- La pantalla de consentimiento **no muestra el `logo_uri`** del cliente: la CSP del sitio
  (`img-src`) no admite dominios arbitrarios y no vale abrirla para un dato que declara un
  tercero. Muestra nombre declarado + dominio de la `redirect_uri` + la cuenta.
- `/oauth/:path*` se sumó al matcher del middleware y a `requiresSession` (ingreso con
  `callbackUrl`, baneo, gate de políticas, perfil completo); la página repite los chequeos con
  la sesión fresca, como los layouts. `/oauth/authorize` se sumó a los prefijos permitidos de
  `safeGateNext`, para volver ahí después de aceptar políticas.

**Slice 4 — endpoint MCP.** `src/app/api/mcp/route.ts` (POST/GET/DELETE + OPTIONS):
autentica (`src/lib/mcp/auth.ts`), y sin token válido responde `401` con
`WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/api/mcp"`
(+ `error="invalid_token"` si había uno). Con token válido pero la cuenta sin perfil,
suspendida o con políticas pendientes, el server se arma igual y **cada tool devuelve ese
motivo como error** (con el link a la web), como pedía §4. Las cinco tools en
`src/lib/mcp/tools.ts`, envueltas por `guarded()` (cuenta, scope, rate limit, `DomainError` →
`isError`, error inesperado → log + genérico):

- `list_spaces` incluye además los **tipos de reserva** válidos (para el `reservation_type` de
  `request_reservation`) y las reglas de horario — una tool menos que agregar.
- `get_availability` toma fechas `YYYY-MM-DD` del predio (máx. 14 días; por defecto 7) y
  devuelve tramos libres por día, calculados por `computeFreeWindows`
  (`src/lib/mcp/availability.ts`, puro) con **las mismas reglas** que valida el pedido
  (días hábiles, 09–18 local, 24 h, grilla). Descuenta lo que `get_unavailable_slots` marca
  ocupado **y** las reservas propias vigentes en ese espacio.
- `request_reservation` deja `origin = ASSISTANT` + nombre del cliente.
- Rate limit por usuario: 60 lecturas/min y **20** escrituras/h (el diseño decía 10; los
  intentos fallidos también cuentan, y con 10 un asistente que se corrige dos o tres veces
  dejaba a la persona bloqueada una hora — se vio en la prueba de punta a punta).
- Fechas (`src/lib/mcp/format.ts`): entrada ISO con offset obligatorio, salida ISO con el
  offset del predio + texto `es-AR` ("viernes 09/10, 14:00–16:00"; armado desde las partes
  porque el separador de `es-AR` varía entre versiones de ICU: dio "09-10" en Node 26).
- `responseMode` queda en `auto` (default): forzar `"json"` hace que el SDK escriba un aviso en
  el log en cada request, y como ninguna tool emite progreso `auto` ya responde JSON.

**Slice 5 — gestión por el usuario y el admin.**

- Configuración → Seguridad → **«Asistentes de IA»** (`assistants-section.tsx`): la URL del
  conector con `CopyField` (calculada del host de la request, así una preview muestra la
  suya), dos líneas para Claude y ChatGPT, y la lista de asistentes conectados (nombre +
  dominio, fecha, último uso, qué puede hacer) con «Desconectar» (diálogo de confirmación).
  API: `GET /api/user/assistants`, `DELETE /api/user/assistants/[id]` (las dos con
  `requireActiveSession()`, como exige `api-auth.test.ts`). El subtítulo de Seguridad en el
  menú pasó a "Passkeys, recuperación y asistentes".
- Chip «Vía asistente: <nombre>» (`ToneBadge` info) en el detalle de la reserva del admin
  (`admin-reservation-detail-sheet.tsx`), desde `AdminReservationListResult.assistantName`.
- El cron diario (`maintain-reservations`) poda códigos vencidos y tokens vencidos/revocados
  hace más de 7 días (`pruneExpiredOAuthRows`); los grants revocados se conservan.

### Verificación

- `npm test` (52 archivos, 477 tests), `npm run lint`, `npm run format:check`, `tsc --noEmit`.
  Tests nuevos: `user-rules.test.ts`, `callback-url.test.ts`, `oauth/oauth.test.ts` (PKCE,
  tokens, scopes, redirect_uri, resource, SSRF), `mcp/mcp.test.ts` (fechas, huecos libres).
- **Punta a punta local** (script contra `next dev`, con la base de Docker): DCR → ingreso →
  pantalla de consentimiento (y una `redirect_uri` ajena muestra el error sin redirigir) →
  Permitir → canje con verifier incorrecto (400) y correcto (200) → **reuso del código: 400 y
  el token ya emitido deja de valer (401)** → `initialize` (era 2025) → `tools/list` con las
  cinco → `list_spaces`, `get_availability`, pedido sin offset y fuera de grilla (errores
  legibles), pedido válido (queda `PENDING` y `origin = ASSISTANT`), `list_my_reservations`,
  `cancel_reservation` propia y desconocida → refresh rota → **reuso del refresh: 400 y el
  token nuevo deja de valer** → «Asistentes conectados» lista el cliente. La cancelación
  desde la web (`DELETE /api/resources/[spaceId]`) se probó por la función de dominio.
- Capturas con Playwright: el ingreso sin sesión manda a
  `/auth/signin?callbackUrl=/oauth/authorize?…` y después de ingresar vuelve a la pantalla de
  consentimiento (teléfono claro y escritorio oscuro); la sección de Seguridad en oscuro.
  (Para probar en otro puerto que el de `NEXTAUTH_URL`, hay que levantar el dev con
  `NEXTAUTH_URL`/`AUTH_URL` apuntando a ese puerto: NextAuth arma la URL de vuelta del
  `signIn` con esa variable.)

### Pendiente — slice 6

Probar con **Claude web** (Configuración → Conectores → «Agregar conector personalizado» →
`https://<preview>/api/mcp`) y **ChatGPT** contra un deploy público: los asistentes no pueden
llegar a `localhost`. Puntos a mirar: que el cliente descubra la metadata (con y sin path),
qué registro usa (DCR o CIMD) y qué `redirect_uri` manda, que el `resource` que pide coincida
con el nuestro, y la era del protocolo que habla. Si una preview de Vercel tiene **Deployment
Protection** activa, el asistente recibe la página de login de Vercel en lugar del `401`:
probar contra una preview sin protección o contra producción.

### Hallazgos descartados / fuera de alcance

- **Scope insuficiente como `403` + step-up** (`WWW-Authenticate: … error="insufficient_scope"`):
  hoy cada tool responde un error legible ("desconectá y volvé a conectar aceptando todos los
  permisos"). Con dos scopes que se piden juntos no vale el flujo de step-up; revisar si algún
  día hay un asistente de "solo consultar".
- **Cancelar una ocurrencia pasada de una recurrente**: ni la web ni el MCP lo impiden (se
  mantuvo el comportamiento existente).
