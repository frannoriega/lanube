# Milestone 21 — Conector MCP para la gestión

**Estado:** **implementado (2026-10-04)** en `preview`. Extiende el conector del
[milestone 20](./milestones-20-mcp-connector.md) (mismo endpoint `/api/mcp`, mismo servidor
OAuth). Igual que el 20, falta probarlo con Claude web / ChatGPT contra un deploy público.
**Tipo:** feature — integración externa + autorización por permisos.

## Pedido

Textual del usuario (2026-10-04), traducido:

> Ahora quiero extender las capacidades del MCP para el lado de la gestión. Quiero que los
> admins (y para que sepas: cuando digo "admin" = persona con algún permiso de gestión, no un
> rol en particular) puedan gestionar noticias: listar, leer, revisar y escribir artículos.
> Para escribir específicamente, quiero que el asistente muestre una vista previa (en el chat
> mismo, o un link al artículo como borrador) y pida confirmación explícita. Si el camino es
> dar un link al borrador, entonces el asistente NO debería poder publicar, sino delegarlo en
> el admin. Si tener un estado borrador es demasiado lío, el asistente debería pedir una
> confirmación específica antes de publicar.
>
> También quiero capacidades de solo lectura para las otras funciones: eventos, formularios,
> solicitudes de cambio de datos personales, reportes y recursos (equipamiento y demás).
> Deberían poder listar y leer información de recursos puntuales (con los permisos correctos,
> claro).
>
> Nadie debería poder interactuar por el asistente con: el registro de auditoría, los tipos de
> reserva, los espacios (la gestión de espacios), los datos de contacto (su gestión), los roles
> y permisos, ni los temas de la portada.
>
> Todos los usuarios (admins o no) deberían poder leer los datos de contacto (los mismos que se
> publican en el sitio) si lo piden, y acceder a las políticas. Además, el asistente debería
> tener acceso a la página "Quiénes somos" para dar contexto extra sobre la app.

## Decisiones

### "Admin" = permiso, no rol

Cada tool de gestión exige **el mismo permiso del catálogo** (`src/lib/rbac.ts`) que su
pantalla del panel, resuelto fresco en cada request con `getPermissionSetForUser()` (el mismo
que usa `requirePermission()`). No hay ninguna referencia a nombres de rol: un rol nuevo con
`reports:view` ve el reporte por el asistente sin tocar código.

| Área                           | Permiso                            | Tools                                                          |
| ------------------------------ | ---------------------------------- | -------------------------------------------------------------- |
| Noticias (leer/revisar)        | `news:manage` **o** `news:approve` | `list_news`, `get_news_post`                                   |
| Noticias (redactar)            | `news:manage`                      | `create_news_draft`, `update_news_draft`                       |
| Eventos                        | `events:manage`                    | `list_events`, `get_event`, `list_event_participants`          |
| Formularios                    | `forms:manage`                     | `list_form_templates`, `get_form_template`                     |
| Solicitudes de cambio de datos | `users:profile-requests:review`    | `list_profile_change_requests`                                 |
| Reportes                       | `reports:view`                     | `get_usage_report`                                             |
| Recursos (equipamiento)        | `resources:manage`                 | `list_resources`, `get_resource`                               |
| Información pública            | ninguno                            | `get_contact_info`, `list_policies`, `get_policy`, `get_about` |

- En la web, **leer** noticias pide `news:manage` (`GET /api/admin/news`); acá alcanza con
  cualquiera de los dos permisos de noticias, porque quien solo tiene `news:approve` necesita
  leer las notas para revisarlas. El alcance es el de la web: con `news:approve` se ven todas,
  con solo `news:manage`, las propias.
- `resources:manage` hoy solo lo tiene el SUPERADMIN (seed). Un ADMIN no ve las tools de
  recursos, igual que no ve `/admin/resources`. Se probó así.

### Noticias: el camino del borrador

Se eligió **borrador + link**, la primera opción del pedido, porque `NewsPost` ya tiene
`DRAFT` y no es público en ningún lado. Consecuencias:

- **El asistente no publica, no envía a revisión, no pausa, no borra, no destaca ni decide.**
  No existe ninguna tool para eso. Lo que escribe queda en `DRAFT` (y una nota `REJECTED` que
  reescribe vuelve a `DRAFT`).
- **Vista previa + confirmación explícita antes de escribir**: las descripciones de
  `create_news_draft` / `update_news_draft` le piden al modelo mostrar título, resumen y cuerpo
  tal como se van a guardar y pedir confirmación; además el argumento
  `confirmed_by_user: true` es **obligatorio** (`z.literal(true)`), así una llamada sin esa
  confirmación falla validando. Es una señal para el modelo, no una garantía criptográfica: la
  garantía real es que el resultado es un borrador privado.
- **Después, el link**: la respuesta trae `draft_url` (`/admin/news/<id>`) y los pasos que
  faltan. La persona agrega la **imagen de portada** (el asistente no sube imágenes; la
  portada es obligatoria para guardar desde el formulario, así que nada sale del borrador sin
  que un humano lo abra), revisa, y publica o envía a revisión **con sus propios permisos**.
- **Qué puede editar**: solo `DRAFT` o `REJECTED`, solo las propias salvo con `news:approve`
  (como en la web). Nunca una nota en revisión, publicada o pausada: el mensaje dice que eso
  se cambia desde el panel. Título, resumen y cuerpo, nada más: el slug queda estable, la
  portada y "destacada" no se tocan.
- **Auditoría**: las dos acciones quedan en `audit_logs` como `news.create` / `news.update` del
  usuario, con el contexto `Vía: Asistente: <nombre del cliente>`.

### "Revisar" = leer y opinar, no decidir

Aprobar una nota la **publica**, y el pedido es que el asistente no publique. Por eso "revisar"
quedó como: `list_news` con `status=PENDING_REVIEW` (notas enviadas a revisión) o
`pending_requests_only=true` (pedidos de editar/pausar/eliminar notas publicadas), y
`get_news_post`, que devuelve el cuerpo y, para un pedido de edición, el **contenido
propuesto** junto al actual. El asistente da su revisión editorial en el chat y la decisión se
toma en el panel (`admin_url`). Rechazar tampoco es una tool: es la otra mitad de la misma
decisión y no vale separarla. **(Reabrir si se quiere que el asistente pueda rechazar con
motivo.)**

### Scopes OAuth nuevos

- `management:read` — "Consultar, solo lectura, lo que tus permisos de gestión te dejan ver".
- `news:write` — "Redactar borradores de noticias en tu nombre (nunca publicarlas)".

Son un **tope**, no un permiso: una tool de gestión exige el scope **y** el permiso del rol
(`canUseTool`, `src/lib/mcp/access.ts`). La información pública **no pide scope** (cualquier
token válido la lee).

La pantalla de consentimiento y el grant guardan **solo los scopes que aplican a la cuenta**
(`scopesForAccount` → `scopeAppliesTo`): a quien no tiene ningún permiso de gestión no se le
muestran ni se le guardan. Si después le dan un rol de gestión, tiene que **volver a conectar
el asistente** para que el grant incluya esos scopes (los permisos sí se leen frescos; el
scope es lo consentido). El texto de la pantalla también cambia: con scopes de gestión dice
"lo de gestión es de solo lectura… nunca publica, aprueba ni rechaza nada".

Los grants creados con el milestone 20 (solo scopes de reservas) siguen funcionando para
reservas y para lo público; para la gestión hay que reconectar. En la práctica eran solo los
de prueba: el 20 no llegó a producción.

### Las tools se registran solo si se pueden usar

`defineTool()` (`src/lib/mcp/tools/shared.ts`) no registra una tool que el token o la cuenta no
pueden usar: no aparece en `tools/list`. Así el asistente de una cuenta común ve 9 tools (4
públicas + 5 de reservas) y no se entera de que existen las demás, y el modelo no gasta
contexto en herramientas que no puede llamar. Medido en la prueba: usuario 9, Comunicador 13,
ADMIN 20, SUPERADMIN 22.

### Lo prohibido queda escrito y testeado

`FORBIDDEN_PERMISSIONS` (`access.ts`): `audit:view`, `reservation-types:manage`,
`spaces:manage`, `site-config:manage`, `roles:manage`, `landing-themes:manage`.
`access.test.ts` falla si una tool pide alguno, y además fija que las únicas tools que escriben
son las de reservas propias y las de borradores. Como las tools son una lista cerrada, ni el
SUPERADMIN (que tiene todos los permisos) llega a esas áreas.

`list_spaces` (reservas, milestone 20) **no** es gestión de espacios: es la lista pública de
espacios reservables. Se mantiene.

### Áreas de gestión que no se pidieron

El pedido nombra noticias, eventos, formularios, solicitudes de cambio, reportes y recursos.
**No se agregaron** (no se pidieron, y la regla del proyecto es no sumar de más): reservas de
otros (gestión de reservas), usuarios y baneos, ingresos/check-in, incidentes. **(Abierta:
¿se suman como solo lectura?)**

### Información pública para todos

- **Contacto**: `get_contact_info` lee `site_config` (lo mismo que el pie del sitio). Solo
  lectura: su edición (`site-config:manage`) está entre lo prohibido.
- **Políticas**: `list_policies` (versión vigente y link) y `get_policy` (el markdown de la
  vigente, o de una anterior). Una versión cargada pero **todavía no vigente** no se adelanta.
  El texto sale del mismo archivo MDX inmutable que muestra la web (`readPolicyMarkdown`).
- **Quiénes somos**: `get_about` devuelve la página en markdown.
- **Funcionan aunque la cuenta esté bloqueada** (perfil incompleto, suspendida, políticas
  pendientes): en particular, quien tiene que aceptar políticas tiene que poder leerlas. Es
  información que ya está publicada.

### "Quiénes somos" como datos

La página tenía el texto escrito en el JSX. Copiarlo a la tool habría creado una segunda fuente
que se desactualiza; en cambio, el texto se movió a `src/lib/about/content.ts` (con `**negrita**`
para el énfasis) y la página lo renderiza con un `Emphasis` mínimo. La página se ve igual
(comparada con captura); los íconos quedaron en la página, alineados por posición. Las cifras
del ecosistema van en el markdown aclaradas como **de la ciudad, no de La Nube** (la misma
distinción que las sacó de la landing en el milestone 18).

### Datos personales

`list_event_participants` (emails y respuestas) y `list_profile_change_requests` (DNI actual y
pedido) devuelven datos personales: los mismos que ve en el panel quien tiene ese permiso, que
es quien conectó su asistente. Las descripciones le piden al modelo usarlos solo para lo que la
persona pidió. **(Abierta: si la política de privacidad tiene que mencionar el uso de
asistentes de terceros por parte del personal.)**

## Qué se construyó

- `src/lib/mcp/access.ts` — tabla `TOOL_ACCESS` (scope + permisos por tool), `canUseTool`,
  `scopeAppliesTo`, `FORBIDDEN_PERMISSIONS`. Pura; `access.test.ts`.
- `src/lib/mcp/tools/` — reemplaza al `tools.ts` del milestone 20:
  - `shared.ts`: contexto, `defineTool()` (registro condicional + cuenta bloqueada + rate limit
    - errores), `ok`/`fail`, paginación;
  - `public.ts`, `reservations.ts` (las cinco del milestone 20, sin cambios de comportamiento),
    `news.ts`, `management.ts`;
  - `index.ts`: `buildMcpServer()` con instrucciones actualizadas ("nada se publica ni se decide
    desde acá").
- `src/lib/news/assistant-drafts.ts` — `createAssistantNewsDraft` / `updateAssistantNewsDraft`
  (reglas de arriba + auditoría).
- `src/lib/mcp/auth.ts` — el resultado `blocked` ahora trae la info del token (scopes, grant),
  para atender lo público aunque la cuenta esté bloqueada.
- `src/app/api/mcp/route.ts` — resuelve los permisos frescos y arma el contexto.
- OAuth: scopes nuevos (`config.ts`), `scopesForAccount` (`authorize.ts`) usado por la pantalla
  y por el "Permitir"; textos de la pantalla y de Configuración → Seguridad.
- `src/lib/about/content.ts` + la página `/about` reescrita sobre él; `content.test.ts`.
- `src/lib/policies/source.ts` — `readPolicyMarkdown`.
- **Rate limit**: ahora por **grant** (no por usuario), con dos cubetas: lectura 60/min (todas
  las consultas, incluidas las públicas y las de gestión) y escritura 20/h (reservas,
  cancelaciones y borradores juntos).

## Verificación

- `npm test`, `npm run lint`, `npm run format:check`, `tsc --noEmit`, `next build`.
- **Punta a punta local** (dev server + base de Docker; `u2` pasado temporalmente a
  COMUNICADOR y devuelto a USER al terminar; aceptaciones de políticas de prueba para `u2`,
  `a1` y `sa1` — la base local es anterior al milestone 19 — borradas al terminar):
  - Scopes y tools por cuenta: `u1` (USER) → `reservations:*`, 9 tools, la pantalla muestra 5
    ítems; `u2` (COMUNICADOR) → 13 (noticias); `a1` (ADMIN) → 20 (todo menos recursos);
    `sa1` → 22.
  - Públicas: contacto, `privacy@2025-11-16` con su markdown, slug inexistente → error,
    "Quiénes somos" (5 012 caracteres). `list_news` para `u1` → "tool not found".
  - Borrador sin `confirmed_by_user` → error de validación; con él → `DRAFT` + `draft_url`;
    editarlo → sigue `DRAFT`. Auditoría: `news.create` y `news.update` de `u2` con
    `Vía: Asistente: Claude (e2e)`. El borrador abre en el editor del panel como "Borrador",
    con la portada vacía para completar.
  - Editar una nota **publicada** (aun como superadmin) → rechazado con el mensaje. El
    Comunicador no ve ni edita la nota de otra persona ("Nota no encontrada").
  - Eventos (lista, detalle con conteo por estado, inscriptos), plantillas (lista, preguntas),
    solicitudes de cambio, reporte de septiembre, recursos (superadmin) y su ausencia para
    ADMIN.
  - Cuenta con políticas pendientes: `get_policy` responde; `list_spaces` devuelve "Antes de
    seguir, aceptá las políticas…"; `tools/list` muestra 9 (sin gestión).
- Capturas: `/about` completa (igual que antes), el borrador en el editor, la pantalla de
  consentimiento de una cuenta con gestión.

## Abiertas

- ¿Sumar como solo lectura gestión de reservas, usuarios, check-in o incidentes?
- ¿Que el asistente pueda **rechazar** una nota en revisión con motivo (sin poder aprobar)?
- ¿La política de privacidad debe mencionar el uso de asistentes de terceros por el personal
  (datos de inscriptos y solicitudes de cambio)?
- Probar con Claude web / ChatGPT (heredado del milestone 20).
