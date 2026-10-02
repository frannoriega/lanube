import { EventForm } from "@/components/organisms/admin/event-form";
import {
  eventToFormDefaults,
  getEvent,
  getEventSessionExceptions,
} from "@/lib/db/events";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const defaults = eventToFormDefaults(event);
  const cancelled = event.deletedAt != null;
  const existingExceptions = await getEventSessionExceptions(id);

  return (
    <div className="space-y-6">
      {/* Participantes y "Cancelar evento" viven ahora en el aside del formulario
          (Publicación / Zona de peligro — milestone 14, propuesta 1). */}
      <h1 className="text-2xl font-bold">Editar evento</h1>

      {cancelled && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Este evento está cancelado. Si guardás los cambios, volverá a
          activarse con el estado que elijas.
        </p>
      )}

      <Suspense>
        <EventForm
          mode="edit"
          eventId={id}
          defaults={defaults}
          existingExceptions={existingExceptions}
          participantCount={event._count.participants}
          cancelled={cancelled}
        />
      </Suspense>
    </div>
  );
}
