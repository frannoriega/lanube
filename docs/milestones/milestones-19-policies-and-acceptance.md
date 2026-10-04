# Milestone 19 — Políticas versionadas y aceptación obligatoria

**Estado:** diseño (2026-10-04). Sin código todavía. Las decisiones marcadas **(propuesta)** son
de Claude y esperan confirmación; las marcadas **(abierta)** están también en
`docs/OPEN_QUESTIONS.md`.
**Tipo:** feature — legal/cumplimiento + autenticación (un "gate" nuevo en la sesión).
**Prioridad:** alta. Es el primero de los dos milestones pedidos el 2026-10-04 (el otro es el
20, conector MCP) y el usuario lo marcó como **lo más importante**.

## Pedido

Textual del usuario (2026-10-04), traducido y resumido:

> Hoy tenemos una política de privacidad en markdown, versionada en el código. Esta (y las
> futuras) van a cambiar. Pensé en hacerla "dinámica" (guardarla en la base manteniendo el
> versionado), pero es más transparente tenerlas en código (acá podés discutirme si pensás
> que la base es mejor). Quiero:
>
> - **(a)** versionar las políticas;
> - **(b)** marcar políticas como "requiere aceptación legal" (los usuarios deben aceptarlas;
>   va a haber otras que no lo requieran);
> - **(c)** pedir en el alta que se acepten todas las marcadas;
> - **(d)** que ante un cambio, al ingresar, el usuario vea una pantalla de "las políticas
>   cambiaron" y tenga que aceptar antes de poder seguir usando el sistema.

## Contexto encontrado

- **Una sola política hoy**: `src/assets/policies/privacy.mdx` (133 líneas, Ley 25.326,
  responsable: la Municipalidad de Concepción del Uruguay). Se renderiza en
  `/policies/privacy` (`src/app/(public)/policies/privacy/page.tsx`) vía `PolicyContent`
  (Client Component, porque `@next/mdx` resuelve componentes con contexto de React) con un
  índice lateral (`table-of-contents.tsx`).
- **La fecha de la política es una constante a mano**: `LAST_UPDATED = "16 de noviembre de
2025"` en `page.tsx`, con un comentario que pide actualizarla "cada vez que cambie el
  texto". La sección 12 de la propia política promete publicar los cambios "con indicación de
  su fecha de actualización". Hoy nada garantiza que eso pase — este milestone lo reemplaza
  por un dato del registro.
- **Historial**: un único commit tocó el MDX (`2025-11-16`). No hay versiones anteriores que
  migrar: la versión actual es la `v1`.
- **Nadie aceptó nada**: el alta no tiene checkbox ni enlace a la política; solo hay un
  link "Política de privacidad" al pie del card de ingreso (`auth/signin/page.tsx:855`) y en
  el footer público. No hay ningún registro de consentimiento en la base.
- **Alta en dos pasos**:
  1. `POST /api/auth/register` (en `auth/signin/page.tsx`, pestaña de registro): crea el
     `User` (email + contraseña). Es **el único lugar que crea un `User`** (la creación en
     `api/auth/magic-link/route.ts` está comentada).
  2. Confirmación de email, y después `POST /api/auth/signup`
     (`auth/signup/page.tsx`): crea el `RegisteredUser` con nombre, DNI, institución y
     motivo.
- **El `jwt()` callback (`src/lib/auth.ts`) ya consulta la base en cada llamada** —
  `getRegisteredUserByEmail` + rol + baneo — y deposita en el token lo que el middleware
  necesita para ser un camino rápido sin DB (`signedUp`, `banned`, `permissions`). El baneo
  es exactamente el antecedente de lo que pide (d): un estado de la cuenta que, mientras
  dura, redirige toda la zona autenticada a una pantalla (`/banned`).
- **El middleware no cubre `/api/**`** (matcher: `/`, `/user`, `/admin`, `/auth`). Por eso
existe `requireActiveSession()` (`src/lib/api-auth.ts`, milestone-12 D24): el chequeo de
baneo para la API. **No todas las rutas lo usan** (10 archivos bajo `src/app/api`lo
llaman;`api/user/events`, `api/user/stats`usan`auth()` a pelo).
- El `jwt()` **ignora deliberadamente** `trigger`/`session` y recalcula todo de la base
  (CLAUDE.md §Auth, punto 6). Eso nos sirve: un cliente no puede marcarse "aceptó" desde
  `useSession().update()`.

## Decisión central: el texto en código, las aceptaciones en la base

El usuario invitó a discutirlo. **Recomendación: código** — coincido con su intuición, y por
más razones que la transparencia:

|                                    | Texto en código (git)                                                   | Texto en la base                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Quién puede cambiar un texto legal | Quien puede mergear y desplegar. Pasa por revisión (PR).                | Cualquiera con el permiso de admin, sin revisión, en producción.                    |
| Historial                          | `git log` + las versiones archivadas como archivos. Inmutable de hecho. | Hay que construirlo (tabla de versiones, inmutabilidad por convención o trigger).   |
| Prueba de "qué texto aceptó"       | Hash del archivo guardado con la aceptación; el archivo está en git.    | Hash/FK a la fila de versión; la fila puede borrarse o editarse con acceso a la DB. |
| Editor                             | MDX con su tooling (el mismo de hoy).                                   | Hay que construir un editor y un preview con el mismo render.                       |
| Frecuencia de cambio               | Rara (meses/años). Un deploy por cambio no molesta.                     | Ventaja real solo si cambia seguido o lo cambia alguien sin acceso al repo.         |
| Quién redacta                      | Lo redacta un/a abogado/a de la Municipalidad y lo pasa al equipo.      | Idem — el paso por el admin no le ahorra nada a nadie.                              |

La única razón fuerte para la base sería que **un no-programador publique un cambio sin
depender del equipo**. Eso no pasa con un texto legal de un municipio: el texto lo redacta
asesoría legal, alguien lo carga, y que ese "cargar" sea un PR es una ventaja (revisión,
diff legible, deploy atómico con la fecha). Si en el futuro aparece esa necesidad, el
registro de abajo es la costura: cambiar la _fuente_ de las versiones de "archivos" a "filas"
no toca ni el gate ni las aceptaciones.

Lo que **sí va a la base** son las **aceptaciones**: son datos de usuarios, se acumulan, se
consultan por usuario, y son la evidencia legal.

## Diseño

### 1. Registro de políticas (código)

Un módulo `src/lib/policies/registry.ts` es la **única fuente de verdad** de qué políticas
existen y cuáles son sus versiones (mismo espíritu que `AUDIT_ENTITIES` del milestone 16):

```ts
export const POLICIES = {
  privacy: {
    slug: "privacy", // URL pública: /policies/privacy
    title: "Política de privacidad",
    versions: [
      {
        version: "2025-11-16", // id de versión = fecha de publicación (ver abajo)
        effectiveAt: "2025-11-16", // desde cuándo rige (zona del predio)
        file: "privacy/2025-11-16.mdx",
        sha256: "…", // hash del archivo — lo verifica un test
        requiresAcceptance: true,
        reacceptance: "required", // "required" | "not-required" (cambio editorial)
        changeSummary: null, // en v1 no hay; en las siguientes, 1–5 viñetas en castellano
      },
    ],
  },
  // terms: { … }  — futuro: "Términos y condiciones de uso"
  // cookies: { …, requiresAcceptance: false } — ejemplo de política informativa
} as const satisfies Record<string, PolicyDefinition>;
```

Decisiones:

- **Una versión publicada es inmutable.** Cada versión es un archivo propio
  (`src/assets/policies/<key>/<version>.mdx`); cambiar el texto **es** agregar un archivo y
  una entrada. Un test (`registry.test.ts`) recalcula el SHA-256 de cada archivo y falla si
  no coincide con el registrado — editar una versión ya publicada rompe el build. Si de
  verdad hay que corregir una errata, se publica una versión nueva con
  `reacceptance: "not-required"`.
- **Id de versión = fecha** (`YYYY-MM-DD`, con sufijo `-2` si hubiera dos el mismo día).
  Es legible para el usuario ("versión del 16/11/2025"), ordena sola, y coincide con lo que
  la sección 12 de la política promete mostrar. **(propuesta)** — la alternativa es un
  entero (`v1`, `v2`), que no le dice nada a quien lee.
- **`requiresAcceptance` es por versión, no por política.** Así "esta política pasa a ser
  obligatoria" es simplemente una versión nueva con el flag en `true` — y el gate la pide.
- **`reacceptance`** separa un cambio sustancial (hay que volver a aceptar) de uno editorial
  (typo, formato, un link). Sin esto, la inmutabilidad obligaría a molestar a todos por una
  coma. La regla de "qué hay que aceptar" (§3) lo usa.
- **`effectiveAt`** permite desplegar una versión antes de que rija. Sin él, "rige" =
  "momento del deploy", que no es controlable. La versión vigente es la última con
  `effectiveAt <= ahora` (reloj de `src/lib/clock.ts`, así funciona con libfaketime).
- **`changeSummary`** es obligatorio para toda versión que no sea la primera (lo exige el
  test). Es lo que la pantalla "las políticas cambiaron" muestra arriba de todo.
- Validaciones del test, además del hash: archivos existen, versiones ordenadas por
  `effectiveAt` estrictamente creciente, ids únicos, slug único, `changeSummary` presente.

La página pública deja de tener `LAST_UPDATED` a mano: la toma del registro.

### 2. Páginas públicas

- `/policies/[slug]` — versión **vigente**, con "Vigente desde el …" y, si hay más de una,
  un enlace "Versiones anteriores". Reemplaza a `/policies/privacy/page.tsx`; la URL actual
  no cambia (sigue siendo `/policies/privacy`).
- `/policies/[slug]/versions` — lista de versiones (fecha, resumen de cambios, si requirió
  aceptación).
- `/policies/[slug]/versions/[version]` — el texto archivado, con un aviso "Esta no es la
  versión vigente" y link a la vigente. Es lo que permite mostrarle a una persona **exactamente
  lo que aceptó**.
- `/policies` — índice de todas las políticas (hoy no existe; el footer pasa a enlazarlo, o a
  cada una).
- Las páginas son estáticas (`generateStaticParams` desde el registro). El componente de
  render (`PolicyContent` + índice) se generaliza para recibir el MDX; el import dinámico de
  MDX se resuelve con un mapa `{ "privacy/2025-11-16": () => import(...) }` generado a mano en
  el registro o en un `content.ts` vecino (Next necesita imports estáticos).

### 3. Qué tiene que aceptar un usuario (la regla, pura y testeada)

`src/lib/policies/pending.ts` exporta una función pura:

```ts
pendingPolicies(registry, acceptances, nowMs) → Array<{ key, version, changeSummary, isFirstAcceptance }>
```

Para cada política:

1. Tomar la versión vigente `V` (última con `effectiveAt <= now`). Si no hay, o
   `V.requiresAcceptance` es `false` → nada pendiente.
2. Calcular la **versión exigida** `R`: la más reciente `≤ V` con `requiresAcceptance` y
   `reacceptance: "required"` (o la primera que pasó a requerir aceptación).
3. Está pendiente si el usuario **no tiene ninguna aceptación de una versión `≥ R`** de esa
   política.
4. Lo que se le pide aceptar es siempre `V` (la vigente), aunque lo que dispara el pedido
   sea `R`. Así una errata posterior a un cambio sustancial no deja al usuario aceptando un
   texto viejo.

Casos que cubren los tests: usuario nuevo (todo pendiente), aceptó la vigente (nada),
aceptó una anterior y hubo un cambio editorial (nada), aceptó una anterior y hubo un cambio
sustancial (pendiente, con su resumen), versión futura desplegada pero no vigente (nada
hasta `effectiveAt`), política que pasa de informativa a obligatoria (pendiente).

### 4. Modelo de datos

Una tabla nueva, **append-only** (`prisma/models/policies.prisma`):

```prisma
model PolicyAcceptance {
  id          String  @id @default(cuid(2))
  userId      String  @map("user_id")       // → User (no RegisteredUser: ver abajo)
  policyKey   String  @map("policy_key")    // "privacy"
  version     String                        // "2025-11-16"
  contentHash String  @map("content_hash")  // sha256 del archivo aceptado
  acceptedAt  BigInt  @map("accepted_at")   // ms, dbgenerated como el resto
  context     PolicyAcceptanceContext       // SIGNUP | REACCEPT
  ipAddress   String? @map("ip_address")
  userAgent   String? @map("user_agent")
  user        User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, policyKey, version])
  @@index([userId, policyKey])
  @@map("policy_acceptances")
}
```

- **Contra `User`, no `RegisteredUser`**: la aceptación ocurre en el registro (paso 1 del
  alta, §5), cuando todavía no existe el `RegisteredUser`.
- **`contentHash`** es la prueba de qué texto exacto se aceptó, independiente de git: si
  alguien reescribe la historia o mueve archivos, el hash sigue identificando el contenido.
- **IP y user-agent**: son la evidencia habitual de un consentimiento electrónico. Son datos
  personales; la propia política (sección 2) ya anticipa "dirección IP … con fines de
  seguridad". **(abierta)** confirmar con asesoría legal si alcanza con eso o si la versión
  nueva de la política debe mencionarlo explícitamente.
- **Append-only**: no hay `update` ni `delete` en `src/lib/db/policies.ts`. La única forma de
  que desaparezca una fila es la cascada al borrar el `User` (que hoy no existe como
  feature).
- **`onDelete: Cascade`** **(abierta)**: si algún día se borra una cuenta, ¿hay que conservar
  la evidencia del consentimiento por un plazo? Hoy no hay borrado de cuentas, así que no
  urge; queda anotado.
- No se agrega nada a `RegisteredUser` ni a `User`: el estado "tiene políticas pendientes"
  **se deriva** (registro + aceptaciones), nunca se guarda. Guardarlo obligaría a
  recalcularlo para todos en cada deploy que publique una versión.

### 5. Alta: aceptar en el registro (c)

- El formulario de registro (`auth/signin/page.tsx`, pestaña "Crear cuenta") muestra **un
  checkbox por cada política que hoy requiere aceptación**, sin tildar, con su título
  enlazado (abre en pestaña nueva): «Leí y acepto la [Política de privacidad]». El botón de
  crear cuenta queda deshabilitado hasta tildarlos todos, y Zod lo valida.
  - **Un checkbox por política, no uno global**: la Ley 25.326 pide consentimiento
    "libre, expreso e informado"; separados es lo defendible cuando haya más de una.
- El cliente manda `acceptedPolicies: [{ key, version }]`. **El servidor no confía en la
  lista**: recalcula las requeridas con el registro y
  - si falta alguna → 400;
  - si el cliente mandó una versión que ya no es la vigente (la política cambió mientras el
    formulario estaba abierto) → **409** "La política se actualizó; revisala y volvé a
    aceptar" y el form recarga la lista.
- `POST /api/auth/register` crea el `User` **y** las `PolicyAcceptance` (`context: SIGNUP`,
  IP y user-agent de la request) **en la misma transacción**. No puede quedar una cuenta
  creada sin su consentimiento.
- La lista de políticas a mostrar llega al formulario desde el servidor (la página que lo
  renderiza la lee del registro), no de una constante en el cliente.

¿Por qué en el registro y no en la completitud de perfil (`/auth/signup`, paso 2)? Porque el
registro **ya recolecta un dato personal** (el email) y lo guarda; el consentimiento tiene
que ser previo a la recolección. **(propuesta)**

### 6. El gate: "Las políticas cambiaron" (d)

**El gate es el invariante; el checkbox del alta es solo UX.** Cualquier usuario autenticado
con políticas pendientes — sea un alta vieja, un usuario existente al desplegar este
milestone, o alguien que se registró por un camino que en el futuro no muestre checkboxes
(OAuth) — queda frenado igual.

**Token.** El `jwt()` callback agrega `token.policiesPending: boolean` calculado con
`pendingPolicies()` (una consulta más: `SELECT policy_key, version FROM policy_acceptances
WHERE user_id = $1`). Se recalcula en cada llamada, como el baneo, así que una versión que
entra en vigencia a mitad de sesión frena al usuario en la siguiente navegación. El
`session()` callback lo expone.

**Middleware** (`src/middleware.ts`): después del chequeo de baneo y antes del de perfil
completo:

```
si autenticado && policiesPending && ruta ∈ {/user/**, /admin/**, /auth/signup}
  → redirect a /policies/accept?next=<ruta original>
```

- Aplica a **todos**, admins y superadmins incluidos.
- Las páginas públicas (`/`, `/news`, `/policies/**`, `/forms/**`) **no** se frenan: son
  públicas para cualquiera, logueado o no.
- Orden respecto del baneo: un usuario suspendido ve `/banned`, no el gate (no tiene sentido
  pedirle que acepte para seguir usando algo que no puede usar).
- Orden respecto del perfil completo: el gate va **antes**. Un usuario que se registró antes
  del milestone y nunca completó el perfil acepta primero y después completa.

**Pantalla** `/policies/accept` (fuera de `/user` para que el layout de gestión — que asume
un usuario operativo — no se cargue; usa el shell liviano estilo `/forms`):

- Título: «Actualizamos nuestras políticas» (o «Antes de seguir, aceptá nuestras políticas»
  si es la primera aceptación del usuario, típico de los usuarios existentes al desplegar).
- Por política pendiente: título, «vigente desde el …», el `changeSummary` en viñetas,
  «Leer la política completa» (abre la versión en pestaña nueva), y **«Ver qué cambió»**:
  un diff por palabras contra la versión que el usuario aceptó por última vez, reusando el
  diff de texto largo del panel de auditoría (milestone 16). Es barato porque las dos
  versiones son archivos. **(propuesta)** — si se descarta, el resumen alcanza.
- Un checkbox por política + «Aceptar y continuar». Secundario: «Cerrar sesión»
  (`signOut`). No hay "más tarde": el pedido (d) dice que no se puede seguir usando sin
  aceptar.
- Al aceptar: `POST /api/user/policies/accept` con `[{ key, version }]` → el servidor valida
  igual que en el alta (409 si cambió), inserta las aceptaciones (`context: REACCEPT`), y el
  cliente llama a `useSession().update()` para reescribir la cookie (el `jwt()` recalcula
  `policiesPending` desde la base — no hace falta, ni se permite, mandar el valor) y navega a
  `next` (validado: solo rutas internas que empiecen con `/user` o `/admin`, para no tener un
  open redirect).

**API.** El middleware no cubre `/api/**`, así que `requireActiveSession()` suma el chequeo:
si `session.policiesPending` → **403** con `code: "POLICIES_PENDING"`. Excepciones, que no
pueden pasar por ese guard: `POST /api/user/policies/accept`, `GET /api/session`, las de
NextAuth. Del lado cliente, `apiGet`/`apiSend` (`src/lib/api/client.ts`) reconocen ese
`code` y mandan a `/policies/accept` — así un usuario que tenía una pestaña abierta cuando
entró en vigencia una versión no ve un error genérico.

- **Prerrequisito**: las rutas de usuario que hoy usan `auth()` a pelo (`api/user/events`,
  `api/user/stats` y las que aparezcan al revisar) pasan a `requireActiveSession()`. Es el
  mismo hueco que el D24 del milestone 12 dejó a medias para el baneo; se cierra para los
  dos a la vez. Un test al estilo de `audit/actions.test.ts` que recorra
  `src/app/api/user/**/route.ts` y exija el guard evita que vuelva a abrirse **(propuesta)**.

**Lo que el gate no frena, a propósito**: cerrar sesión, leer las políticas, y las páginas
públicas. Y las inscripciones a eventos por `/forms/[slug]` — son **sin cuenta** y tienen su
propio texto; si deben aceptar la política de privacidad es una pregunta aparte **(abierta)**.

### 7. Visibilidad

- **Usuario**: en Configuración → Cuenta (milestone 17), un bloque «Políticas aceptadas»
  con cada aceptación (política, versión enlazada a su texto archivado, fecha). Sin acción:
  es solo lectura.
- **Admin**: en el detalle de usuario (`/admin/users/...`), el mismo bloque. Útil ante un
  reclamo ("¿esta persona aceptó?").
- **Sin reporte agregado** ("% de usuarios que aceptó la versión vigente") en esta pasada.
  Sería fácil (una consulta), pero nadie lo pidió.
- **Auditoría**: las aceptaciones **no** van a `audit_logs` — no son mutaciones de admin
  (el milestone 2 decidió que la auditoría es solo superficie admin) y la propia tabla ya es
  el registro inmutable.

### 8. Despliegue de este milestone (usuarios existentes)

Al desplegar, **todos los usuarios existentes quedan con la privacidad pendiente** (nadie
aceptó nunca nada) y ven el gate en su próximo ingreso con la variante de "primera
aceptación". Eso es lo correcto legalmente — hoy no hay consentimiento registrado — pero
conviene avisarlo antes (newsletter, noticia en el sitio) para que no se lea como un error.
Los superadmins seed (`sa1`/`sa2`) y los usuarios seed también: `prisma/seed.ts` pasa a crear
sus aceptaciones para que el entorno local no arranque frenado.

### 9. Fuera de alcance

- **Aviso previo de un cambio** (banner «El 1/12 cambia la política de privacidad» durante
  los días entre el deploy y `effectiveAt`, o un email). El diseño lo permite (`effectiveAt`
  futuro), pero no se pidió. **(abierta)**
- **Revocar el consentimiento** (retirarlo sin borrar la cuenta). La Ley 25.326 da derecho de
  supresión; hoy se ejerce por email (sección de la política). Construirlo implica borrado o
  anonimización de cuenta — otro milestone.
- **Editor de políticas en el admin**: descartado por la decisión central.
- **Notificar por email** a todos cuando entra en vigencia una versión.

## Plan de implementación (slices)

1. **Registro + versiones archivadas + páginas públicas.** Mover `privacy.mdx` a
   `privacy/2025-11-16.mdx`, `registry.ts` + test (hash, orden, archivos), `pending.ts` +
   tests, `/policies`, `/policies/[slug]`, versiones. Quitar `LAST_UPDATED`. Sin cambios de
   base. Desplegable solo.
2. **Modelo + alta.** Migración `policy_acceptances`, `src/lib/db/policies.ts` (solo
   `insert` y `list`), checkboxes en el registro, validación y transacción en
   `/api/auth/register`, seed.
3. **Gate.** `policiesPending` en `jwt()`/`session()`, middleware, `/policies/accept`,
   `POST /api/user/policies/accept`, `requireActiveSession()` + `POLICIES_PENDING` en el
   cliente de API, migrar las rutas de usuario sin guard + test que lo exija.
4. **Visibilidad**: bloque en Configuración → Cuenta y en el detalle de usuario admin.
5. **Docs**: CLAUDE.md (sección nueva "Políticas", y nota en Auth Flow sobre el gate y su
   orden respecto de baneo/perfil), este doc con lo realmente construido.

Slices 2 y 3 deben salir **juntos a producción**: el 2 sin el 3 hace que solo los nuevos
acepten; el 3 sin el 2 frena a los nuevos en el gate justo después de registrarse (funciona,
pero es feo).

## Verificación (cuando se implemente)

- Unit: `pendingPolicies` (casos del §3), `registry.test.ts`.
- Con FAKETIME: desplegar una versión con `effectiveAt` futuro, verificar que no frena;
  mover el reloj y verificar que frena en la siguiente navegación sin re-login.
- Manual: alta con y sin checkboxes (400), alta con versión vieja (409), gate en `/user` y
  `/admin`, gate vs baneo, API devuelve 403 `POLICIES_PENDING`, `next` malicioso
  (`//evil.com`, `https://…`) ignorado.
- `node scripts/mobile-shots.mjs` para `/policies/accept` y el registro.
