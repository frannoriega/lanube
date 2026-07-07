import { LocalDate } from "@/components/molecules/local-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { eventTypeLabel } from "@/lib/constants/events";
import { getUserEvents } from "@/lib/db/participants";
import { CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function UserEventsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/auth/signin");

  const events = await getUserEvents(session.user.email);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis eventos</h1>
        <p className="text-muted-foreground">
          Los eventos a los que te inscribiste con este correo.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarDays className="h-6 w-6" />
          </span>
          <p className="text-muted-foreground">
            Todavía no te inscribiste a ningún evento.
          </p>
          <Button asChild variant="outline">
            <Link href="/">Ver próximos eventos</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="h-full">
              <CardHeader>
                <Badge
                  variant="secondary"
                  className="w-fit font-normal text-la-nube-selected dark:text-la-nube-secondary"
                >
                  {event.type?.name ?? eventTypeLabel(event.eventType)}
                </Badge>
                <CardTitle>{event.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span>
                    Desde <LocalDate ms={Number(event.startTime)} />
                    {event.recurrenceEnd && (
                      <>
                        {" al "}
                        <LocalDate ms={Number(event.recurrenceEnd)} />
                      </>
                    )}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {event.space?.name}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
