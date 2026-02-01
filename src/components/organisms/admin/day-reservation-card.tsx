"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { ReservationTimeline } from "./reservation-timeline";
import { AdminReservationListResult } from "@/lib/db/adminReservations";
import { formatDate, parseDateStringLocal } from "@/lib/utils/date";

export interface DayWithReservations {
  date: string;
  count: number;
}

export function DayReservationCard({
  day,
  reservations,
  totalReservations,
  onAction,
  processing,
  onFetchReservations,
  onLoadMore,
  isLoading,
  isLoadingMore,
}: {
  day: DayWithReservations;
  reservations: AdminReservationListResult[];
  totalReservations?: number;
  onAction?: (id: string, action: "APPROVED" | "REJECTED", reason?: string) => void;
  processing?: string | null;
  onFetchReservations?: (date: string) => void;
  onLoadMore?: (date: string) => void;
  isLoading?: boolean;
  isLoadingMore?: boolean;
}) {
  const dateLabel = formatDate(parseDateStringLocal(day.date));

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value={day.date} className="border-0">
        <Card className="glass-card dark:glass-card-dark overflow-hidden">
          <AccordionTrigger
            className="px-4 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180"
            onClick={() => onFetchReservations?.(day.date)}
          >
            <div className="flex items-center justify-between w-full pr-2">
              <span className="font-medium text-left">{dateLabel}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {day.count} reserva{day.count !== 1 ? "s" : ""}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <CardContent className="pt-0 pb-4 px-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-la-nube-primary" />
                </div>
              ) : (
                <>
                  <ReservationTimeline
                    reservations={reservations}
                    onAction={onAction}
                    processing={processing}
                    showActions={!!onAction}
                  />
                  {onLoadMore &&
                    totalReservations != null &&
                    totalReservations > reservations.length && (
                      <div className="mt-3 flex justify-center">
                        <button
                          type="button"
                          className="text-sm text-la-nube-primary hover:underline disabled:opacity-50"
                          onClick={() => onLoadMore(day.date)}
                          disabled={isLoadingMore}
                        >
                          {isLoadingMore
                            ? "Cargando…"
                            : `Cargar más (${reservations.length} de ${totalReservations})`}
                        </button>
                      </div>
                    )}
                </>
              )}
            </CardContent>
          </AccordionContent>
        </Card>
      </AccordionItem>
    </Accordion>
  );
}
