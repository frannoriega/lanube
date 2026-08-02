import { EventCover } from "@/components/molecules/event-cover";
import { LocalDateRange } from "@/components/molecules/local-date";
import {
  RegistrationCta,
  type RegistrationCtaProps,
} from "@/components/molecules/registration-cta";
import { eventTypeLabel, WEEKDAY_SHORT_LABELS } from "@/lib/constants/events";
import type { RegistrationPhase } from "@/lib/db/events";
import { MapPin, Star } from "lucide-react";
import Link from "next/link";
import { LandingCard } from "../shared/landing-card";

export interface UpcomingEventCardData {
  id: string;
  name: string;
  description: string | null;
  /** Short plain-text blurb shown on the card (never raw markdown). */
  summary: string | null;
  isFeatured: boolean;
  imageUrl: string | null;
  eventType: string;
  /** Display name of the reservation type (from the catalog table). */
  eventTypeName?: string;
  /** UNIX ms (UTC); formatted to the viewer's local date in the card. */
  startMs: number;
  recurrenceEndMs: number | null;
  resourceName: string;
  weekdays: number[];
  formSlug: string | null;
  registration: RegistrationPhase;
  formOpensAt: number | null;
  formClosesAt: number | null;
  hasExceptions: boolean;
}

/**
 * Boarding-pass-style tile for an upcoming event: a cover (image or branded gradient with
 * the event type), a mono date chip, weekday badges, and a single registration CTA.
 */
export function EventCard({
  event,
  featured = false,
}: {
  event: UpcomingEventCardData;
  /** Renders the card with featured emphasis (badge + ring). Defaults to the event's own flag. */
  featured?: boolean;
}) {
  const isFeatured = featured || event.isFeatured;
  const cta: RegistrationCtaProps = {
    registration: event.registration,
    formSlug: event.formSlug,
    formOpensAt: event.formOpensAt,
    formClosesAt: event.formClosesAt,
  };

  return (
    <LandingCard
      data={{
        href: `/events/${event.id}`,
        label: `Ver detalles: ${event.name}`,
      }}
      className={
        isFeatured
          ? "border-la-nube-primary/40 ring-2 ring-la-nube-primary/40 shadow-md"
          : undefined
      }
    >
      {/* Cover */}
      <div className="relative">
        <EventCover
          imageUrl={event.imageUrl}
          name={event.name}
          eventType={event.eventType}
          className="aspect-16/10 w-full"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-la-nube-selected shadow-sm backdrop-blur dark:bg-slate-950/80 dark:text-la-nube-secondary">
          {event.eventTypeName ?? eventTypeLabel(event.eventType)}
        </span>
        {isFeatured && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-la-nube-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
            <Star className="h-3 w-3 fill-current" />
            Destacado
          </span>
        )}
        {event.hasExceptions && (
          <span className="absolute right-3 top-3 rounded-full bg-amber-100/90 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-700 shadow-sm backdrop-blur dark:bg-amber-900/80 dark:text-amber-300">
            *
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <LocalDateRange
            startMs={event.startMs}
            endMs={event.recurrenceEndMs}
            className="font-mono text-sm font-medium text-la-nube-selected before:content-['▸_'] dark:text-la-nube-secondary"
          />
          {event.weekdays.length > 0 && (
            <span className="flex gap-1">
              {event.weekdays.map((d) => (
                <span
                  key={d}
                  className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground"
                >
                  {WEEKDAY_SHORT_LABELS[d]}
                </span>
              ))}
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 text-lg font-bold leading-tight text-foreground">
          {event.name}
        </h3>

        {event.summary && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {event.summary}
          </p>
        )}

        {/* relative z-[2] keeps this above the stretched-link overlay (z-[1]) */}
        <div className="relative z-2 mt-auto flex flex-col gap-3 pt-1">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{event.resourceName}</span>
          </span>
          <RegistrationCta event={cta} />
        </div>
      </div>

      {/* Full-card link — last in DOM so it stacks above the cover, captured by z-[2] CTA above */}
      <Link
        href={`/events/${event.id}`}
        className="absolute inset-0 z-1"
        aria-label={`Ver detalles: ${event.name}`}
        tabIndex={-1}
      />
    </LandingCard>
  );
}
