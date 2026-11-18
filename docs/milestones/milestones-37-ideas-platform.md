# Milestone 37 — Plataforma de ideas y propuestas (con votación)

**Estado:** seed (2026-11-18). Idea muy amplia del usuario; se anota para no perderla.

## La idea (palabras del usuario)

Una vez hechas las amistades (milestone 36), una **plataforma para intercambiar ideas** — entre
amigos, equipos, organizaciones o **públicamente** — o **propuestas para el espacio**, con
**votación** y «todo eso».

## Relación con lo que ya está planeado

- El **milestone 7** (Propuestas) es la versión chica: una caja de sugerencias con comentarios de
  un nivel y estados `PENDING → IN_REVIEW → APPROVED/REJECTED` decididos por admins. Este
  milestone la **absorbe o la reemplaza**: cuando se discuta, decidir si 7 se hace antes como
  base (y esto lo extiende) o si se cancela 7 a favor de éste.
- Hay un esquema dormido `Proposal`/`ProposalComment`/`ProposalLike` en la base.

## Preguntas abiertas

- **Alcance de cada publicación:** privada, amigos, equipo, organización, pública (hereda el
  modelo de círculos del milestone 36).
- **Votación:** un voto por persona, ¿a favor/en contra o solo «me gusta»? ¿Pesa distinto un miembro
  que un visitante? ¿Hay un umbral que obliga al equipo a responder?
- **De idea a decisión:** ¿cómo se convierte una idea votada en una propuesta formal para el
  equipo de La Nube (estado, respuesta con motivo)? Los admins deciden, no la votación.
- **Moderación:** reportes, ocultar, reglas de convivencia. Las políticas versionadas
  (milestone 19) probablemente necesitan un texto nuevo.
- **Hilos y notificaciones:** profundidad de comentarios (el milestone 7 propuso un solo nivel de
  respuestas), notificaciones por `notify()` (milestone 13).
- **Escala:** si se vuelve una red social, hay que pensar en búsqueda, ranking y abuso. Empezar
  chico.
