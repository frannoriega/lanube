# Milestone 17 — Configuración de la cuenta: secciones, cambios de datos con aprobación y passkeys

**Estado:** implementado (2026-10-02) en `preview`, sin commitear al cierre de la sesión.
**Tipo:** mixto — rediseño de UI + flujo de negocio nuevo (aprobación) + autenticación (passkeys).

## Pedido

Textual del usuario (2026-10-02), resumido, con una captura de la pantalla de entonces
(`/user/settings`: dos tarjetas lado a lado, "Información Personal" editable — nombre,
apellido, DNI, institución, motivo — e "Información de Cuenta" de solo lectura — email,
fecha de registro, rol):

1. **Rediseño**: que la configuración esté detrás de un menú de opciones ("Cuenta",
   "Seguridad y privacidad", etc.) en vez de todo en una pantalla. El diseño y el criterio
   quedaron a cargo de Claude ("sos mucho mejor que yo en diseño").
2. **DNI y motivo para unirse no editables.** El usuario puede **pedir** un cambio, y un
   admin lo aprueba. Explícitamente: ni el usuario lo cambia solo (**invita al fraude**) ni el
   admin lo cambia solo (**invita al abuso**). Solicitud + aprobación.
3. **El milestone de autenticación** (OAuth, passkeys, etc.): implementarlo en esta sesión,
   "o al menos las passkeys".

No hubo preguntas de ida y vuelta: el usuario delegó el diseño y la sesión corrió en segundo
plano. Las decisiones de abajo son de Claude y están marcadas como tales para que se puedan
revisar.

## Contexto encontrado

- **No existía un doc de milestone de autenticación.** Lo que hay es la sección "Auth
  architecture (confirmed 2026-09-21)" y "Multi-credential schema (proposed 2026-09-22)" de
  `docs/design/06-rust-migration.md`: métodos aditivos por cuenta (contraseña, passkeys,
  OAuth, LDAP bind-only), "una passkey nunca es la única credencial", códigos de
  recuperación, proveedores OAuth configurables en runtime por el superadmin con secretos
  cifrados. Ese doc describía una migración **de este repo** a Rust que **quedó
  descartada** (la reescritura en Rust vive en otro repositorio; lanube sigue en
  Next.js/TypeScript). Se tomaron de ahí las **políticas** y la **forma del esquema**
  (tabla tipada por clase de credencial), no la tecnología. El doc todavía no está marcado
  como superado — queda señalado abajo.
- **Bug encontrado al pasar**: la pantalla vieja mostraba el rol de **todos** como
  "Usuario" (la captura del pedido lo muestra para `sa1`, que es superadmin).
  `GET /api/user/profile` devolvía la fila de `RegisteredUser` (que tiene `roleId`, no
  `role`) y la página leía `user.role`, siempre `undefined` → `NO_ROLE_LABEL`. Arreglado: el
  GET ahora incluye `roleRef` y devuelve `role` con el nombre.
- Ningún endpoint de admin editaba el DNI (`PATCH /api/admin/users/[id]` solo cambia el
  rol), así que "el admin no lo edita directo" ya se cumplía; lo que faltaba era quitárselo
  al usuario.

## Qué se construyó

### 1. Configuración en secciones

`/user/settings` pasó a ser un layout con navegación y **una ruta por sección**:

| Ruta                      | Sección   | Contenido                                                          |
| ------------------------- | --------- | ------------------------------------------------------------------ |
| `/user/settings/profile`  | Perfil    | Nombre, apellido, institución (lo único editable directo).         |
| `/user/settings/identity` | Identidad | DNI y motivo, de solo lectura, con "Solicitar cambio" + historial. |
| `/user/settings/security` | Seguridad | Passkeys (alta, renombrar, quitar) + estado de la contraseña.      |
| `/user/settings/account`  | Cuenta    | Email, rol, "Miembro desde" — solo lectura.                        |
| `/user/settings`          | —         | Redirige a `/profile` (no tiene contenido propio).                 |

Decisiones de diseño (Claude):

- **Rutas, no pestañas en el cliente.** Cada sección tiene URL propia: Atrás funciona, se
  puede mandar un link directo ("entrá a Configuración → Seguridad"), y los breadcrumbs
  (`managementCrumbs`) salen gratis. Se agregaron las etiquetas `settings` → "Configuración"
  (antes "Mi perfil"), `profile`, `identity`, `security`, `account`; `/user/settings` va a
  `NON_NAVIGABLE` porque solo redirige (un link ahí rebotaría).
- **Cuatro secciones y no tres.** El pedido nombraba "Cuenta" y "Seguridad y privacidad".
  "Identidad" se separó de "Perfil" porque tiene **otro modelo de edición** (pedir vs.
  editar): mezclarlos en un formulario obligaba a explicar por qué dos campos no se editan.
  No hay "Privacidad": hoy no existe ninguna preferencia de privacidad que mostrar, y una
  sección vacía no ayuda (si aparece algo — visibilidad, exportar datos — es su lugar).
- **Navegación**: desde `lg`, columna a la izquierda con título + una línea de qué hay
  adentro; por debajo, una fila de "píldoras" deslizable de costado (es una fila de chips,
  no la página: la página no scrollea de costado — verificado a 390 px).
- **Punto ámbar en "Identidad"** cuando hay una solicitud pendiente, visible desde cualquier
  sección. Para que se actualice al crear/cancelar, las solicitudes se leen de un contexto
  montado en el layout (`SettingsRequestsProvider`): dos `useApi` separados comparten caché
  pero no estado, y el punto quedaba viejo.
- Todo con `FormSection` (`molecules/form-layout.tsx`), tokens de diseño y
  `ResponsiveDialog` — sin estilos nuevos.
- **Perfil**: "Guardar cambios" se habilita solo con cambios; aparece "Descartar". Abajo,
  un acceso a Identidad ("¿Necesitás cambiar tu DNI o tu motivo?").
- **Seguridad → Contraseña** se muestra como **estado** ("Configurada"), sin acciones, con
  la indicación de usar "Olvidé mi contraseña". Ver "No hecho" para el porqué.

### 2. Cambios de DNI / motivo con aprobación

**Modelo** (`prisma/models/profile-change-requests.prisma`): `ProfileChangeRequest` con
`field` (`DNI` | `REASON_TO_JOIN`), `currentValue` (foto al pedir), `requestedValue`,
`justification` (obligatoria), `status` (`PENDING` | `APPROVED` | `REJECTED` |
`CANCELLED`), `decidedById`, `decisionReason`, `decidedAt`, `createdAt`.

**Reglas** (todas en `src/lib/db/profileChangeRequests.ts`, server-side):

- El usuario **no puede** escribir DNI/motivo: `PUT /api/user/profile` ahora valida con
  `personalInfoSchema` (nombre, apellido, institución) y **ignora** cualquier otro campo. La
  función de datos vieja (`updateRegisteredUserProfileByEmail`, que aceptaba `dni` y
  `reasonToJoin`) se reemplazó por `updateOwnPersonalInfo`, que **ni siquiera acepta** esos
  campos — así ninguna ruta futura los vuelve a escribir por accidente.
- **Una sola pendiente por (usuario, campo)**: chequeo en la capa de datos + índice único
  **parcial** en la base (`WHERE status = 'PENDING'`, escrito a mano en la migración porque
  Prisma no los modela) para la carrera de dos envíos simultáneos.
- El valor pedido tiene que ser distinto del actual; el DNI se valida con el mismo
  `dniSchema` del alta; el motivo con las mismas longitudes del alta (20–500).
- **Un DNI que ya usa otra cuenta** no se puede pedir, y se vuelve a chequear **al aprobar**
  (entre medio otra persona pudo registrarse con él). La cola marca esos pedidos con un
  aviso y deshabilita "Aprobar".
- **El admin decide, no edita**: la decisión es aprobar/rechazar el valor que pidió el
  usuario; no hay forma de aprobar "con otro valor".
- **Nadie resuelve su propia solicitud** — ni un superadmin (403). Es la contracara del
  "invita al abuso": un admin no puede cambiarse su propio DNI aprobándoselo.
- **Rechazar exige motivo** (≥ 5 caracteres; aprobar no). Decisión de Claude: el usuario ve
  la respuesta en su historial y un rechazo sin explicación no le dice qué hacer.
- Aprobar escribe el dato **en la misma transacción** que cierra la solicitud, con un
  `updateMany ... WHERE status = 'PENDING'` como guardia: si otro admin la resolvió entre
  medio, se deshace todo (409).
- El usuario puede **cancelar** su solicitud mientras está pendiente.

**Permiso nuevo** `users:profile-requests:review` ("Revisar cambios de DNI y motivo"),
grupo "Usuarios" en `/admin/roles`. La migración se lo agrega al rol **ADMIN** sembrado (es
una tarea operativa del día a día, no configuración técnica — ver la regla de
`lanube-superadmin-scope`); SUPERADMIN lo tiene implícito. Gatea la API
(`requirePermission`), la página (`requirePagePermission`), el middleware
(`ADMIN_PATH_PERMISSIONS`) y el ítem del menú.

**Admin**: `/admin/profile-requests` ("Cambios de datos", en el menú debajo de Usuarios).
`DataTable` con pestañas Pendientes (con el conteo) / Resueltas / Todas, paginada; las
pendientes salen de la más vieja a la más nueva (FIFO). "Revisar" abre un diálogo con
actual vs. pedido, la justificación, el aviso de DNI duplicado y el motivo; "Ver" muestra
quién decidió, cuándo y qué respondió. La propia solicitud se ve marcada "(vos)" y sin
botones.

**Auditoría**: evento nuevo `user.profileChange.decide` (entidad `RegisteredUser`,
`kind: custom`) con campos `decision`, `field`, `dni`, `reasonToJoin`, `requestedValue`. Al
**aprobar**, `before`/`after` llevan el valor real del campo (el diff de `/admin/audit`
muestra `20000001 → 20000999`); al **rechazar**, el perfil no cambió y solo se guarda qué se
pidió. `context` = `{ Usuario, Dato }`. Las solicitudes y cancelaciones del propio usuario
**no** se auditan en `audit_logs` (la auditoría es de lo que hace el equipo en el panel, y la
solicitud ya es un registro durable con autor y fecha).

**API**:

- `GET/POST /api/user/profile/change-requests`, `DELETE /api/user/profile/change-requests/[id]`
- `GET /api/admin/profile-requests?status=PENDING|RESOLVED|ALL&page&pageSize`
- `POST /api/admin/profile-requests/[id]/decision` — `{ decision, reason? }`

### 3. Passkeys

**Librería**: `@simplewebauthn/server` + `@simplewebauthn/browser` (v14).

**Por qué no el proveedor `Passkey` de NextAuth** (alternativa descartada): es experimental
(`experimental.enableWebAuthn`), exige su propio modelo `Authenticator` con columnas fijas y
está pensado para sesiones de base, mientras este proyecto usa JWT y un callback `jwt()` que
recalcula baneo/permisos en cada llamada. En su lugar, el **inicio de sesión con passkey es
un segundo proveedor `Credentials`** (`id: "passkey"`, en `src/lib/auth.ts`) cuyo
`authorize` verifica la aserción. Devuelve el mismo usuario "JWT-safe" que el de contraseña,
así el resto del pipeline (baneos, permisos, email verificado, `signedUp`) es idéntico.

**Esquema** (`prisma/models/passkeys.prisma`), siguiendo la propuesta "tabla tipada por clase
de credencial" del doc de diseño:

- `PasskeyCredential`: `userId` → `User` (la identidad de inicio de sesión, como
  `passwordHash`; no `RegisteredUser`), `credentialId` único (base64url), `publicKey`
  (bytea), `counter`, `transports`, `deviceType` (`singleDevice` | `multiDevice`),
  `backedUp`, `label` (elegido por el usuario), `createdAt`, `lastUsedAt`.
- `WebAuthnChallenge`: desafío de un solo uso, 5 minutos, en la base (no en una cookie ni en
  memoria — despliegue serverless, sin memoria compartida). Se **borra antes de verificar**
  (sin repetición aunque la verificación falle). El cron diario poda los vencidos:
  `prune_transient_rows()` ahora devuelve también `deleted_webauthn_challenges` (la función
  se recrea con `DROP` porque cambia el tipo de retorno) y
  `/api/cron/maintain-reservations` lo reporta.

**Flujos**:

- **Alta** (Configuración → Seguridad → "Agregar passkey"): primero se pide el **nombre**
  (sugerido por el dispositivo: Mac, iPhone, Android…), recién después se abre el diálogo
  del sistema. `POST /api/user/passkeys/options` → `startRegistration()` →
  `POST /api/user/passkeys`. Credencial **descubrible** (`residentKey: "required"`) para
  poder entrar sin escribir el email; `excludeCredentials` evita duplicar en el mismo
  autenticador; `attestation: "none"`.
- **Inicio de sesión** (`/auth/signin` → "Entrar con passkey", oculto si el navegador no
  soporta WebAuthn): `POST /api/auth/passkey/options` (público, rate limit 20/min por IP
  porque cada llamada escribe una fila) → `startAuthentication()` sin `allowCredentials` →
  `signIn("passkey", { challengeId, response })`. Actualiza `counter` (detecta clones) y
  `lastUsedAt`.
- **Renombrar / quitar**: `PATCH` / `DELETE /api/user/passkeys/[id]`, siempre acotado al
  dueño.

**Políticas** (del doc de diseño):

- **Una passkey nunca es la única credencial**: solo se agrega a una cuenta que ya tiene
  otra forma de entrar (`hasNonPasskeyCredential` — hoy la contraseña; cuando exista OAuth,
  esa función es la que tiene que mirar las identidades). Quitar una passkey siempre está
  permitido: nunca deja a la cuenta sin contraseña.
- **Máximo 10 por cuenta** (Claude): que una sesión robada no pueda llenar la tabla.

**Relying Party (rpID / origen)** — se toma del **host al que entró el navegador**
(`X-Forwarded-Host` / `Host` + `X-Forwarded-Proto`). Bug encontrado al probar: la primera
versión usaba `request.url`, y con `next dev -H 0.0.0.0` (el contenedor de Docker) esa URL
dice `0.0.0.0` → el navegador rechazaba el `rpID`. Tomarlo del pedido es seguro porque el
navegador firma el origen real y solo acepta un `rpID` que sea ese dominio o un padre.
`WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` (opcionales, en `env.example`) lo fijan si un proxy
reescribe el host. **Consecuencia**: una passkey creada en producción no sirve en una
preview de Vercel (otro dominio), y viceversa.

**Errores**: los de WebAuthn vienen en inglés y técnicos; `src/lib/passkeys/client.ts` los
traduce a `PasskeyError` (mensaje mostrable) o `PasskeyCancelledError` (el usuario cerró el
diálogo — no se muestra como error). Bug encontrado al probar: `apiErrorMessage` solo
respeta `ApiError`, así que los mensajes traducidos se perdían en el genérico; se agregó
`passkeyErrorMessage`.

## Migración

`20261002100000_profile_change_requests_and_passkeys` — escrita a mano. `prisma migrate
diff` además proponía re-crear la FK polimórfica `reservations.reservable_id` (ver
CLAUDE.md) y otros desvíos ajenos (defaults, índices renombrados, tablas `_sqlx_migrations`
y `health_check` en la base local); **nada de eso va en esta migración**. Contiene: enums y
tabla de solicitudes + índice parcial único, el permiso nuevo para ADMIN, tablas de
passkeys y desafíos, y `prune_transient_rows()` recreada.

## Verificación

- `tsc --noEmit`, ESLint y los 41 archivos de tests (369 tests) pasan. Test nuevo en
  `management-crumbs.test.ts` (etiquetas de secciones y `/user/settings` sin link). Los
  tests de auditoría (`registry.test.ts`, `actions.test.ts`) cubren el evento nuevo y la ruta
  de decisión.
- **E2E con Playwright** contra el stack de Docker (script ad hoc, no versionado), todo
  verde:
  - `/user/settings` redirige a `/profile`.
  - `PUT /api/user/profile` con `dni` → 200 pero el DNI en la base **no cambia**.
  - u1 pide cambio de DNI desde la UI → aviso "Cambio pendiente"; un segundo pedido del
    mismo campo → 409.
  - a1 (ADMIN) lo aprueba desde `/admin/profile-requests` → el DNI de u1 cambia; entrada de
    auditoría `{"dni":"20000001"}` → `{"dni":"20000999","decision":"approve"}`, contexto
    `{Dato: DNI, Usuario: …}`.
  - a1 intenta aprobar **su propia** solicitud por API → 403; rechazar sin motivo → 400; u1
    (sin permiso) pidiendo la cola → 403.
  - u1 ve la solicitud "Aprobada" en su historial.
  - **Passkeys con autenticador virtual de Chrome (CDP `WebAuthn.addVirtualAuthenticator`)**:
    alta desde la UI → fila con `counter=1`; se borran las cookies, "Entrar con passkey" en
    `/auth/signin` → aterriza en `/user/dashboard`; `last_used_at` queda seteado.
  - Las cuatro secciones a 390 px: sin desborde horizontal de la página.
- **Límites del método**: el autenticador virtual no prueba Face ID / Touch ID reales, ni
  passkeys sincronizadas (iCloud/Google), ni el flujo híbrido (QR con el teléfono). Falta
  una prueba manual en un dispositivo real, idealmente en una preview de Vercel (HTTPS de
  verdad, dominio distinto de `localhost`). El modo oscuro no se capturó en esta pasada.

## No hecho (y por qué)

- **OAuth (Google/GitHub)**. El pedido decía "o al menos las passkeys". Hacerlo bien según el
  doc de diseño requiere decisiones que no se pueden tomar solas: credenciales de cada
  proveedor (apps creadas en Google/GitHub), la **configuración en runtime por el
  superadmin con secretos cifrados** (el doc lo pide explícitamente en vez de variables de
  entorno), y la **política de vinculación de cuentas** (¿un login de Google con un email que
  ya existe se vincula solo? ¿pide la contraseña primero?). Queda como el próximo paso
  natural; `hasNonPasskeyCredential` es el punto donde se engancha la política.
- **Códigos de recuperación** (confirmados en el doc de diseño): no pedidos explícitamente
  en esta sesión; mismo motivo.
- **Cambiar la contraseña desde Configuración** (actual + nueva). Encaja en "Seguridad",
  pero no estaba pedido, y la regla de este proyecto es preguntar antes de sumar
  funcionalidad adyacente. Hoy la sección muestra el estado y remite a "Olvidé mi
  contraseña". **Pregunta abierta para el usuario.**
- **Notificar al usuario la decisión** (in-app o email vía `notify()`). Misma regla: no se
  sumó. El usuario ve el resultado en su historial y en el punto de "pendiente" que
  desaparece. **Pregunta abierta.**
- **Autocompletado de passkeys en el campo de email** (WebAuthn "conditional UI"): se dejó
  el botón explícito, más predecible en todos los navegadores.
- **Marcar `docs/design/06-rust-migration.md` como superado**: no se tocó en esta sesión
  (no era el pedido); queda señalado.
