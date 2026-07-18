import { DeleteEventButton } from "@/components/organisms/admin/delete-event-button";
import { EventForm } from "@/components/organisms/admin/event-form";
import { Button } from "@/components/ui/button";
import {
  eventToFormDefaults,
  getEvent,
  getEventSessionExceptions,
} from "@/modules/events/db/events";
import Link from "next/link";
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Editar evento</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/events/${id}/participants`}>
              Participantes ({event._count.participants})
            </Link>
          </Button>
          {!cancelled && <DeleteEventButton id={id} />}
        </div>
      </div>

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
        />
      </Suspense>
    </div>
  );
}
