import { EventHero } from "@/components/organisms/forms/event-hero";
import { RegistrationCta } from "@/components/molecules/registration-cta";
import type { RegistrationPhase } from "@/lib/db/events";
import { getPublicEventDetailCached } from "@/lib/cache/public-reads";
import { expandAllEventOccurrences } from "@/lib/events/occurrences";
import { nowMs } from "@/lib/clock";
import { cn } from "@/lib/utils";
import { MapPin, Tag } from "lucide-react";
import { notFound } from "next/navigation";
import { Fact } from "./event-fact";
import { EventScheduleFacts, EventSessionList } from "./event-schedule";
import { ScrollToTop } from "./scroll-to-top";

/**
 * ISR (milestone 25, P2): ningún evento se genera en el build (`generateStaticParams` vacío);
 * cada uno se genera en su primera visita y queda cacheado, invalidado por tag desde el panel
 * (`src/lib/cache/public-reads.ts`). Next exige un literal en `revalidate`:
 * `public-cache.test.ts` comprueba que sea igual a PUBLIC_REVALIDATE_SECONDS.
 */
export const revalidate = 300;

export function generateStaticParams() {
  return [];
}

/**
 * Página pública de un evento (rediseño del milestone 18).
 *
 * Desde `lg` son dos columnas: a la izquierda el contenido (portada, título, descripción y
 * sesiones) y a la derecha una ficha fija con lo que el visitante viene a buscar —qué es,
 * cuándo, dónde y si se puede inscribir—. En teléfono la ficha va justo debajo del título,
 * antes de la descripción, para que la inscripción no quede al fondo de la página.
 *
 * Antes la ficha era un renglón chico (tipo · días · lugar) y la inscripción cerrada un
 * recuadro punteado que se cortaba; las sesiones, una caja por fecha a todo el ancho.
 */
export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getPublicEventDetailCached(id);
  if (!event) notFound();

  const now = nowMs();
  const occurrences = expandAllEventOccurrences(event.reservations);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 lg:px-8">
      <ScrollToTop />

      <div className="flex min-w-0 flex-col gap-10">
        <EventHero
          name={event.name}
          description={event.description}
          imageUrl={event.imageUrl}
          // En teléfono la ficha se intercala entre el título y la descripción.
          afterTitle={
            <div className="lg:hidden">
              <EventFactsCard event={event} occurrences={occurrences} />
            </div>
          }
        />

        {occurrences.length > 0 && (
          <section
            aria-labelledby="sesiones-heading"
            className="flex flex-col gap-4"
          >
            <h2
              id="sesiones-heading"
              className="text-2xl font-bold tracking-tight text-la-nube-ink dark:text-white"
            >
              Sesiones
            </h2>
            <EventSessionList occurrences={occurrences} nowMs={now} />
          </section>
        )}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-28">
          <EventFactsCard event={event} occurrences={occurrences} />
        </div>
      </aside>
    </div>
  );
}

type EventDetail = NonNullable<
  Awaited<ReturnType<typeof getPublicEventDetailCached>>
>;

/** La ficha: tipo, horario, fechas, lugar y el bloque de inscripción. */
function EventFactsCard({
  event,
  occurrences,
}: {
  event: EventDetail;
  occurrences: ReturnType<typeof expandAllEventOccurrences>;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-sm">
      <Fact icon={Tag} label="Tipo">
        <span>{event.eventTypeName}</span>
      </Fact>
      <EventScheduleFacts occurrences={occurrences} />
      <Fact icon={MapPin} label="Lugar">
        <span>{event.resourceName}</span>
      </Fact>
      <RegistrationBlock
        event={{
          registration: event.registration,
          formSlug: event.formSlug,
          formOpensAt: event.formOpensAt,
          formClosesAt: event.formClosesAt,
        }}
      />
    </div>
  );
}

/** Título y explicación de cada fase de inscripción. */
const PHASE_COPY: Record<RegistrationPhase, { title: string; body?: string }> =
  {
    open: { title: "Inscripciones abiertas" },
    upcoming: { title: "Inscripciones próximamente" },
    closed: {
      title: "Inscripción cerrada",
      body: "Las inscripciones para este evento ya cerraron o se completó el cupo.",
    },
    none: {
      title: "Sin inscripción online",
      body: "Este evento no tiene un formulario de inscripción.",
    },
  };

/**
 * Bloque de inscripción de la ficha. Abierta o próxima, muestra el botón de siempre
 * (`RegistrationCta`); cerrada o sin formulario, un texto que explica por qué en lugar del
 * recuadro punteado que usa la tarjeta chica de la landing.
 */
function RegistrationBlock({
  event,
}: {
  event: React.ComponentProps<typeof RegistrationCta>["event"];
}) {
  const copy = PHASE_COPY[event.registration];
  const actionable =
    (event.registration === "open" && event.formSlug) ||
    (event.registration === "upcoming" && event.formOpensAt !== null);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl p-4",
        event.registration === "open"
          ? "bg-la-nube-primary/10 dark:bg-la-nube-primary/15"
          : "bg-muted dark:bg-white/5",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full",
            event.registration === "open"
              ? "bg-emerald-500"
              : event.registration === "upcoming"
                ? "bg-amber-500"
                : "bg-muted-foreground/60",
          )}
        />
        <span className="text-sm font-semibold text-foreground">
          {copy.title}
        </span>
      </div>
      {copy.body && (
        <p className="text-sm text-muted-foreground">{copy.body}</p>
      )}
      {actionable && <RegistrationCta event={event} />}
    </div>
  );
}
