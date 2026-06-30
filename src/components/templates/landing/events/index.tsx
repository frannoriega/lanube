import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { EventsCarousel } from "@/components/templates/landing/events/events-carousel";
import { UpcomingEventCardData } from "@/components/templates/landing/events/event-card";
import { getUpcomingPublicEvents } from "@/lib/db/events";

export default async function EventsSection() {
  const events = await getUpcomingPublicEvents();

  // Section is hidden entirely when there's nothing upcoming.
  if (events.length === 0) return null;

  // Dates stay as UNIX ms here; the card localizes them client-side (LocalDateRange).
  const cards: UpcomingEventCardData[] = events.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    imageUrl: e.imageUrl,
    eventType: e.eventType,
    startMs: e.startTime,
    recurrenceEndMs: e.recurrenceEnd,
    resourceName: e.resourceName,
    weekdays: e.weekdays,
    formSlug: e.formSlug,
    formOpen: e.formOpen,
  }));

  return (
    <Breakout className="bg-gradient-to-b from-la-nube-accent/40 to-transparent dark:from-la-nube-selected/15">
      <section className="w-full" aria-labelledby="proximos-eventos">
        <Container className="flex flex-col gap-8 px-8 py-16">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-la-nube-selected dark:text-la-nube-secondary">
              ~/ eventos
              <span className="animate-blink">▌</span>
            </span>
            <h2 id="proximos-eventos" className="text-5xl font-bold">
              Próximos{" "}
              <span className="bg-gradient-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-transparent">
                eventos
              </span>
            </h2>
            <p className="max-w-prose text-lg text-muted-foreground">
              Talleres, charlas y encuentros abiertos en La Nube. Sumate a la
              próxima fecha.
            </p>
          </div>

          <EventsCarousel events={cards} />
        </Container>
      </section>
    </Breakout>
  );
}
