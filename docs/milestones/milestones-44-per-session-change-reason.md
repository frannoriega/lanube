# Milestone 44 — Motivo por sesión al cambiar sesiones

**Estado:** promoted (2026-11-25). Versión 1.2.0.

## Qué pidió el usuario (2026-11-25)

Los cambios de sesiones de un evento se hacen en lote. Permitir un **motivo por sesión** en lugar
de uno solo para todos los cambios. El lote tiene que seguir mandando **un solo correo por
participante**.

## Situación

- `sessionActionSchema` (`src/lib/schemas/events.ts`) no lleva motivo; el lote manda un único
  `sessionReason` y `sessionActionsNeedReason()` lo exige si hay algún cancel/reschedule.
- El panel «Sesiones» (`event-sessions.tsx`) muestra **un** textarea «Motivo de los cambios» al pie.
- Cada excepción ya tiene su propia columna `reason` (`reservation_exceptions`), así que el dato por
  sesión **ya tiene dónde guardarse**: hoy se escribe el mismo texto en todas.
- `notifyEventParticipantsBatch` (`src/lib/email/event-occurrence-update.ts`) ya manda **un correo
  por participante con todo el lote**; el in-app sale una vez por (participante, cambio).

## Diseño

- **`reason` por acción**: `cancel` y `reschedule` llevan `reason: string` (trim, 1–500,
  obligatorio — la regla de negocio del CLAUDE.md «un motivo es obligatorio para las excepciones de
  evento» se mantiene, ahora por sesión). `revert` no lleva (el aviso «restaurada» no tiene motivo).
- **Se elimina `sessionReason`** del cuerpo del `PUT` y `sessionActionsNeedReason()`. El único
  cliente es el formulario web, que se despliega junto; el conector MCP no edita sesiones.
- **UI:** cada fila con un cambio staged muestra debajo un campo «Motivo» (una línea que crece),
  obligatorio, enfocado al crear el cambio. Para no tipear lo mismo diez veces: un botón chico
  «Usar este motivo en todas» en la fila, que copia el texto a los demás cambios **sin motivo**
  (nunca pisa uno escrito). El botón «Guardar» del evento avisa cuántos cambios no tienen motivo y
  lleva al primero (`FormJumpIndex`/scroll). «Revertir» (milestone 40, F4) descarta acción y motivo.
- El diálogo «Reprogramar» no pide el motivo: el campo vive en la fila, igual para cancelar.
- **Servidor:** `updateEvent` escribe `reason` de cada acción en su excepción; el 400 de validación
  señala la acción sin motivo.
- **Correo:** sigue siendo **uno por participante**. Cada línea del cambio lleva **su** motivo
  («Martes 3/12 — cancelada. Motivo: feriado»). Si todas las líneas tienen el mismo motivo, se
  muestra una vez arriba (para que un lote de «feriado» no repita la palabra en cada línea). La
  notificación in-app (una por cambio) ya lleva el motivo de su cambio.
- **Auditoría:** cada excepción queda con su motivo en el snapshot del evento (registry `items`), no
  cambia la forma del registro.

## Criterios de aceptación

- [ ] Test del schema: cancel/reschedule sin motivo → error en esa acción; revert sin motivo → ok.
- [ ] Test del render del correo: motivos distintos por línea; motivos iguales → uno solo arriba.
- [ ] Un lote de tres cambios con motivos distintos manda **un** correo por participante con los
      tres, y cada excepción guardada tiene su motivo.
- [ ] El panel no deja guardar con un cambio sin motivo y lleva hasta él.

## Registro

(Sin implementar.)
