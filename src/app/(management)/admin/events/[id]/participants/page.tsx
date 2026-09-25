import { ParticipantsTable } from "@/components/organisms/admin/participants-table";
import { Button } from "@/components/ui/button";
import { getEvent } from "@/lib/db/events";
import { getEventFormColumns } from "@/lib/db/forms";
import { listEventParticipants } from "@/lib/db/participants";
import { ParticipantStatus } from "@/types/prisma";
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
  // "Inscriptos" = spot-holders (pending or approved); rejected/cancelled don't count.
  const active = participants.filter(
    (p) =>
      p.status === ParticipantStatus.PENDING ||
      p.status === ParticipantStatus.APPROVED,
  );
  const pending = participants.filter(
    (p) => p.status === ParticipantStatus.PENDING,
  );
  // Cupo efectivo, con la misma resolución que usa el formulario público. Un admin puede
  // bajarlo (o mover el evento a un espacio más chico) después de que la gente se inscribió —
  // cuando lo hace confirma un aviso, y acá es donde el excedente queda visible
  // (milestone-12 D11).
  const capacity = event.capacity ?? event.space.capacity;
  const oversubscribed = capacity > 0 && active.length > capacity;

  const rows = participants.map((p) => ({
    id: p.id,
    email: p.email,
    displayEmail: p.displayEmail,
    status: p.status as ParticipantStatus,
    createdAt: Number(p.createdAt),
    answers: (p.answers ?? {}) as Record<string, unknown>,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Participantes</h1>
          <p className="text-muted-foreground">
            {event.name} ·{" "}
            {capacity > 0
              ? `${active.length} / ${capacity} inscriptos`
              : `${active.length} inscriptos`}
            {event.requiresApproval && pending.length > 0
              ? ` · ${pending.length} pendiente${pending.length === 1 ? "" : "s"}`
              : ""}
          </p>
          {oversubscribed && (
            <p className="mt-1 text-sm font-medium text-destructive">
              Hay {active.length - capacity} inscriptos por encima del cupo.
              Nadie se dio de baja automáticamente: rechazá inscripciones para
              ajustarlo.
            </p>
          )}
        </div>
        <div className="flex gap-2">
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
        <ParticipantsTable
          eventId={id}
          columns={columns}
          rows={rows}
          requiresApproval={event.requiresApproval}
        />
      )}
    </div>
  );
}
