import { WEEKDAY_SHORT_LABELS } from "@/modules/events/constants";
import { cn } from "@/lib/utils";
import { CalendarDays, MapPin } from "lucide-react";

interface EventMetaProps {
  /** Display name of the reservation type (catalog). */
  eventTypeName: string;
  /** Space / location name. */
  resourceName: string;
  /** Weekday numbers, 0=Sun..6=Sat. */
  weekdays: number[];
  className?: string;
}

/**
 * One consistent meta row for an event across the public surfaces (detail page + registration
 * form): a brand type pill, the recurring weekdays, and the location. Kept in a single component
 * so the badge language stays identical everywhere the event is shown.
 */
export function EventMeta({
  eventTypeName,
  resourceName,
  weekdays,
  className,
}: EventMetaProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 text-sm",
        className,
      )}
    >
      <span className="inline-flex items-center rounded-full border border-brand-primary/30 bg-brand-primary/5 px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide text-brand-selected dark:border-brand-secondary/30 dark:bg-brand-secondary/10 dark:text-brand-secondary">
        {eventTypeName}
      </span>
      {weekdays.length > 0 && (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span className="font-medium text-foreground/80">
            {weekdays.map((d) => WEEKDAY_SHORT_LABELS[d]).join(" · ")}
          </span>
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <MapPin className="h-4 w-4 shrink-0" />
        <span className="truncate">{resourceName}</span>
      </span>
    </div>
  );
}
