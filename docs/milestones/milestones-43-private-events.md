# Milestone 43 — Eventos privados e invitados

**Estado:** promoted (2026-11-25). Versión 1.2.0. Se combina con el milestone 34 (participantes):
ver «Relación con el 34».

## Qué pidió el usuario (2026-11-25)

- Un evento tiene un **interruptor «Privado»**. Si es privado, aunque esté publicado, **no aparece**
  en la página de eventos.
- Si tiene formulario e inscriptos, el **enlace de inscripción se puede compartir** con quien se
  quiera invitar.
- Estaría bueno tener una **lista de emails de invitados**: para validar el formulario y para
  **mandar la invitación por correo**.

**Decisión del usuario (misma sesión):** la lista es **opcional y restringe si existe**. Privado =
oculto de las superficies públicas. Si el admin carga invitados, solo esos emails pueden
inscribirse; sin lista, puede inscribirse cualquiera que tenga el enlace.

## Diseño

### Modelo

- `Event.isPrivate Boolean @default(false)` (migración nueva). Independiente del `status`: un
  evento privado puede ser DRAFT/PUBLISHED/PAUSED como cualquiera; «privado» solo cambia **dónde
  se lista**.
- Tabla `event_invitees`: `id`, `eventId` (FK cascade), `email` (normalizado, mismas reglas que los
  participantes), `displayEmail`, `createdAt`, `invitedAt` (último envío de invitación, `null` si
  nunca se mandó), `inviteCount`. `@@unique([eventId, email])`.
- La lista **solo tiene efecto si el evento es privado** (si se lo vuelve público, la lista queda
  guardada pero no restringe; el formulario lo dice).

### Dónde no aparece un evento privado

Toda superficie pública o de otras personas lo trata como **no listado**:

- landing «Próximos eventos», `/events` y `/events/[id]` (**404**, para que adivinar ids no lo
  revele), destacados (un evento privado no se puede destacar: el switch se deshabilita y el bulk
  «Destacar» lo saltea con motivo), sitemap (milestone 41);
- calendario de un espacio y calendario de actividades del **usuario**: igual que un evento no
  público hoy, «Reservado para un evento», sin nombre ni links (regla del milestone 29) — salvo para
  quien **está inscripto**, que lo ve en su calendario y su tablero como cualquier evento propio;
- conector MCP: las herramientas públicas (`list_events`, `get_event`) no lo devuelven; las de
  gestión (solo lectura) sí, marcadas «privado».
- El panel de admin lo muestra con un chip «Privado» y un filtro.
- Todo pasa por las lecturas cacheadas (`public-reads.ts`) con un filtro `isPrivate: false` en un
  solo lugar (`publicEventWhere`), y el test de caché público lo cubre.

### El enlace

- `/forms/[slug]` funciona igual para un evento privado publicado: muestra el evento (`EventHero`)
  y el formulario. Lleva `robots: noindex` y su vista previa al compartir (milestone 41).
- En la edición del evento y en su tarjeta del listado admin: «Copiar enlace de inscripción»
  (`CopyField`, ya existe).

### Validación contra la lista

- En `submitForm` (y en el **walk-in** del check-in no: la puerta decide, regla del milestone 30),
  si el evento es privado **y** tiene al menos un invitado, el **email de quien inscribe** debe estar
  en la lista; si no, 403 con «Este correo no está en la lista de invitados de este evento. Si te
  invitaron, usá el correo al que te llegó la invitación.» Se valida **también** al editar desde el
  enlace (el email no se puede cambiar, así que solo importa la inscripción).
- Con el milestone 34, **solo el email del participante principal** (quien inscribe) se valida
  contra la lista; los demás integrantes de un equipo no tienen que estar invitados (se invita a
  quien arma el equipo). Ver «Preguntas abiertas».
- El mensaje revela si un email está en la lista; se acepta (quien lo prueba ya tiene el enlace) y
  la ruta ya tiene captcha + límite por IP/email.
- «Pedir un enlace nuevo» no cambia.

### Administrar invitados

- Página propia **`/admin/events/[id]/invitees`** («Invitados», en las acciones del evento y en su
  breadcrumb; `SEGMENT_LABELS`), con `events:manage`: `DataTable` (email, estado «Invitado el … /
  Sin enviar / Inscripto», acciones a la derecha), regla de listas largas en página y no en modal.
- **Agregar**: un textarea para pegar muchos emails (separados por coma, espacio o línea), que se
  normalizan, se deduplican y se informan los inválidos/repetidos antes de guardar. Importar desde
  CSV queda fuera.
- **Quitar** invitados (selección + bulk). Quitar a alguien que ya se inscribió **no** cancela su
  inscripción (se le avisa al admin en la confirmación).
- **Enviar invitaciones**: bulk sobre la selección o «a los que no se les envió»; confirmación con
  la cantidad. El correo (`src/lib/email/event-invitation.ts`) lleva nombre, fechas, copete, imagen
  y el botón al formulario. Respeta el área de mantenimiento `event-emails`. Mismo envío sincrónico
  que el resto (`TODO(scale)` a ~100+ destinatarios: en este caso es más probable llegar, así que se
  manda en tandas con `after()` y se registra `invitedAt` por cada envío exitoso). Reenviar es
  posible (sube `inviteCount`). El correo de invitación **no** lleva enlace de edición (no hay
  inscripción todavía).
- La columna «Inscripto» cruza la lista con `EventParticipant` (estados que ocupan lugar).

### Auditoría y caché

- `Event` suma el campo `isPrivate` en el registry (`bool`). Eventos nuevos en `AUDIT_EVENTS`:
  `event.inviteesAdd`, `event.inviteesRemove`, `event.invitationsSend` (custom, con la cantidad y
  los emails en `extra`). La ruta de invitados se agrega a `actions.test.ts` sin excepciones.
- Cambiar `isPrivate` llama `revalidatePublic(PUBLIC_TAGS.events)` (ya lo hace el `PUT` del evento).

## Relación con el 34

El formulario con «Participante» (34) define **quién inscribe** como el primer nodo; ese email es el
que se valida contra la lista. Si el 43 se implementa antes que el 34, se valida el email actual de
la inscripción (es el mismo dato).

## Criterios de aceptación

- [ ] Un evento privado publicado no aparece en landing, `/events`, sitemap ni MCP público, y
      `/events/[id]` da 404; el enlace del formulario funciona.
- [ ] Con lista: un email fuera de la lista no se puede inscribir (test de `submitForm`); sin lista,
      sí.
- [ ] Pegar 50 emails con repetidos e inválidos agrega solo los válidos y lo informa.
- [ ] «Enviar invitaciones» manda un correo por invitado y registra `invitedAt`; en mantenimiento de
      `event-emails` no manda y lo dice.
- [ ] Quien está inscripto ve el evento privado en su calendario; otro usuario ve «Reservado para un
      evento».
- [ ] Auditoría de cambios de privacidad, invitados y envíos.

## Preguntas abiertas

- ¿Los integrantes de un equipo (34) también tienen que estar invitados? Propuesta: no (decidido así
  por defecto; cambiarlo es una regla en `submitForm`).

## Registro

(Sin implementar.)
