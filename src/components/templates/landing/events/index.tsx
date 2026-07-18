import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { EventsRail } from "@/components/templates/landing/events/events-rail";
import { FeaturedCarousel } from "@/components/templates/landing/events/featured-carousel";
import { LANDING_SECTION_BG } from "@/components/templates/landing/shared/section-bg";
import { getBrand } from "@/config";
import { modules } from "@/modules";

export default async function EventsSection() {
  // Standardized module retrieval: no direct db import. If the events module is
  // disabled (or opted out of the landing), the whole section renders nothing.
  const events = modules.events;
  if (!events || !events.config.showOnLanding) return null;

  const { events: items, total } = await events.getUpcoming(
    1,
    events.config.landingLimit,
  );

  if (total === 0) return null;

  const brand = getBrand();

  const hasAsterisk = items.some((e) => e.hasExceptions);
  const featured = items.filter((e) => e.isFeatured);
  const rest = items.filter((e) => !e.isFeatured);

  return (
    <Breakout className={LANDING_SECTION_BG}>
      <section className="w-full" aria-labelledby="proximos-eventos">
        <Container className="flex flex-col gap-8 px-8 py-16">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-brand-selected dark:text-brand-secondary">
              ~/ eventos
              <span className="animate-blink">▌</span>
            </span>
            <h2 id="proximos-eventos" className="text-5xl font-bold">
              Próximos{" "}
              <span className="bg-linear-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent">
                eventos
              </span>
            </h2>
            <p className="max-w-prose text-lg text-muted-foreground">
              Talleres, charlas y encuentros abiertos en {brand.name}. Sumate a
              la próxima fecha.
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
