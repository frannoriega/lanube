import { ParticipantsTable } from "@/components/organisms/admin/participants-table";
import { Button } from "@/components/ui/button";
import { getEvent } from "@/lib/db/events";
import { getEventFormColumns } from "@/lib/db/forms";
import { listEventParticipants } from "@/lib/db/participants";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const [participants, columns] = await Promise.all([
    listEventParticipants(id),
    getEventFormColumns(id),
  ]);
  const active = participants.filter((p) => !p.cancelled);

  const rows = participants.map((p) => ({
    id: p.id,
    email: p.email,
    displayEmail: p.displayEmail,
    cancelled: p.cancelled,
    createdAt: Number(p.createdAt),
    answers: (p.answers ?? {}) as Record<string, unknown>,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Participantes</h1>
          <p className="text-muted-foreground">
            {event.name} · {active.length} inscriptos
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/events/${id}`}>Volver</Link>
          </Button>
          <Button asChild>
            <a href={`/api/admin/events/${id}/participants?format=csv`}>
              Descargar CSV
            </a>
          </Button>
        </div>
      </div>

      {participants.length === 0 ? (
        <p className="text-muted-foreground">Todavía no hay inscriptos.</p>
      ) : (
        <ParticipantsTable eventId={id} columns={columns} rows={rows} />
      )}
    </div>
  );
}
