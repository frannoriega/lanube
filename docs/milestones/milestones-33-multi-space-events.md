# Milestone 33 — Eventos en varios espacios / todo el edificio

**Estado:** postergado por decisión del usuario (2026-11-17). Para discutir más adelante.

## Caso de uso

Hoy un evento usa **un solo espacio** (`Event.spaceId`): `create_event_reservation()` crea
una reserva por día de la semana en ese espacio, con `actor_size` = su capacidad, para
bloquearlo entero. Se quiere:

- Eventos en **varios espacios** (p. ej. coworking + auditorio), elegidos con checkboxes.
- **Todo el edificio**: el horario queda no disponible en todos los espacios.
- No mostrar la ubicación en la página del evento (hoy muestra el nombre del espacio).
- Varios espacios ⇒ **sin cupo por defecto**, salvo que se cargue uno.

## Lo que dijo el usuario

- Se puede asumir que los espacios no se agregan ni se quitan.
- Pero el sistema pretende ser **genérico**: en un lugar con muchos espacios, marcar uno por
  uno es demasiado. Tiene que ser fácil.
- Idea del usuario: **una tabla aparte** de bloqueos «de todo el edificio» que se consulte
  **primero**, antes de las reservas por espacio. Hace más complejas las consultas (ya se
  manejan días cerrados y otras cosas), pero quizás no tanto.

## Notas para la discusión

- La idea del usuario se parece mucho a lo que ya hacen los **días cerrados** (milestone 23):
  un bloqueo que aplica a todos los espacios y que la disponibilidad, `create_reservation()`
  y el calendario ya consultan. Un evento «de todo el edificio» podría reusar ese camino
  (un bloqueo de edificio con referencia al evento) en vez de N reservas.
- Con varios espacios elegidos (no todos), la alternativa es una relación evento ↔ espacios y
  una reserva por (espacio, día de la semana). Lo difícil no es el bloqueo (la
  disponibilidad ya es por espacio) sino la **edición**: las excepciones de sesión
  (cancelar/reprogramar) y el aviso «esta edición borraría cambios» (`EventEditDropWarning`)
  hoy asumen una reserva por día de la semana; con varios espacios hay que aplicarlas a cada
  una.
- Los reportes por espacio (milestone 31) tendrían que repartir las horas del evento entre
  los espacios que ocupa.

## Registro

(Sin implementar.)
