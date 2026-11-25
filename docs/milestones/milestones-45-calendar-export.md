# Milestone 45 — Exportar el calendario (Google Calendar y otros)

**Estado:** promoted (2026-11-25). Versión 1.3.0.

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

## Decisiones del usuario (2026-11-25)

1. **Las reservas pendientes se incluyen.** Llevan «⏳ Pendiente ·» delante del título y
   `STATUS:TENTATIVE` (lo único que se ve en todos los clientes).
2. **Color:** se escribe el `COLOR` de RFC 7986 en cada ítem y en cada calendario (nombres de
   color CSS, que es lo que pide la RFC), con los mismos tonos de la página. Aviso dado: Google,
   Outlook y (en la práctica) Apple ignoran el color por ítem de una suscripción; el color real lo
   da **cada calendario**, que la persona elige. Por eso:
3. **Un calendario por feed, cada uno se activa o desactiva por separado:** «Mis reservas» y «Mis
   eventos» para todos; para admins, **uno por espacio** («La Nube — <espacio>»). **Sin** un
   «todo el edificio»: se obtiene activando todos los de espacio.
4. **El correo de confirmación de inscripción** lleva «Agregar a mi calendario» (suscripción a ese
   evento, que se actualiza sola si cambian sesiones) y un `.ics` adjunto de respaldo. Funciona sin
   cuenta.
5. WhatsApp (46) queda en pausa.

## Diseño

- **Tokens sin tabla nueva:** cada enlace es `…/<id>/<firma>.ics` con firma HMAC (con
  `NEXTAUTH_SECRET`). Para los feeds de una persona la firma incluye una **versión**
  (`RegisteredUser.calendarFeedVersion`): «Regenerar enlaces» la sube y los viejos dejan de andar;
  `calendarFeedEnabled` los apaga. El feed de una inscripción se firma con su id (solo muestra el
  calendario de ese evento; no permite editar nada — por eso no es el enlace de edición).
- **Rutas públicas** (las abre Google sin sesión): `GET /api/calendar/feed/<userId>/<feed>/<firma>.ics`
  (`feed` = `reservations`, `events` o `space-<spaceId>`) y
  `GET /api/calendar/registration/<participantId>/<firma>.ics`. Los permisos de admin se
  comprueban **en cada lectura** (`reservations:manage`, el mismo del calendario de actividades): si
  la persona pierde el rol, el feed queda vacío. Límite por enlace.
- **Contenido** (ventana: 30 días atrás a un año adelante): reservas propias (pendientes y
  aprobadas), sesiones de eventos donde la persona tiene una inscripción vigente (las canceladas con
  `STATUS:CANCELLED`), y por espacio todo lo de ese espacio (reservas con título y quién reservó,
  eventos, cierres). Horas en UTC (`…Z`), así no hace falta `VTIMEZONE`. UID estable por ocurrencia.
- **Configuración → «Calendario»** (`/user/settings/calendar`): activar, la lista de feeds con
  «Agregar a Google Calendar» (`calendar.google.com/calendar/r?cid=…`) y el enlace `webcal://`,
  regenerar y desactivar. Los de espacio dicen que muestran datos de otras personas.

## Registro

(Sin implementar.)
