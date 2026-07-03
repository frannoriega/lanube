import { EventCardActions } from "@/components/organisms/admin/event-card-actions";
import { EventFilters } from "@/components/organisms/admin/event-filters";
import { EventCover } from "@/components/molecules/event-cover";
import { LocalDateRange } from "@/components/molecules/local-date";
import { Pagination } from "@/components/molecules/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { nowMs } from "@/lib/clock";
import {
  EVENT_STATUS_LABELS,
  EventDisplayStatus,
  eventDisplayStatus,
  eventTypeLabel,
  formatEventTimeRange,
  WEEKDAY_SHORT_LABELS,
} from "@/lib/constants/events";
import { listEvents, weekdaysFromRrule } from "@/lib/db/events";
import { CalendarDays, Clock, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

interface EventsSearchParams {
  page?: string;
  status?: string;
  resource?: string;
  from?: string;
  to?: string;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<EventsSearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { events, total, pageSize } = await listEvents({
    page,
    status: sp.status,
    resourceType: sp.resource,
    from: sp.from,
    to: sp.to,
  });
  const totalPages = Math.ceil(total / pageSize);
  const now = nowMs();
  const hasFilters = Boolean(sp.status || sp.resource || sp.from || sp.to);
  // Preserve active filters across pagination.
  const filterQuery = {
    status: sp.status,
    resource: sp.resource,
    from: sp.from,
    to: sp.to,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Eventos</h1>
        <Button asChild>
          <Link href="/admin/events/new">Nuevo evento</Link>
        </Button>
      </div>

      <Suspense>
        <EventFilters
          status={sp.status}
          resourceType={sp.resource}
          from={sp.from}
          to={sp.to}
        />
      </Suspense>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarDays className="h-6 w-6" />
          </span>
          {hasFilters ? (
            <>
              <p className="text-muted-foreground">
                Ningún evento coincide con los filtros.
              </p>
              <Button asChild variant="outline">
                <Link href="/admin/events">Limpiar filtros</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                Todavía no hay eventos. Creá el primero para empezar a recibir
                inscripciones.
              </p>
              <Button asChild>
                <Link href="/admin/events/new">Nuevo evento</Link>
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const status = eventDisplayStatus(
                event.status,
                Number(event.recurrenceEnd ?? event.endTime),
                now,
                event.deletedAt ? Number(event.deletedAt) : null,
              );
              const weekdays = weekdaysFromRrule(event.rrule);
              const cancelled = status === "CANCELLED";
              return (
                <Card
                  key={event.id}
                  className={`flex h-full flex-col overflow-hidden pb-0 transition-colors ${cancelled ? "opacity-70" : ""}`}
                >
                  <EventCover
                    imageUrl={event.imageUrl}
                    name={event.name}
                    eventType={event.eventType}
                    className="-mt-6 mb-4 aspect-video w-full border-b"
                  />
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="font-normal text-la-nube-selected dark:text-la-nube-secondary"
                      >
                        {eventTypeLabel(event.eventType)}
                      </Badge>
                      <StatusBadge status={status} />
                    </div>
                    <CardTitle>{event.name}</CardTitle>
                    <CardDescription>{event.resource.name}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                    {weekdays.length > 0 && (
                      <span className="flex flex-wrap gap-1 pt-0.5">
                        {weekdays.map((d) => (
                          <span
                            key={d}
                            className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase"
                          >
                            {WEEKDAY_SHORT_LABELS[d]}
                          </span>
                        ))}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <span>
                        <LocalDateRange
                          startMs={Number(event.startTime)}
                          endMs={
                            event.recurrenceEnd
                              ? Number(event.recurrenceEnd)
                              : null
                          }
                        />
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 shrink-0" />
                      {formatEventTimeRange(
                        Number(event.startTime),
                        Number(event.endTime),
                      )}
                    </span>
                    {event.form && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                        <Ticket className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Inscripción:{" "}
                          <LocalDateRange
                            startMs={Number(event.form.opensAt)}
                            endMs={Number(event.form.closesAt)}
                          />
                        </span>
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 shrink-0" />
                      {event._count.participants} inscripto
                      {event._count.participants === 1 ? "" : "s"}
                    </span>
                  </CardContent>
                  <EventCardActions
                    eventId={event.id}
                    formSlug={event.form?.slug ?? null}
                    formPublished={status === "PUBLISHED"}
                  />
                </Card>
              );
            })}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            basePath="/admin/events"
            query={filterQuery}
          />
        </>
      )}
    </div>
  );
}

const STATUS_BADGE_CLASS: Record<EventDisplayStatus, string> = {
  DRAFT: "",
  PUBLISHED:
    "border-transparent bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  PAUSED:
    "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
  ENDED: "",
  CANCELLED: "border-transparent bg-destructive/10 text-destructive",
};

function StatusBadge({ status }: { status: EventDisplayStatus }) {
  const tinted =
    status === "PUBLISHED" || status === "PAUSED" || status === "CANCELLED";
  return (
    <Badge
      variant={tinted ? "default" : "outline"}
      className={`font-normal ${tinted ? STATUS_BADGE_CLASS[status] : "text-muted-foreground"}`}
    >
      {EVENT_STATUS_LABELS[status]}
    </Badge>
  );
}
