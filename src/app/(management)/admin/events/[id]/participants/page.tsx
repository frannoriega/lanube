import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getEvent } from "@/lib/db/events";
import { getEventFormColumns } from "@/lib/db/forms";
import { exportCell } from "@/lib/events/form-export";
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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                {columns.map((c) => (
                  <TableHead key={c.key}>{c.label}</TableHead>
                ))}
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((p) => {
                const answers = (p.answers ?? {}) as Record<string, unknown>;
                return (
                  <TableRow key={p.id}>
                    <TableCell>{p.displayEmail ?? p.email}</TableCell>
                    {columns.map((c) => (
                      <TableCell key={c.key}>
                        {exportCell(c, answers) || "—"}
                      </TableCell>
                    ))}
                    <TableCell>
                      {p.cancelled ? "Cancelado" : "Activo"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
