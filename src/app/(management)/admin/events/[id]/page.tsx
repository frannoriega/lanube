import { EventForm } from "@/components/organisms/admin/event-form";
import { Button } from "@/components/ui/button";
import { eventToFormDefaults, getEvent } from "@/lib/db/events";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const defaults = eventToFormDefaults(event);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Editar evento</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/events/${id}/participants`}>
              Participantes ({event._count.participants})
            </Link>
          </Button>
        </div>
      </div>
      <EventForm mode="edit" eventId={id} defaults={defaults} />
    </div>
  );
}
