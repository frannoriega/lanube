import Container from "@/components/atoms/container";
import { Pagination } from "@/components/molecules/pagination";
import { EventCard } from "@/components/templates/landing/events/event-card";
import { getUpcomingPublicEventsPage } from "@/lib/db/events";
import { CalendarX2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eventos",
  description:
    "Talleres, charlas y capacitaciones abiertas en La Nube, el Polo Tecnológico de Concepción del Uruguay. Conocé los próximos eventos e inscribite.",
  alternates: { canonical: "/events" },
};

const PAGE_SIZE = 12;

export default async function EventsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { events, total } = await getUpcomingPublicEventsPage(page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasAsterisk = events.some((e) => e.hasExceptions);

  return (
    <Container className="flex flex-col gap-8 px-8 py-16">
      <div className="flex flex-col gap-3">
        <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-la-nube-selected dark:text-la-nube-secondary">
          ~/ eventos
          <span className="animate-blink">▌</span>
        </span>
        <h1 className="text-5xl font-bold">
          Próximos{" "}
          <span className="bg-linear-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-transparent">
            eventos
          </span>
        </h1>
        <p className="max-w-prose text-lg text-muted-foreground">
          Talleres, charlas y encuentros abiertos en La Nube. Sumate a la
          próxima fecha.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-8 py-16 text-center">
          <CalendarX2 className="h-8 w-8 text-muted-foreground" />
          <p className="text-lg font-medium">
            No hay eventos programados por ahora
          </p>
          <p className="max-w-prose text-sm text-muted-foreground">
            Seguinos en nuestras redes o volvé a visitar esta página para
            enterarte de los próximos talleres y charlas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {hasAsterisk && (
        <p className="text-xs text-muted-foreground">
          * Este evento tiene sesiones reprogramadas o canceladas.
        </p>
      )}

      <Pagination page={page} totalPages={totalPages} basePath="/events" />
    </Container>
  );
}
