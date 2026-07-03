import { EventCover } from "@/components/molecules/event-cover";
import { LocalDate, LocalDateRange } from "@/components/molecules/local-date";
import { Button } from "@/components/ui/button";
import { eventTypeLabel, WEEKDAY_SHORT_LABELS } from "@/lib/constants/events";
import type { RegistrationPhase } from "@/lib/db/events";
import { ArrowUpRight, CalendarClock, MapPin } from "lucide-react";
import Link from "next/link";

export interface UpcomingEventCardData {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  eventType: string;
  /** UNIX ms (UTC); formatted to the viewer's local date in the card. */
  startMs: number;
  recurrenceEndMs: number | null;
  resourceName: string;
  weekdays: number[];
  formSlug: string | null;
  registration: RegistrationPhase;
  formOpensAt: number | null;
  formClosesAt: number | null;
}

/**
 * Boarding-pass-style tile for an upcoming event: a cover (image or branded gradient with
 * the event type), a mono date chip, weekday badges, and a single registration CTA.
 */
export function EventCard({ event }: { event: UpcomingEventCardData }) {
  return (
    <article className="group flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 focus-within:ring-2 focus-within:ring-la-nube-primary hover:-translate-y-1 hover:border-la-nube-primary hover:shadow-md sm:w-[320px]">
      {/* Cover */}
      <div className="relative">
        <EventCover
          imageUrl={event.imageUrl}
          name={event.name}
          eventType={event.eventType}
          className="aspect-[16/10] w-full"
          sizes="320px"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-la-nube-selected shadow-sm backdrop-blur dark:bg-slate-950/80 dark:text-la-nube-secondary">
          {eventTypeLabel(event.eventType)}
        </span>
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

        {event.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {event.description}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-1">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{event.resourceName}</span>
          </span>

          <RegistrationCta event={event} />
        </div>
      </div>
    </article>
  );
}

/**
 * Registration CTA, by phase:
 *  - open: "Inscribirme" link + the closing date underneath.
 *  - upcoming: disabled, showing when registration opens.
 *  - closed / none: a quiet, non-actionable note.
 */
function RegistrationCta({ event }: { event: UpcomingEventCardData }) {
  if (event.registration === "open" && event.formSlug) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button asChild size="sm" className="w-full">
          <Link href={`/forms/${event.formSlug}`}>
            Inscribirme
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
        {event.formClosesAt !== null && (
          <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="h-3 w-3 shrink-0" />
            Cierra el <LocalDate ms={event.formClosesAt} />
          </span>
        )}
      </div>
    );
  }

  if (event.registration === "upcoming" && event.formOpensAt !== null) {
    return (
      <Button size="sm" className="w-full" disabled aria-disabled="true">
        <CalendarClock className="h-4 w-4" />
        Disponible el <LocalDate ms={event.formOpensAt} />
      </Button>
    );
  }

  return (
    <span className="rounded-md border border-dashed border-border py-1.5 text-center text-xs text-muted-foreground">
      {event.registration === "closed" ? "Inscripción cerrada" : "Próximamente"}
    </span>
  );
}
