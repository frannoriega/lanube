"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FeaturedEventCard } from "./featured-event-card";
import type { UpcomingEventCardData } from "./event-card";

/**
 * Full-width, one-at-a-time carousel for featured events. Dependency-free: a horizontal
 * scroll-snap track (each slide is 100% wide) driven by prev/next buttons and dot indicators.
 * The active index is derived from scroll position so native swipe/drag stays in sync.
 */
export function FeaturedCarousel({
  events,
}: {
  events: UpcomingEventCardData[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const scrollTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: track.clientWidth * index, behavior: "smooth" });
  }, []);

  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActive(index);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const single = events.length <= 1;

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {events.map((event) => (
          <div key={event.id} className="w-full shrink-0 snap-center">
            <FeaturedEventCard event={event} />
          </div>
        ))}
      </div>

      {!single && (
        <>
          {/* Prev / next arrows */}
          <button
            type="button"
            onClick={() => scrollTo(Math.max(0, active - 1))}
            disabled={active === 0}
            aria-label="Evento destacado anterior"
            className="absolute left-3 top-1/2 z-3 -translate-y-1/2 rounded-full border bg-background/90 p-2 shadow-md backdrop-blur transition-opacity hover:bg-background disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollTo(Math.min(events.length - 1, active + 1))}
            disabled={active === events.length - 1}
            aria-label="Evento destacado siguiente"
            className="absolute right-3 top-1/2 z-3 -translate-y-1/2 rounded-full border bg-background/90 p-2 shadow-md backdrop-blur transition-opacity hover:bg-background disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dots */}
          <div className="mt-4 flex justify-center gap-2">
            {events.map((event, i) => (
              <button
                key={event.id}
                type="button"
                onClick={() => scrollTo(i)}
                aria-label={`Ir al evento destacado ${i + 1}`}
                aria-current={i === active}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === active
                    ? "w-6 bg-la-nube-primary"
                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
