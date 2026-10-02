import { EventFilters } from "@/components/organisms/admin/event-filters";
import { EventsAdminTable } from "@/components/organisms/admin/events-admin-table";
import { Pagination } from "@/components/molecules/pagination";
import { Button } from "@/components/ui/button";
import { nowMs } from "@/lib/clock";
import {
  eventDisplayStatus,
  eventTypeLabel,
  formatEventTimeRange,
} from "@/lib/constants/events";
import { listEvents, weekdaysFromRrule } from "@/lib/db/events";
import { getPublicSpaces } from "@/lib/db/spaces";
import { ArrowUpDown, CalendarDays } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

interface EventsSearchParams {
  page?: string;
  status?: string;
  spaceId?: string;
  from?: string;
  to?: string;
  /** "1": solo los destacados, en orden (y reordenables). */
  featured?: string;
  /** "1": entrar directo al modo reordenar (con `featured=1`). */
  reorder?: string;
}

/** Pestañas "Todos / Destacados", mismo estilo que las de noticias. */
function viewTabClass(active: boolean): string {
  return active
    ? "rounded-md bg-background px-3 py-1 text-sm font-medium shadow-sm"
    : "rounded-md px-3 py-1 text-sm text-muted-foreground hover:text-foreground";
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<EventsSearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const featured = sp.featured === "1";
  const [{ events, total, pageSize }, spaces] = await Promise.all([
    listEvents(
      featured
        ? { featured: true }
        : {
            page,
            status: sp.status,
            spaceId: sp.spaceId,
            from: sp.from,
            to: sp.to,
          },
    ),
    getPublicSpaces(),
  ]);
  const spaceOptions = spaces
    .filter((s) => s.isReservable)
    .map((s) => ({ id: s.id, name: s.name }));
  const totalPages = Math.ceil(total / pageSize);
  const now = nowMs();
  const hasFilters =
    !featured && Boolean(sp.status || sp.spaceId || sp.from || sp.to);
  // Preserve active filters across pagination.
  const filterQuery = {
    status: sp.status,
    spaceId: sp.spaceId,
    from: sp.from,
    to: sp.to,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Eventos</h1>
        <div className="flex flex-wrap gap-2">
          {/* Orden de los destacados del landing: lleva a la vista "Destacados" ya en modo
              reordenar, en la misma tabla (milestone 16; antes abría un modal). */}
          {!featured ? (
            <Button variant="outline" asChild>
              <Link href="/admin/events?featured=1&reorder=1">
                <ArrowUpDown className="mr-1 h-4 w-4" /> Reordenar destacados
              </Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/admin/events/new">Nuevo evento</Link>
          </Button>
        </div>
      </div>

      <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
        <Link href="/admin/events" className={viewTabClass(!featured)}>
          Todos
        </Link>
        <Link
          href="/admin/events?featured=1"
          className={viewTabClass(featured)}
        >
          Destacados
        </Link>
      </div>

      {!featured ? (
        <Suspense>
          <EventFilters
            status={sp.status}
            spaceId={sp.spaceId}
            spaceOptions={spaceOptions}
            from={sp.from}
            to={sp.to}
          />
        </Suspense>
      ) : null}

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarDays className="h-6 w-6" />
          </span>
          {featured ? (
            <p className="text-muted-foreground">
              No hay eventos destacados. Marcalos en la lista con
              &quot;Destacar&quot; para que encabecen el inicio.
            </p>
          ) : hasFilters ? (
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
          <EventsAdminTable
            featuredView={featured}
            startReordering={sp.reorder === "1"}
            rows={events.map((event) => {
              const lastMs = Number(event.recurrenceEnd ?? event.endTime);
              return {
                id: event.id,
                name: event.name,
                imageUrl: event.imageUrl,
                eventType: event.eventType,
                typeName: event.type?.name ?? eventTypeLabel(event.eventType),
                spaceName: event.space.name,
                status: eventDisplayStatus(
                  event.status,
                  lastMs,
                  now,
                  event.deletedAt ? Number(event.deletedAt) : null,
                ),
                isFeatured: event.isFeatured,
                startMs: Number(event.startTime),
                lastMs: event.recurrenceEnd
                  ? Number(event.recurrenceEnd)
                  : null,
                weekdays: weekdaysFromRrule(event.rrule),
                timeRange: formatEventTimeRange(
                  Number(event.startTime),
                  Number(event.endTime),
                ),
                form: event.form
                  ? {
                      slug: event.form.slug,
                      opensAt: Number(event.form.opensAt),
                      closesAt: Number(event.form.closesAt),
                    }
                  : null,
                participants: event._count.participants,
              };
            })}
          />

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
