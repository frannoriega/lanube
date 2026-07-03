import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { EventsGrid } from "@/components/templates/landing/events/events-grid";
import { getUpcomingPublicEventsPage } from "@/lib/db/events";

export default async function EventsSection() {
  const { events, total } = await getUpcomingPublicEventsPage(1, 6);

  if (total === 0) return null;

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

          <EventsGrid initialEvents={events} initialTotal={total} />
        </Container>
      </section>
    </Breakout>
  );
}
