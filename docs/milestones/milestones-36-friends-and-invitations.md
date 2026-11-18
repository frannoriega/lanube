# Milestone 36 — Amistades, directorio e invitados a una reserva

**Estado:** seed (2026-11-18). Idea del usuario, sin diseño. Probablemente se haga junto con el
milestone 6 (equipos y organizaciones): comparten la pregunta «¿quién es parte de mi gente?».

## La idea (palabras del usuario)

Que las personas puedan **hacerse amigas** entre sí, de modo que el sitio crezca hacia algo cercano
a una **plataforma social**. Tener a alguien como amigo, o a sus miembros en una especie de
**directorio**, permite **sumar personas a una reserva** (como invitar gente a un evento en Google
Calendar).

## Lo que sugiere (preguntas para cuando se discuta)

- Modelo: relación de amistad (solicitud → aceptación, simétrica) vs. «seguir» (asimétrica).
  Relación con `Team`/`Organization` del milestone 6: ¿el directorio es de la organización, del
  equipo o global?
- Invitar a una reserva: ¿el invitado la ve en su calendario («Calendario», milestone 32)? ¿Cuenta
  para la capacidad (`actor_size`)? ¿Puede aceptar o rechazar? ¿Puede ver el detalle (título y
  descripción, milestone 35)?
- Privacidad: hoy el calendario de usuario **nunca** expone reservas ajenas (solo «Ocupado»);
  una reserva con invitados es una excepción deliberada que hay que diseñar con cuidado.
- Notificaciones: se apoyan en el sistema del milestone 13 (`notify()`).
- Moderación y bloqueo entre personas (si crece a red social).

## Relaciones

- Base de [milestone 37](./milestones-37-ideas-platform.md) (círculos «amigos / equipos /
  organizaciones / público»).
- Se apoya en el milestone 6 y en el título/descripción de reserva del milestone 35.
