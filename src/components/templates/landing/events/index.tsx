import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { EventsRail } from "@/components/templates/landing/events/events-rail";
import { FeaturedCarousel } from "@/components/templates/landing/events/featured-carousel";
import { LANDING_SECTION_BG } from "@/components/templates/landing/shared/section-bg";
import { getUpcomingPublicEventsPage } from "@/lib/db/events";

export default async function EventsSection() {
  const { events, total } = await getUpcomingPublicEventsPage(1, 8);

  if (total === 0) return null;

  const hasAsterisk = events.some((e) => e.hasExceptions);
  const featured = events.filter((e) => e.isFeatured);
  const rest = events.filter((e) => !e.isFeatured);

  return (
    <Breakout className={LANDING_SECTION_BG}>
      <section className="w-full" aria-labelledby="proximos-eventos">
        <Container className="flex flex-col gap-8 px-8 py-16">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-la-nube-selected dark:text-la-nube-secondary">
              ~/ eventos
              <span className="animate-blink">▌</span>
            </span>
            <h2 id="proximos-eventos" className="text-5xl font-bold">
              Próximos{" "}
              <span className="bg-linear-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-transparent">
                eventos
              </span>
            </h2>
            <p className="max-w-prose text-lg text-muted-foreground">
              Talleres, charlas y encuentros abiertos en La Nube. Sumate a la
              próxima fecha.
            </p>
          </div>

          {featured.length > 0 && <FeaturedCarousel events={featured} />}

          {rest.length > 0 && <EventsRail events={rest} />}

          {hasAsterisk && (
            <p className="text-xs text-muted-foreground">
              * Este evento tiene sesiones reprogramadas o canceladas.
            </p>
          )}
        </Container>
      </section>
    </Breakout>
  );
}
