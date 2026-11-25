# Milestone 45 — Exportar el calendario (Google Calendar y otros)

**Estado:** seed (2026-11-25). Idea futura del usuario; **no** entra en la 1.2.0.

## Pregunta del usuario

¿Se puede exportar el calendario a Google Calendar para los usuarios, idealmente de forma
automática si lo configuran?

## Respuesta corta

Sí, y la forma automática es la más simple: una **suscripción iCalendar (ICS)**. No hace falta
integrarse con la API de Google ni pedir permisos de OAuth sobre la cuenta de Google de nadie.

## Propuesta

- **Feed personal** `GET /api/calendar/<token>.ics` (texto `text/calendar`, RFC 5545) con las
  reservas propias (aprobadas y, opcionalmente, pendientes marcadas «(pendiente)») y los eventos en
  los que la persona está inscripta. Cada ocurrencia con `UID` estable (id de reserva/evento +
  inicio nominal) para que los cambios se actualicen en lugar de duplicarse; las sesiones canceladas
  salen con `STATUS:CANCELLED`. Se generan desde `reservation_occurrences()` / las ocurrencias de
  eventos, en una ventana (p. ej. −30 días a +1 año).
- **El token es una credencial** (como los enlaces de edición del milestone 25): aleatorio, guardado
  como SHA-256, se puede **regenerar** (invalida el anterior) y **desactivar** desde Configuración →
  «Calendario». El feed no muestra nada de otras personas (regla del calendario de usuario, §22).
- **Cómo lo usa la persona:** botón «Agregar a Google Calendar» (abre
  `https://calendar.google.com/calendar/r?cid=webcal://…`), y el enlace `webcal://` para Apple /
  Outlook. Google refresca las suscripciones cada varias horas (no es inmediato; se dice en la UI).
- **Además, sin configuración:** botón «Agregar al calendario» en una reserva o un evento que baja un
  `.ics` de esa sola cosa (útil también en el correo de confirmación de inscripción).
- Mantenimiento/rate limit: la ruta es pública (la abre Google), con límite por token.

## Alternativa descartada por ahora

Sincronizar con la **API de Google Calendar** (OAuth, escribir en el calendario de la persona):
actualización inmediata, pero suma OAuth contra Google, refresh tokens a guardar, verificación de la
app por Google y mantenimiento por proveedor (Outlook aparte). El ICS cubre el caso con mucho menos.

## Preguntas abiertas

- ¿Incluir las reservas pendientes?
- ¿Un feed para admins con todo el edificio (calendario de actividades)?
