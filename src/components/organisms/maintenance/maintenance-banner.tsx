"use client";

import { Markdown } from "@/components/molecules/markdown";
import { useMaintenanceWindows } from "@/components/providers/maintenance";
import { cn } from "@/lib/utils";
import { MAINTENANCE_MODE_LABELS } from "@/lib/maintenance/areas";
import type { StatefulWindow } from "@/lib/maintenance/evaluate";
import { CalendarClock, Construction, Info } from "lucide-react";

/** Fecha y hora en español, 24 h, en la zona de quien mira (nunca la del idioma del navegador). */
function formatWhen(ms: number): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));
}

/** Por encima de esto el motivo arranca plegado: el aviso no tiene que comerse la pantalla. */
const LONG_REASON = 300;

const TONE = {
  blocking:
    "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
  notice:
    "border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100",
  scheduled: "border-border bg-muted text-foreground",
} as const;

function windowTone(w: StatefulWindow): keyof typeof TONE {
  if (w.state === "scheduled") return "scheduled";
  return w.mode === "NOTICE" ? "notice" : "blocking";
}

function windowSubtitle(w: StatefulWindow): string | null {
  if (w.state === "scheduled" && w.startsAt != null) {
    return `Programado desde el ${formatWhen(w.startsAt)}${
      w.endsAt != null ? ` hasta el ${formatWhen(w.endsAt)}` : ""
    }`;
  }
  if (w.endsAt != null) return `Hasta el ${formatWhen(w.endsAt)}`;
  return null;
}

/**
 * Un aviso de mantenimiento: título, qué implica (solo aviso / solo lectura / no disponible),
 * la ventana horaria si la hay y el motivo en markdown. Lo comparten el aviso del sitio y el
 * que se muestra dentro de un formulario deshabilitado.
 */
export function MaintenanceMessage({
  window: w,
  className,
}: {
  window: StatefulWindow;
  className?: string;
}) {
  const tone = windowTone(w);
  const Icon =
    tone === "scheduled"
      ? CalendarClock
      : tone === "notice"
        ? Info
        : Construction;
  const subtitle = windowSubtitle(w);
  const long = w.reasonMd.length > LONG_REASON;

  return (
    <section
      role="status"
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        TONE[tone],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold">
            {w.state === "scheduled" ? "Mantenimiento programado: " : ""}
            {w.title}
            {w.state === "active" && w.mode !== "NOTICE" ? (
              <span className="ml-2 inline-block whitespace-nowrap rounded-full border border-current px-2 py-0.5 align-middle text-xs font-medium">
                {MAINTENANCE_MODE_LABELS[w.mode]}
              </span>
            ) : null}
          </p>
          {subtitle ? <p className="text-xs opacity-80">{subtitle}</p> : null}
          {long ? (
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium underline-offset-2 hover:underline">
                Ver detalle
              </summary>
              <Markdown breaks className="mt-2">
                {w.reasonMd}
              </Markdown>
            </details>
          ) : (
            <Markdown breaks>{w.reasonMd}</Markdown>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * El aviso del sitio (milestone 22): todas las ventanas vigentes y las próximas, apiladas.
 * No renderiza nada si no hay ninguna, así que dejarlo montado en los layouts no cuesta
 * nada. Se muestra en el sitio público, en el panel y en las páginas de inscripción.
 */
export function MaintenanceBanner({ className }: { className?: string }) {
  const windows = useMaintenanceWindows();
  if (windows.length === 0) return null;
  return (
    <div className={cn("space-y-2", className)}>
      {windows.map((w) => (
        <MaintenanceMessage key={w.id} window={w} />
      ))}
    </div>
  );
}
