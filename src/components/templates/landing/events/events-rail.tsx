"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EventCard, type UpcomingEventCardData } from "./event-card";

/**
 * Horizontal rail of regular event cards: several visible at once, sliding as a window.
 * Dependency-free scroll-snap track paged by prev/next buttons. Cards keep the same fixed
 * width as the previous grid tiles; the arrows scroll by a viewport-width page. Falls back
 * to a plain wrapping grid when there aren't enough cards to scroll.
 */
export function EventsRail({ events }: { events: UpcomingEventCardData[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const { scrollLeft, scrollWidth, clientWidth } = track;
    setCanPrev(scrollLeft > 8);
    setCanNext(scrollLeft + clientWidth < scrollWidth - 8);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateArrows();
    track.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      track.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows]);

  const page = useCallback((dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    // Scroll by ~90% of the viewport so a couple of cards stay for continuity.
    track.scrollBy({ left: dir * track.clientWidth * 0.9, behavior: "smooth" });
  }, []);

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex snap-x gap-6 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {events.map((event) => (
          <div
            key={event.id}
            className="w-[280px] shrink-0 snap-start sm:w-[300px]"
          >
            <EventCard event={event} />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => page(-1)}
        disabled={!canPrev}
        aria-label="Ver eventos anteriores"
        className="absolute -left-3 top-1/2 z-3 -translate-y-1/2 rounded-full border bg-background/90 p-2 shadow-md backdrop-blur transition-opacity hover:bg-background disabled:pointer-events-none disabled:opacity-0"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => page(1)}
        disabled={!canNext}
        aria-label="Ver más eventos"
        className="absolute -right-3 top-1/2 z-3 -translate-y-1/2 rounded-full border bg-background/90 p-2 shadow-md backdrop-blur transition-opacity hover:bg-background disabled:pointer-events-none disabled:opacity-0"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
