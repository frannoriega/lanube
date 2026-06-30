"use client";

import {
  EventCard,
  UpcomingEventCardData,
} from "@/components/templates/landing/events/event-card";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Horizontal, scroll-snap carousel of event tiles. Dependency-free: native overflow
 * scrolling (with snap) carries touch/trackpad, and the arrow buttons nudge by ~one card.
 * Arrows hide when everything fits and disable at each end. Respects reduced motion.
 */
export function EventsCarousel({
  events,
}: {
  events: UpcomingEventCardData[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  const updateEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setOverflowing(max > 4);
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft >= max - 4);
  }, []);

  useEffect(() => {
    updateEdges();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, [updateEdges]);

  const scrollByCards = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    // ~one card + gap; first child width is the source of truth.
    const card = el.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + 24 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="region"
        aria-label="Próximos eventos"
        tabIndex={0}
      >
        {events.map((event) => (
          <div key={event.id} className="snap-start py-2">
            <EventCard event={event} />
          </div>
        ))}
      </div>

      {overflowing && (
        <>
          <CarouselButton
            side="left"
            disabled={atStart}
            onClick={() => scrollByCards(-1)}
          />
          <CarouselButton
            side="right"
            disabled={atEnd}
            onClick={() => scrollByCards(1)}
          />
        </>
      )}
    </div>
  );
}

function CarouselButton({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Ver anteriores" : "Ver siguientes"}
      className={cn(
        "absolute top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-slate-300/70 p-3 text-foreground shadow-md backdrop-blur transition hover:bg-slate-300 disabled:pointer-events-none disabled:opacity-0 dark:bg-slate-950/70 dark:hover:bg-slate-950 md:block",
        side === "left" ? "-left-4" : "-right-4",
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
