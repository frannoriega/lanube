"use client";

import {
  EventCard,
  type UpcomingEventCardData,
} from "@/components/templates/landing/events/event-card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

function getColumnCount(): number {
  if (typeof window === "undefined") return 3;
  const w = window.innerWidth;
  if (w >= 1280) return 4;
  if (w >= 1024) return 3;
  if (w >= 640) return 2;
  return 1;
}

export function EventsGrid({
  initialEvents,
  initialTotal,
}: {
  initialEvents: UpcomingEventCardData[];
  initialTotal: number;
}) {
  const [events, setEvents] = useState<UpcomingEventCardData[]>(initialEvents);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6); // matches SSR default
  const [loading, setLoading] = useState(false);

  const fetchPage = useCallback(async (p: number, ps: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events?page=${p}&pageSize=${ps}`);
      if (!res.ok) return;
      const data = await res.json();
      setEvents(data.events);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: detect actual column count and refetch if it differs from SSR default.
  useEffect(() => {
    const cols = getColumnCount();
    const size = cols * 2;
    if (size !== 6) {
      setPageSize(size);
      setPage(1);
      fetchPage(1, size);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback(
    (p: number) => {
      setPage(p);
      fetchPage(p, pageSize);
    },
    [pageSize, fetchPage],
  );

  const totalPages = Math.ceil(total / pageSize);
  const hasAsterisk = events.some((e) => e.hasExceptions);

  return (
    <div className={loading ? "opacity-60 transition-opacity" : ""}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {hasAsterisk && (
        <p className="mt-4 text-xs text-muted-foreground">
          * Este evento tiene sesiones reprogramadas o canceladas.
        </p>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          {page > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => goTo(page - 1)}
              disabled={loading}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => goTo(page + 1)}
              disabled={loading}
              aria-label="Página siguiente"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
