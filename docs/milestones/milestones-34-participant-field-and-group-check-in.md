# Milestone 34 — Campo «Participante» y check-in de grupos

**Estado:** postergado (2026-11-17). No se implementa por ahora.

## Contexto

En los eventos con grupos (p. ej. «grupos de trabajo»), **una persona inscribe a todo el
grupo**: para eso están los grupos repetibles del formulario, donde se carga la información
de cada integrante. En el check-in del milestone 30 se registra solo a **quien inscribió al
grupo**; los integrantes no son participantes por separado.

## Idea del usuario

Un **tipo de campo nuevo, «Participante»**: un atajo para la información básica de una
persona (nombre, apellido, DNI, email), usable:

- en cualquier formulario, en lugar de armar esos campos a mano;
- al inscribir grupos («somos X participantes en este grupo»), como el contenido del grupo
  repetible.

Con eso, cada integrante del grupo es identificable y el check-in puede tratarlos como
**participantes separados** (buscar por su email, marcar su ingreso, contarlos en la
asistencia del milestone 31).

## Notas para el diseño

- Decidir si cada integrante se materializa como un `EventParticipant` propio (con un
  vínculo al que inscribió) o si el check-in apunta a «inscripción + índice del integrante».
- El cupo: hoy una inscripción cuenta como un lugar; un grupo de X debería contar X.
- El campo de email del integrante: ¿obligatorio? Sin email no se lo puede buscar en la
  puerta.

## Registro

(Sin implementar.)
