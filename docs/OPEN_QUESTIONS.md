# Open questions

A running list of product/design decisions that are still undefined — things
worth a conversation before or during the milestone that depends on them.
Resolved items move into the relevant milestone doc's own "Resolved" section
and get deleted from here; this file should only ever hold what's still open.

Grouped by milestone. See `docs/milestones/` for the full context behind each.

## Milestone 2 — Audit trail

Cascade attribution and rollout order are resolved — see
[`milestones/milestones-2-audit-trail.md`](./milestones/milestones-2-audit-trail.md).
What remains is product policy, not engineering:

- **Retention**: keep audit logs forever, or age them out after N months/years? Now that
  every admin mutation writes an entry (check-outs included, which are the highest-volume
  source), the table grows faster than it did — so this is worth deciding before it is a
  problem rather than after. Affects whether a cron-based purge is in scope.
- **Scope of "activity"**: admin-surface mutations only (current), or also user
  self-service actions (cancelling one's own reservation, editing one's own profile)?
  Recommend staying admin-only unless something specific drives the broader scope;
  instrumenting every write in the app is a materially bigger effort.
- **Who can see what**: is the full trail superadmin-only (current), or can ADMIN see a
  filtered subset — e.g. everything except role and ban changes on other admins? Would
  mean splitting `audit:view` into two permissions.
- **Should check-outs live in the same trail?** They are instrumented now, and the view
  filters by action and entity type, so they do not drown anything today. If the volume
  becomes a nuisance in practice, the alternative is a separate lighter log rather than
  going back to not recording them.

## Milestone 3 — Seasonal landing themes

- **Accent-preset swap** (v2, deferred): which named presets to build first
  (e.g. "Aniversario" gold, "Navidad" red/green), and whether a developer-curated
  list is an acceptable trade-off against true color freedom for a superadmin —
  the recommendation is to keep it curated, to protect `DESIGN.md`'s restraint
  rules, but this hasn't been explicitly confirmed for v2.
- **Top banner/ribbon** (v2, deferred): not yet scoped in detail — text length
  limit, whether it's dismissible, whether it appears on every public page or
  just the landing.
- **Beyond the anniversary**: is a Christmas theme (or others) wanted on the
  same system once v1 ships, or was the anniversary the only concrete trigger
  for building this at all? Affects how soon v2 (banner/accent) gets prioritized.

## Milestone 4 — Noticias / Comunicador

- **Comments/reactions on news posts**: explicitly out of scope unless raised —
  listed here only so it stays a deliberate "not now," not an oversight.

## Milestone 9 — Dynamic roles

- **Vercel Global Config store for the role cache.** Milestone 9 decided role→permission
  lookups should live in an edge-readable store so edits take effect immediately across
  instances. Shipped instead: an in-process snapshot (30 s TTL, invalidated on every role
  write) behind the same interface, because creating the store and wiring its token is an
  account-level action, not a repo change. Open: provision it and implement the provider,
  or accept the in-process cache as the permanent answer. See
  [`milestones/milestones-9-dynamic-roles.md`](./milestones/milestones-9-dynamic-roles.md).
- **Bulk reassignment before deleting a role.** Deleting an in-use role is blocked with a
  409 naming the affected user count; there is no UI to move those users somewhere else
  first. Worth building only if roles turn out to churn in practice.

## Milestone 10 — Frontend audit (error handling, a11y, security)

The audit's five original questions are resolved — see the status block in
[`milestones/milestones-10-frontend-audit-hardening.md`](./milestones/milestones-10-frontend-audit-hardening.md).
What is still open is the work deliberately held back:

- **The CSP nonce (F3.1).** `'unsafe-inline'` is still in `script-src`, which is the
  single biggest remaining gap in the header: it permits exactly the injected script the
  policy exists to stop. Everything else in slice C shipped. Removing it needs a
  middleware-generated nonce, and a wrong nonce blanks the whole app with `npm run build`
  passing — so it wants a preview deployment walked route group by route group,
  `/forms/[slug]` included (the auth-gated routes never exercise it). Open: schedule that,
  or accept `'unsafe-inline'` as the standing position.
- ~~**Dark mode for the auth pages.**~~ **Resolved (milestone 11, 2026-09-24): light-only
  by decision.** `signin` / `reset` / `signup` carry no `dark:` classes and deliberately
  won't; new auth markup should match the page's existing hardcoded light palette
  (`text-blue-900`, `bg-slate-200`) rather than introduce tokens. Still open as a tidy-up:
  the pages remain wrapped in `ThemeProvider`, which now does nothing for them and could
  be dropped.
- **Did the `--muted-foreground` change land well?** It moved `#888282` → `#666666`,
  affecting ~220 secondary-text usages at once to clear AA. Measured and now asserted in
  `src/lib/contrast.test.ts`, but it is a deliberate visual change and nobody has looked
  at it in a browser yet.
- **Is the per-day "Reservar" button the right keyboard path?** Built as option (a), the
  audit's own recommendation, because the alternative was leaving a WCAG Level A failure
  with no workaround. It adds a visible control to every day column — worth confirming it
  reads well before merge, and whether it should also appear on touch-width layouts.
- **Finish the Incidents feature.** Now honest about being unavailable rather than faking
  a working screen, and unreachable from the nav. The `Incident`/`IncidentUser` models and
  a commented-out implementation exist. Its own milestone when it is wanted.

## Milestone 12 — Auditoría de dominio (reservas, publicar-y-editar, retención)

Los defectos de ingeniería de la auditoría del 2026-09-24 y de su segunda pasada del 2026-09-25
están corregidos — ver
[`milestones/milestones-12-domain-audit-reservations-and-lifecycle.md`](./milestones/milestones-12-domain-audit-reservations-and-lifecycle.md).
Tres preguntas de producto surgidas en el proceso se **respondieron e implementaron**: el camino de
corrección en el lugar del Comunicador (D20, resuelto como "corregir en el lugar + marcar para
re-revisión"), la reducción de capacidad de un evento (D11, resuelto como "avisar y confirmar") y la
retención del historial de reportes (D7, resuelto como 3 años compactado / 12 meses de detalle
crudo). Viven en el doc del milestone. Lo que queda abierto acá:

- **¿La base desplegada está en sincronía con las migraciones?** Nada verifica que las funciones
  que corren en producción coincidan con `prisma/migrations/**`. El incidente de `get_actor_size`
  — una reescritura que se salteó una función, rompiendo toda operación de ledger de EVENT hasta
  que `20260713000000` lo atrapó — es el precedente. Este milestone agrega once migraciones con
  funciones nuevas, así que la superficie creció. Vale un chequeo, y quizá una aserción de arranque.
- **¿La retención de auditoría debería seguir a la de reportes?** El historial de reportes quedó en
  3 años compactado. `audit_logs` sigue creciendo sin política (el ítem abierto del milestone 2).
  Son la misma clase de decisión y probablemente merecen una sola respuesta.
- **¿Meter la ventana dentro de `get_user_next_reservations`?** La slice G subió el techo de
  ocurrencias del calendario de 100 a 500 y agregó un warning de desarrollo, pero la corrección
  real es que la función SQL reciba el rango pedido y devuelva solo eso. Cambia su firma y tiene
  otros callers, así que se dejó anotado.
- **Documentación en inglés que quedó.** El código y los docs nuevos de este milestone están en
  español (ver la memoria `feedback-docs-in-spanish`). Siguen en inglés: `CLAUDE.md`, los docs de
  los milestones 1–11, y la mayoría de los comentarios pre-existentes del código. Convertirlos es
  un barrido aparte; decidir si se hace, y en qué orden, queda abierto.

## Housekeeping

- **Production storage must have `BLOB_READ_WRITE_TOKEN`.**
  `docs/design/02-architecture.md#storage-abstraction` links here for this, but
  the item had never actually been written down. `getStorage()` falls back to
  the `local` filesystem provider when the token is absent — which on Vercel
  means uploads (event/space/news images) write to a throwaway filesystem and
  vanish, **silently**. Open: should the `local` provider hard-fail when
  `NODE_ENV === "production"` instead of degrading quietly?
- **`/api/cron/report-snapshot` is not scheduled.** The route exists and writes
  `report_snapshots` rows, but `vercel.json`'s `crons` array only lists
  `/api/cron/maintain-reservations`. So it never fires in production. Decide
  whether to add a schedule (note Hobby-tier cron limits) or drop the endpoint.
  Found during the milestone-10 audit; not a milestone-10 finding since it's
  backend/config, not frontend.

## Milestone 14 — Mobile redesign

See [`milestones/milestones-14-mobile-redesign.md`](./milestones/milestones-14-mobile-redesign.md)
for the full audit. Nothing is resolved yet — the whole redesign is open, handed to a
design-focused session rather than decided here:

- **Booking calendar**: shrink the existing 5-weekday grid to fit a phone, or replace the
  mobile view with a different interaction model (day-at-a-time with swipe/tabs, an
  agenda/list view)? Affects how much of `WeekCalendar.tsx` is touched.
- **Admin config tables** (Espacios, Recursos, Tipos de reserva, Temas del landing,
  Audit log, Noticias list — 6 screens): card-list layout, hide-less-important-columns,
  or keep horizontally-scrollable tables and just fix the page-level overflow +
  discoverability? Whatever's picked should be one reusable pattern, not six bespoke
  fixes.
- **Horizontal-scroll affordance convention**: for anything that stays scrollable (the
  admin tables if kept, the admin reservations day-timeline), what's the visual language
  for "there's more this way" — fade, shadow, arrows? Should be a shared pattern.

## Milestone 17 — Configuración de la cuenta y passkeys

Contexto en
[`milestones/milestones-17-account-settings-and-passkeys.md`](./milestones/milestones-17-account-settings-and-passkeys.md).
Los códigos de recuperación y el aviso de decisiones ya están hechos (segunda pasada).

- **OAuth (Google/GitHub)** — postergado. Ya decidido: se **pide la contraseña antes de
  vincular** (nunca por coincidencia de email) y se conecta desde Seguridad ("Conectar tu
  cuenta de X"). Falta: dónde viven las credenciales de cada proveedor (el doc de diseño pide
  configuración en runtime por el superadmin, con secretos cifrados) y crear las apps.
- **Cambiar la contraseña desde Seguridad** — decidido que va ahí (alivia el SMTP), pero
  postergado: por ahora alcanza con el reset por email y los códigos de recuperación.
- **¿Avisar por email cuando se usa un código de recuperación?** No se sumó sin preguntar.
- **El email de `news.decided` no escapa el motivo** (lo interpola crudo en el HTML). El de
  `profileChange.decided` sí; convendría alinear el de noticias.
- **`docs/design/06-rust-migration.md`** describe una migración de este repo a Rust que quedó
  descartada; falta marcarlo como superado.

## Milestone 19 — Políticas versionadas y aceptación obligatoria

Contexto en
[`milestones/milestones-19-policies-and-acceptance.md`](./milestones/milestones-19-policies-and-acceptance.md).
Las decisiones de diseño marcadas "(propuesta)" en el doc también esperan confirmación.

- **IP y user-agent como evidencia del consentimiento**: ¿alcanza con lo que dice hoy la
  sección 2 de la política, o la versión nueva tiene que mencionarlo explícitamente? Para
  asesoría legal.
- **¿Conservar la evidencia al borrar una cuenta?** La tabla cascadea con `User`. Hoy no
  existe el borrado de cuentas, así que no urge.
- **Aviso previo de un cambio** (banner o email entre el deploy y `effectiveAt`). El diseño lo
  permite; no se pidió.
- **Inscripciones a eventos sin cuenta** (`/forms/[slug]`): ¿deben aceptar la política de
  privacidad? Recolectan nombre y email.

## Milestone 20 — Conector MCP

Contexto en
[`milestones/milestones-20-mcp-connector.md`](./milestones/milestones-20-mcp-connector.md).

- ~~**OAuth a mano o con librería**~~ **Resuelto (2026-10-04, implementación):** a mano
  (`src/lib/oauth/`) + SDK oficial v2 (`@modelcontextprotocol/server`) solo para el transporte.
- ~~**¿Saltear el consentimiento si ya hay un grant con los mismos scopes?**~~ **Resuelto:** no,
  se muestra siempre.
- ~~**Marcar las reservas creadas por un asistente**~~ **Resuelto:** `Reservation.origin`
  (`WEB`/`ASSISTANT`) + `originClientName`, chip «Vía asistente» en el detalle del admin.
- ~~**¿Cambiar la contraseña / canjear un código de recuperación revoca los asistentes
  conectados?**~~ **Resuelto:** sí, en la misma transacción.
- **Reservas recurrentes desde el asistente** — sigue fuera; reabrir si se pide.
- **Probar con Claude web y ChatGPT contra un deploy público** (slice 6) — pendiente. Ojo con
  la Deployment Protection de las previews de Vercel: el asistente recibiría la página de login
  de Vercel en lugar del `401` de OAuth.
- **Scope insuficiente como `403` + step-up** en lugar de un error de tool — solo si algún día
  existe un asistente de "solo consultar".
