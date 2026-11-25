# Milestone 46 — Notificaciones por WhatsApp

**Estado:** seed (2026-11-25). Idea futura del usuario; **no** entra en la 1.2.0.

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

## Preguntas abiertas

- ¿Quién es dueño de la cuenta de Meta Business (La Nube / la municipalidad)?
- ¿Qué avisos valen el costo? (propuesta: aprobación/rechazo de reservas y cambios de sesión de
  eventos inscriptos).
- La nota de memoria lo ubicaba después de la migración a Rust; confirmar si sigue siendo así.
