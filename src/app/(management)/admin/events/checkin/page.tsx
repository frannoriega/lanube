import { LocalDateTime } from "@/components/molecules/local-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listCheckInEvents } from "@/lib/db/event-checkin";
import { requirePagePermission } from "@/lib/page-auth";
import { DoorOpen } from "lucide-react";
import Link from "next/link";

/**
 * «Check-in de eventos» (milestone 30): los eventos con check-in habilitado, los que tienen
 * sesión hoy primero. Es la entrada de quien recibe a la gente en la puerta — un rol de
 * recepción con `events:checkin` no ve la gestión de eventos.
 */
export default async function CheckInEventsPage() {
  await requirePagePermission("events:checkin");
  const events = await listCheckInEvents();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <DoorOpen className="h-6 w-6 text-la-nube-primary" aria-hidden />
        <div>
          <h1 className="text-2xl font-bold">Check-in de eventos</h1>
          <p className="text-sm text-muted-foreground">
            Registrá quién llega a cada sesión. Solo aparecen los eventos con el
            check-in habilitado.
          </p>
        </div>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="text-center text-sm text-muted-foreground">
            No hay eventos con check-in en curso. Se habilita desde el
            formulario del evento, en «Inscripción».
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {events.map((e) => (
            <li key={e.id}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{e.name}</h2>
                      {e.today.length > 0 && <Badge>Hoy</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {e.spaceName}
                    </p>
                  </div>
                  <div className="space-y-0.5 text-sm">
                    {e.today.length > 0 ? (
                      e.today.map((s) => (
                        <p key={s.startMs}>
                          <span className="text-muted-foreground">Hoy: </span>
                          <LocalDateTime startMs={s.startMs} endMs={s.endMs} />
                        </p>
                      ))
                    ) : e.next ? (
                      <p>
                        <span className="text-muted-foreground">
                          Próxima sesión:{" "}
                        </span>
                        <LocalDateTime
                          startMs={e.next.startMs}
                          endMs={e.next.endMs}
                        />
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        No quedan sesiones.
                      </p>
                    )}
                    {e.today.length === 0 && e.last && (
                      <p className="text-muted-foreground">
                        Última:{" "}
                        <LocalDateTime
                          startMs={e.last.startMs}
                          endMs={e.last.endMs}
                        />
                      </p>
                    )}
                  </div>
                  <Button asChild className="mt-auto w-full sm:w-fit">
                    <Link href={`/admin/events/${e.id}/checkin`}>
                      Abrir check-in
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
