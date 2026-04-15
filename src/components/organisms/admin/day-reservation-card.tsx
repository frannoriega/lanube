"use client";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AdminServiceDayTimeline,
  AdminServiceTimelineLegend,
} from "@/components/organisms/admin/admin-service-day-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AdminReservationListResult } from "@/components/templates/admin/dashboard-recent-reservations";
import {
  peakOccupancyRatio,
  spacesInConflictCount,
  type ResourceCapacityMeta,
} from "@/lib/admin/admin-timeline";
import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";

function uniqueResourcesMeta(
  items: AdminReservationListResult[],
): ResourceCapacityMeta[] {
  const m = new Map<string, ResourceCapacityMeta>();
  for (const r of items) {
    if (!m.has(r.resource.id)) {
      m.set(r.resource.id, {
        id: r.resource.id,
        capacity: r.resource.capacity,
        isExclusive: r.resource.isExclusive,
      });
    }
  }
  return Array.from(m.values());
}

export function DayReservationCard({
  value,
  dateKey,
  title,
  count,
  open,
  reservationsForDay,
  pendingOnly,
  onPendingOnlyChange,
  onSelectReservation,
  disabled = false,
  className,
}: {
  value: string;
  dateKey: string;
  title: string;
  count: number;
  open: boolean;
  reservationsForDay: AdminReservationListResult[];
  pendingOnly: boolean;
  onPendingOnlyChange: (pendingOnly: boolean) => void;
  onSelectReservation: (reservation: AdminReservationListResult) => void;
  disabled?: boolean;
  className?: string;
}) {
  const resourcesMeta = uniqueResourcesMeta(reservationsForDay);
  const pending = reservationsForDay.filter((r) => r.status === "PENDING").length;
  const approved = reservationsForDay.filter((r) => r.status === "APPROVED").length;
  const conflictSpaces = spacesInConflictCount(
    reservationsForDay,
    resourcesMeta,
    dateKey,
  );
  const peak = peakOccupancyRatio(reservationsForDay, resourcesMeta, dateKey);

  return (
    <AccordionItem value={value} className="border-0">
      <Card
        className={cn(
          "glass-card dark:glass-card-dark overflow-hidden transition-all duration-150 p-0",
          open
            ? "ring-1 ring-la-nube-primary/40 shadow-lg"
            : "hover:shadow-md hover:bg-slate-300/60 dark:hover:bg-slate-600/60 hover:-translate-y-px",
          className,
        )}
      >
        <AccordionTrigger
          className="w-full px-4 py-6 text-left hover:no-underline disabled:cursor-not-allowed"
          disabled={disabled}
        >
          <div className="w-full flex flex-row justify-between items-center">
            <span className="font-medium">{title}</span>
            <span className="text-sm text-muted-foreground">
              {count} reserva{count === 1 ? "" : "s"}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="border-t border-border pt-4 pb-4 space-y-4">
          <CardContent className="p-2 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="glass-card dark:glass-card-dark">
                <CardContent>
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    Pendientes
                  </p>
                  <p className="text-[22px] font-semibold tabular-nums mt-1">{pending}</p>
                </CardContent>
              </Card>
              <Card className="glass-card dark:glass-card-dark">
                <CardContent>
                  <p className="text-xs text-muted-foreground">Aprobadas (dia)</p>
                  <p className="text-[22px] font-semibold tabular-nums mt-1">{approved}</p>
                </CardContent>
              </Card>
              <Card className="glass-card dark:glass-card-dark">
                <CardContent>
                  <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                    Espacios con conflicto
                  </p>
                  <p className="text-[22px] font-semibold tabular-nums mt-1">
                    {conflictSpaces}
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-card dark:glass-card-dark">
                <CardContent>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    Pico de ocupacion
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="size-3.5 shrink-0 cursor-help text-muted-foreground/60" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-56">
                        Maxima proporcion de capacidad utilizada en un slot de 15 min
                        del dia. Valores &gt;100% indican sobrecarga.
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p
                    className={cn(
                      "text-[22px] font-semibold tabular-nums mt-1",
                      peak > 1 && "text-red-600 dark:text-red-400",
                    )}
                  >
                    {`${Math.round(peak * 1000) / 10}%`}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <div className="flex rounded-md border border-border p-0.5 w-fit">
                <Button
                  type="button"
                  variant={pendingOnly ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-sm"
                  onClick={() => onPendingOnlyChange(true)}
                >
                  Solo pendientes
                </Button>
                <Button
                  type="button"
                  variant={!pendingOnly ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-sm"
                  onClick={() => onPendingOnlyChange(false)}
                >
                  Todas
                </Button>
              </div>
            </div>

            <AdminServiceTimelineLegend />
            <AdminServiceDayTimeline
              dateKey={dateKey}
              reservationsForCapacity={reservationsForDay}
              pendingOnly={pendingOnly}
              showResourceTypeLabels={false}
              onSelectReservation={onSelectReservation}
            />
          </CardContent>
        </AccordionContent>
      </Card>
    </AccordionItem>
  );
}
