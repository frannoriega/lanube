import { EventHero } from "@/components/organisms/forms/event-hero";
import { LocalDate, LocalDateTime } from "@/components/molecules/local-date";
import { RegistrationCta } from "@/components/molecules/registration-cta";
import { WEEKDAY_SHORT_LABELS } from "@/lib/constants/events";
import { getPublicEventDetail } from "@/lib/db/events";
import { expandAllEventOccurrences } from "@/lib/events/occurrences";
import { nowMs } from "@/lib/clock";
import { MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { ScrollToTop } from "./scroll-to-top";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getPublicEventDetail(id);
  if (!event) notFound();

  const now = nowMs();
  const occurrences = expandAllEventOccurrences(event.reservations);

  // First future occurrence (not cancelled) for the "next session" highlight.
  const nextIdx = occurrences.findIndex(
    (o) => o.status !== "cancelled" && o.startMs > now,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <ScrollToTop />
      <EventHero
        name={event.name}
        description={event.description}
        imageUrl={event.imageUrl}
      />

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-border px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide text-la-nube-selected dark:text-la-nube-secondary">
          {event.eventTypeName}
        </span>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          {event.resourceName}
        </span>
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

      {/* Registration CTA */}
      <div className="max-w-xs">
        <RegistrationCta
          event={{
            registration: event.registration,
            formSlug: event.formSlug,
            formOpensAt: event.formOpensAt,
            formClosesAt: event.formClosesAt,
          }}
        />
      </div>

      {/* Agenda */}
      {occurrences.length > 0 && (
        <section aria-labelledby="sesiones-heading">
          <h2 id="sesiones-heading" className="mb-4 text-xl font-semibold">
            Sesiones
          </h2>
          <ol className="space-y-2">
            {occurrences.map((occ, idx) => {
              const isPast = occ.endMs <= now;
              const isNext = idx === nextIdx;
              const isCancelled = occ.status === "cancelled";
              const isRescheduled = occ.status === "rescheduled";

              return (
                <li
                  key={`${occ.reservationId}-${occ.occurrenceDateMs}`}
                  className={[
                    "flex flex-col gap-1 rounded-lg border px-4 py-3 text-sm",
                    isPast && !isCancelled
                      ? "border-border/50 text-muted-foreground opacity-60"
                      : "border-border",
                    isNext
                      ? "bg-la-nube-primary/5 dark:bg-la-nube-primary/10"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {isNext && (
                      <span className="rounded-full bg-la-nube-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-la-nube-primary">
                        Próxima
                      </span>
                    )}
                    {isCancelled ? (
                      <span className="line-through opacity-60">
                        <LocalDateTime
                          startMs={occ.occurrenceDateMs}
                          endMs={
                            occ.occurrenceDateMs + (occ.endMs - occ.startMs)
                          }
                        />
                      </span>
                    ) : isRescheduled ? (
                      <span className="flex flex-wrap items-center gap-2">
                        {/* Only the original date is available for rescheduled (no original end time in EventOccurrence). */}
                        <span className="line-through opacity-60">
                          <LocalDate ms={occ.occurrenceDateMs} />
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <LocalDateTime
                          startMs={occ.startMs}
                          endMs={occ.endMs}
                        />
                      </span>
                    ) : (
                      <LocalDateTime startMs={occ.startMs} endMs={occ.endMs} />
                    )}

                    {isCancelled && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        Cancelada
                      </span>
                    )}
                    {isRescheduled && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        Reprogramada
                      </span>
                    )}
                  </div>

                  {occ.reason && (
                    <p className="text-xs text-muted-foreground">
                      {occ.reason}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
