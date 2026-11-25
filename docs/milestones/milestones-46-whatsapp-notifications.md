# Milestone 46 — Notificaciones por WhatsApp

**Estado:** parked (2026-11-25). Lo pausó el usuario: La Nube ya tendría una cuenta de WhatsApp Business y el usuario está averiguando los detalles y si el costo por mensaje lo justifica.

## Pregunta del usuario

¿Se puede integrar WhatsApp para mandar notificaciones también?

## Respuesta corta

Sí, y la arquitectura ya lo prevé: el sistema de notificaciones (milestone 13) es de **proveedores
enchufables** (`src/lib/notifications/dispatch.ts`, `PROVIDERS`). WhatsApp es un proveedor nuevo +
su renderer; ningún lugar que dispara una notificación cambia. Lo que cuesta no es el código sino
**el lado de Meta**.

## Qué hace falta

- **WhatsApp Business Platform (Cloud API de Meta)** — la única vía oficial. Requiere una cuenta de
  Meta Business verificada, un número de teléfono dedicado (no puede ser uno que ya use la app de
  WhatsApp) y un nombre visible aprobado. Proveedores intermedios (Twilio, 360dialog, etc.) simplifican
  el alta pero cobran encima. Las librerías no oficiales que automatizan WhatsApp Web violan los
  términos y Meta bloquea el número: **descartadas**.
- **Plantillas aprobadas:** un mensaje iniciado por nosotros (no respuesta a la persona dentro de las
  24 h) tiene que usar una **plantilla** aprobada por Meta, con variables. Cada tipo de notificación
  (`reservation.approved`, `event.sessionChanged`, …) es una plantilla. Los textos de
  `render/in-app.ts` sirven de base.
- **Costo por conversación** (Meta cobra por mensaje de plantilla según categoría — «utility» para
  estos avisos — y país; Argentina tiene tarifa propia). Hay que estimarlo con el volumen real.
- **Consentimiento y teléfono verificado:** la persona tiene que dar su número y aceptar recibir
  avisos por WhatsApp (opt-in explícito, en Configuración), y lo verificamos (código por WhatsApp).
  Probablemente toca la política de privacidad → versión nueva de la política (milestone 19).
- **Preferencias por canal:** hoy cada evento va a todos los proveedores; con un canal con costo
  conviene que la persona elija qué avisos quiere por WhatsApp (tabla de preferencias).
- **Envío asincrónico:** con un canal externo lento/con costo, este es el momento de pasar el envío a
  una cola (la misma deuda `TODO(scale)` de los correos).
- Webhook de estados (entregado/leído/fallido) para no reintentar a ciegas.

## Plantillas propuestas (2026-11-25)

Categoría «Utility» (no marketing), idioma `es_AR`. Las variables (`{{n}}`) no admiten saltos de
línea, así que un lote de cambios se resume con una cantidad y un enlace.

1. `reserva_aprobada` — «Tu reserva **{{1}}** en {{2}} para el {{3}} fue **aprobada**. ¡Te
   esperamos!» Botón «Ver mis reservas» → `/user/dashboard`. Ejemplo: Reunión de equipo · Sala de
   reuniones · martes 2/12 de 10:00 a 11:00.
2. `reserva_rechazada` — «Tu reserva **{{1}}** en {{2}} para el {{3}} no pudo ser aprobada.
   Motivo: {{4}}. Podés pedir otro horario desde la web.» Botón «Reservar otro horario».
3. `evento_cambio_sesion` (un cambio) — «Hay un cambio en **{{1}}**: la sesión del {{2}} {{3}}.
   Motivo: {{4}}.» ({{3}} = «fue cancelada» / «pasa al jueves 4/12 de 10:00 a 12:00»). Botón «Ver
   mi inscripción» con el enlace como sufijo variable.
4. `evento_cambios_sesiones` (lote) — «Hubo {{1}} cambios en las sesiones de **{{2}}**
   (cancelaciones o nuevos horarios). Te mandamos el detalle por correo y lo podés ver en tu
   inscripción.» Mismo botón.
5. `inscripcion_aprobada` — «¡Listo! Tu inscripción a **{{1}}** fue aprobada. La primera sesión es
   el {{2}}.» Mismo botón.
6. `codigo_verificacion` — categoría «Authentication», con el texto fijo de Meta: «{{1}} es tu
   código de verificación. Por tu seguridad, no lo compartas.» y botón de copiar código.

Ojo: el botón «Ver mi inscripción» lleva un enlace de edición (una credencial, milestone 25 S5) a
un chat que se reenvía más que un correo. Alternativa: enlazar a la página del evento y pedir
ingreso (deja afuera a quien no tiene cuenta). Si el presupuesto aprieta, 1 y 4 cubren lo más útil.

## Preguntas abiertas

- La Nube tendría WhatsApp Business: el usuario pide los detalles (¿cuenta de la plataforma de Meta o solo la app?).
- ¿Qué avisos valen el costo? (propuesta: aprobación/rechazo de reservas y cambios de sesión de
  eventos inscriptos).
- La nota de memoria lo ubicaba después de la migración a Rust; el usuario lo confirma con ellos.
- ¿Los inscriptos sin cuenta (solo email) reciben algo? Hoy no tendrían teléfono.
- ¿El costo por mensaje lo justifica? Puede que no se haga.
