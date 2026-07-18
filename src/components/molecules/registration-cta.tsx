"use client";

import { LocalDate } from "@/components/molecules/local-date";
import { Button } from "@/components/ui/button";
import type { RegistrationPhase } from "@/modules/events/db/events";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import Link from "next/link";

export interface RegistrationCtaProps {
  registration: RegistrationPhase;
  formSlug: string | null;
  formOpensAt: number | null;
  formClosesAt: number | null;
}

export function RegistrationCta({ event }: { event: RegistrationCtaProps }) {
  if (event.registration === "open" && event.formSlug) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button asChild size="sm" className="w-full">
          <Link
            href={`/forms/${event.formSlug}`}
            onClick={(e) => e.stopPropagation()}
          >
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
