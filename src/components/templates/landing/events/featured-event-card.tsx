import { EventCover } from "@/components/molecules/event-cover";
import { InlineRichText } from "@/components/molecules/inline-rich-text";
import { LocalDateRange } from "@/components/molecules/local-date";
import {
  RegistrationCta,
  type RegistrationCtaProps,
} from "@/components/molecules/registration-cta";
import { eventTypeLabel, WEEKDAY_SHORT_LABELS } from "@/modules/events/constants";
import { MapPin, Star } from "lucide-react";
import Link from "next/link";
import type { UpcomingEventCardData } from "./event-card";

/**
 * Full-width, high-emphasis presentation of a featured event: a large cover on one side
 * and a bold headline + blurb + registration CTA on the other. Rendered one-at-a-time by
 * {@link FeaturedCarousel}. Much louder than the compact {@link EventCard} grid tile.
 */
export function FeaturedEventCard({ event }: { event: UpcomingEventCardData }) {
  const cta: RegistrationCtaProps = {
    registration: event.registration,
    formSlug: event.formSlug,
    formOpensAt: event.formOpensAt,
    formClosesAt: event.formClosesAt,
  };

  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-3xl border-2 border-brand-primary/50 bg-card shadow-lg ring-1 ring-brand-primary/20 transition-all duration-300 focus-within:ring-2 focus-within:ring-brand-primary hover:shadow-xl md:flex-row">
      {/* Cover */}
      <div className="relative md:w-1/2 lg:w-3/5">
        <EventCover
          imageUrl={event.imageUrl}
          name={event.name}
          eventType={event.eventType}
          className="aspect-16/10 w-full md:h-full md:aspect-auto"
          sizes="(max-width: 768px) 100vw, 60vw"
          priority
        />
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm">
          <Star className="h-3.5 w-3.5 fill-current" />
          Destacado
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-6 md:justify-center md:p-8 lg:p-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-brand-selected/10 px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide text-brand-selected dark:bg-brand-secondary/10 dark:text-brand-secondary">
            {event.eventTypeName ?? eventTypeLabel(event.eventType)}
          </span>
          <LocalDateRange
            startMs={event.startMs}
            endMs={event.recurrenceEndMs}
            className="font-mono text-sm font-medium text-brand-selected before:content-['▸_'] dark:text-brand-secondary"
          />
          {event.hasExceptions && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-xs font-semibold text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              *
            </span>
          )}
        </div>

        <h3 className="text-3xl font-bold leading-tight text-foreground lg:text-4xl">
          {event.name}
        </h3>

        {event.summary && (
          <InlineRichText
            text={event.summary}
            className="line-clamp-3 max-w-prose text-base text-muted-foreground lg:text-lg"
          />
        )}

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{event.resourceName}</span>
          </span>
          {event.weekdays.length > 0 && (
            <span className="flex gap-1">
              {event.weekdays.map((d) => (
                <span
                  key={d}
                  className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase"
                >
                  {WEEKDAY_SHORT_LABELS[d]}
                </span>
              ))}
            </span>
          )}
        </div>

        {/* relative z-[2] keeps the CTA above the stretched-link overlay */}
        <div className="relative z-2 mt-2 max-w-xs">
          <RegistrationCta event={cta} />
        </div>
      </div>

      {/* Full-card link — last in DOM so it stacks above the cover */}
      <Link
        href={`/events/${event.id}`}
        className="absolute inset-0 z-1"
        aria-label={`Ver detalles: ${event.name}`}
        tabIndex={-1}
      />
    </article>
  );
}
