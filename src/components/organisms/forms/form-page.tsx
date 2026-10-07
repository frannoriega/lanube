import { EventMeta } from "@/components/molecules/event-meta";
import { EventHero } from "@/components/organisms/forms/event-hero";
import { cn } from "@/lib/utils";

/**
 * Esqueleto de las páginas públicas de inscripción (`/forms/*`), que desde el 2026-10-07 viven
 * dentro del encabezado y el pie del sitio público (`app/forms/layout.tsx`).
 *
 * Dos formas de página:
 * - `EventFormLayout`: la del formulario en sí (inscribirse, editar, inscripción cerrada). En
 *   escritorio el evento va a la izquierda y el formulario en una tarjeta a la derecha, así el
 *   formulario se ve apenas carga la página aunque la descripción sea larga; en teléfono y
 *   tablet, uno debajo del otro (evento primero). Antes todo iba en una sola tarjeta de 672 px
 *   centrada, que en escritorio dejaba media pantalla vacía a cada lado.
 * - `FormMessageCard`: los mensajes cortos (inscripción recibida, enlace vencido, pedir un enlace
 *   nuevo…), en una tarjeta angosta centrada — ahí el ancho completo no aporta nada.
 */
export function EventFormLayout({
  eventName,
  eventDescription,
  eventImageUrl,
  eventTypeName,
  resourceName,
  weekdays,
  children,
}: {
  eventName: string;
  eventDescription?: string | null;
  eventImageUrl?: string | null;
  /** La fila de metadatos (tipo, días, lugar) se muestra solo si vienen los tres. */
  eventTypeName?: string;
  resourceName?: string;
  weekdays?: number[];
  /** El formulario (o el aviso de inscripción cerrada), dentro de la tarjeta de la derecha. */
  children: React.ReactNode;
}) {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-12">
      <div className="flex min-w-0 flex-col gap-4">
        <EventHero
          name={eventName}
          description={eventDescription}
          imageUrl={eventImageUrl}
          afterTitle={
            eventTypeName && resourceName && weekdays ? (
              <EventMeta
                eventTypeName={eventTypeName}
                resourceName={resourceName}
                weekdays={weekdays}
              />
            ) : undefined
          }
        />
      </div>
      <section
        aria-label="Inscripción"
        className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-8"
      >
        {children}
      </section>
    </div>
  );
}

/** Tarjeta angosta y centrada para los mensajes cortos del flujo de inscripción. */
export function FormMessageCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
