# Milestone 34 — Campo «Participante» y check-in de equipos

**Estado:** promoted (2026-11-25), versión 1.2.0. Estuvo postergado (2026-11-17); el usuario lo
retomó con un diseño propio el 2026-11-25. La idea original se conserva al final.

## Qué pidió el usuario (2026-11-25)

- Al crear un formulario, poder definir **qué es un «participante»**: un grupo de campos donde el
  **email es obligatorio** y después lo que quieran (nombre, apellido, DNI, etc.), que queda
  **elegible como un campo** del formulario.
- El **primer campo del formulario es siempre el participante** (el email que ya pedimos, extendido
  con la forma que eligieron).
- Si hacen falta más participantes en una misma inscripción, simplemente se agregan campos
  «participante». Caso de uso: inscripciones donde el participante es un **equipo** (quien inscribe
  - los demás integrantes).
- Con esa lista de participantes se hace el **check-in**. La **búsqueda** del check-in debería ser
  por **cualquiera de los campos del participante** de ese formulario (cada formulario tiene su
  forma).
- El **cupo** de un evento se lee como **cantidad de inscripciones**, no de participantes: cupo 20 =
  20 equipos aunque cada uno tenga 5 personas.

**Decisiones del usuario (misma sesión):**

- Un email puede estar en **una sola inscripción** del evento (como quien inscribe o como
  integrante). El formulario rechaza los repetidos con un mensaje claro.
- Los integrantes que **no** inscriben **no reciben ningún correo**: solo quien inscribe recibe la
  confirmación y el enlace de edición, como hoy.

## Diseño

### Forma del participante (por formulario)

- `Form.participantShape Json` — lista ordenada de subcampos. El primero es fijo:
  `{ key: "email", type: EMAIL, label: "Email", required: true }` (no se puede quitar ni mover).
  Los demás, elegidos por quien arma el formulario entre tipos simples: `SHORT_TEXT`, `DNI`,
  `PHONE`, `DATE`, `SINGLE_SELECT`; cada uno con `label`, `required` y su `key` estable (cuid,
  igual que los ids de campo, para que las respuestas sobrevivan renombrar una etiqueta).
- Se edita en el constructor de formularios en una sección propia «Participante» arriba de los
  campos, con vista previa. Los atajos «Nombre», «Apellido», «DNI» se ofrecen como chips de un clic.
- Al clonar la plantilla en una instancia (bind al evento), la forma se clona con el resto (es un
  snapshot, como los campos). Cambiar la forma de una **instancia** con inscriptos está bloqueado,
  igual que cambiar de plantilla.
- **Formularios existentes**: la migración les pone la forma mínima `[email]`. No cambia nada para
  quien se inscribe.

### Nodo «Participante» en el árbol del formulario

- `form-schema.ts` suma un tipo de nodo `kind: "participant"` (junto a `input` y `group`). Su valor
  es un objeto con los subcampos de la forma. Se valida con la misma forma (email normalizado,
  DNI/phone con las reglas de sus tipos).
- **El primer nodo del formulario es siempre un participante con `role: "primary"`**: es quien
  inscribe. Reemplaza al campo email suelto que pide hoy el formulario público (el email de la
  inscripción, `EventParticipant.email`, sale de ese nodo). No se puede borrar ni mover.
- Los demás nodos participante (`role: "member"`) se agregan como cualquier campo: sueltos
  («Integrante 2», obligatorio u opcional) o **dentro de un grupo repetible** («Integrantes», de 0 a
  N) — los grupos repetibles ya existen (`GroupNode.repeat`), así que «hasta 5 integrantes» es un
  grupo repetible con un participante adentro. Un nodo participante no puede contener otros.
- Respuestas: `answers` mantiene el árbol (`form-engine.ts`); los valores del participante van
  dentro del árbol igual que cualquier campo, y además se **materializan** (abajo) para buscar y
  hacer check-in sin recorrer JSON.

### Datos: integrantes materializados

- Tabla nueva `event_participant_members`: `id`, `participantId` (la **inscripción**, FK cascade),
  `eventId`, `role` (`PRIMARY`/`MEMBER`), `email` (normalizado), `displayEmail`, `data Json`
  (subcampos de la forma, por `key`), `nodePath` (de qué nodo/índice del árbol salió, para
  reconstruir la edición), `position`, timestamps.
- `EventParticipant` **sigue siendo la inscripción** (estado, enlaces de edición, decisión, cupo).
  Todo lo que cuenta cupo (`SPOT_HOLDING_STATUSES`) **no cambia**: cuenta inscripciones. Así el
  pedido del usuario (cupo = equipos) ya es lo que hace hoy.
- Se escribe en la misma transacción que la inscripción, desde las respuestas (al inscribirse, al
  editar por el enlace, en el walk-in). La función que extrae los integrantes de un árbol de
  respuestas es pura y testeada.
- **Unicidad (decisión del usuario):** un email aparece en una sola inscripción **activa** del
  evento. Se chequea en `submitForm`/edición bajo el mismo advisory lock que el cupo, contra los
  integrantes de inscripciones en `SPOT_HOLDING_STATUSES`, y dentro de la misma inscripción (dos
  integrantes con el mismo email). No es un `UNIQUE` de base porque una inscripción cancelada o
  rechazada libera los emails de sus integrantes (rechazada: la regla `blocksReRegistration` sigue
  aplicando a **quien inscribió**). Mensaje: «X ya está inscripto en este evento (en otra
  inscripción).» Mismo cuidado que hoy: no revelar si fue rechazado.
- Migración: un integrante `PRIMARY` por cada inscripción existente (su email), sin `data`.

### Check-in por integrante

- `EventCheckIn` pasa a apuntar al integrante: columna `memberId` (FK cascade a
  `event_participant_members`), unique `(memberId, occurrenceStart)`; `participantId` se mantiene
  para agrupar y para las reglas de «dejar pasar» (que miran el estado de la **inscripción**).
  Migración: los check-ins existentes pasan al integrante primario de su inscripción.
- Pantalla de la puerta (`/admin/events/[id]/checkin`): la tabla lista **integrantes**, agrupados
  por inscripción (equipo), con una columna por subcampo de la forma de ese evento (se eligen con el
  selector de columnas). La **búsqueda** filtra por cualquier subcampo de la forma (normalizando
  acentos y mayúsculas; el DNI sin puntos). Sigue sin mostrar las respuestas que no son del
  participante (regla del milestone 30).
- Marcar ingreso es **por integrante**; una acción «Ingresar a todo el equipo» marca a los que
  faltan. «Dejar pasar» una inscripción no aprobada aprueba la inscripción entera (no cambia la
  regla del 30).
- **Walk-in:** llena el formulario completo, con sus participantes; quedan todos como integrantes.
- **Quitar un integrante que ya hizo check-in** (editando por el enlace): se bloquea con un mensaje
  («No se puede quitar a X: ya registró su ingreso»). Perder registros de asistencia sería peor que
  pedirle que avise en la puerta.

### Lo que cambia alrededor

- **Reportes de eventos (31):** asistencia = integrantes con check-in ÷ integrantes de
  inscripciones aprobadas, por sesión; además «inscripciones (equipos)» e «integrantes». Los walk-ins
  siguen aparte. El snapshot mensual suma los dos números.
- **Tabla de inscriptos** del admin y su **exportación**: una fila por inscripción con los
  integrantes en columnas aplanadas (`form-export.ts` ya aplana grupos repetibles), y una vista/
  export «por integrante» para quien necesita la lista de personas.
- **Correos:** sin cambios de destinatarios (decisión del usuario): solo quien inscribe.
- **Conector MCP** (`list_event_participants`, gestión de solo lectura): devuelve los integrantes de
  cada inscripción.
- **Eventos privados (43):** la lista de invitados se valida contra el **participante primario**.

### Fuera de alcance

- Vincular integrantes a cuentas (`userId` por integrante) — cuando exista el milestone 36.
- Correos a integrantes (decidido que no).

## Criterios de aceptación

- [ ] Constructor: la sección «Participante» define la forma; el primer nodo es el participante
      principal y no se puede borrar; se pueden agregar participantes sueltos y dentro de un grupo
      repetible.
- [ ] Formularios e inscripciones existentes siguen funcionando tras la migración (test de la
      migración de datos con un fixture).
- [ ] Inscribir un equipo de 5 ocupa **un** lugar del cupo.
- [ ] Un email repetido (en la misma inscripción o en otra activa) se rechaza; tras cancelar la
      otra inscripción, se acepta.
- [ ] Check-in: buscar por DNI o apellido encuentra al integrante; marcar a uno no marca al resto;
      «todo el equipo» marca a los que faltan.
- [ ] Reportes: asistencia por integrantes, con test en `report-stats.ts`.
- [ ] Solo quien inscribe recibe correos.

## Idea original (2026-11-17, conservada)

Un tipo de campo «Participante» (nombre, apellido, DNI, email) como atajo para formularios y como
contenido de grupos repetibles, para que el check-in trate a cada integrante por separado. Notas de
entonces: decidir entre materializar integrantes o apuntar a «inscripción + índice» (→ se
materializan); el cupo de un grupo de X debería contar X (→ **revertido por el usuario**: el cupo
cuenta inscripciones); el email del integrante, ¿obligatorio? (→ sí, es el único campo fijo de la
forma).

## Registro

(Sin implementar.)
