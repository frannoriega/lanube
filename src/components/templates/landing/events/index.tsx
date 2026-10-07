import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { EventsRail } from "@/components/templates/landing/events/events-rail";
import { FeaturedCarousel } from "@/components/templates/landing/events/featured-carousel";
import { FeaturedEventCard } from "@/components/templates/landing/events/featured-event-card";
import { LANDING_SECTION_BG } from "@/components/templates/landing/shared/section-bg";
import { SectionHeading } from "@/components/templates/landing/shared/section-heading";
import { getPublicUpcomingEventsPage } from "@/lib/cache/public-reads";

export default async function EventsSection() {
  const { events, total } = await getPublicUpcomingEventsPage(1, 8);

  if (total === 0) return null;

  const hasAsterisk = events.some((e) => e.hasExceptions);
  const featured = events.filter((e) => e.isFeatured);
  const others = events.filter((e) => !e.isFeatured);
  // Sin destacados, el próximo evento toma el lugar grande (sin la etiqueta "Destacado") y el
  // resto va al carril de tarjetas chicas. Ver `FeaturedEventCard` (`badge`).
  const lead = featured.length === 0 ? others[0] : undefined;
  const rest = lead ? others.slice(1) : others;

  return (
    <Breakout className={LANDING_SECTION_BG}>
      <section className="w-full" aria-labelledby="proximos-eventos">
        <Container className="flex flex-col gap-8 px-8 py-16">
          <SectionHeading
            eyebrow="eventos"
            title="Próximos"
            accent="eventos"
            lead="Talleres, charlas y encuentros abiertos en La Nube. Sumate a la próxima fecha."
            id="proximos-eventos"
          />

          {featured.length > 0 && <FeaturedCarousel events={featured} />}

          {lead && <FeaturedEventCard event={lead} badge={false} />}

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
