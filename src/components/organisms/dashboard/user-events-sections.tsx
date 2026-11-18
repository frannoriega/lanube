"use client";

import {
  ParticipantStatusBadge,
  ToneBadge,
} from "@/components/atoms/status-badge";
import {
  ExpandableList,
  ExpandableRow,
} from "@/components/molecules/expandable-list";
import { LoadError } from "@/components/molecules/load-error";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage } from "@/lib/api/client";
import type {
  AvailableEvent,
  PastUserEventsPage,
  UserEventSession,
} from "@/lib/db/userActivity";
import Link from "next/link";
import { useState } from "react";
import {
  Empty,
  formatWhen,
  ListSkeleton,
  Pager,
  SectionHeading,
} from "./user-activity-sections";

/**
 * Las tres secciones de «Mis eventos» (milestone 35): **Mis eventos** (donde tengo un lugar, con
 * su próxima sesión), **Eventos disponibles** (a los que me puedo inscribir o ir sin
 * inscripción) y **Eventos pasados** (historial paginado). Cada evento es una sola fila, aunque
 * tenga muchas sesiones.
 */

const day = (ms: number) =>
  new Date(ms).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/** "20/11 09:00": cuándo abre una inscripción, en español y 24 h. */
const opensLabel = (ms: number) =>
  `${new Date(ms).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} ${new Date(
    ms,
  ).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })}`;

export function MyEventsSection() {
  const { data, error, firstTime, refetch, loading } = useApi<
    UserEventSession[]
  >("/api/user/upcoming-events");
  return (
    <section aria-labelledby="ev-mine">
      <SectionHeading id="ev-mine">Mis eventos</SectionHeading>
      {error && !data ? (
        <LoadError
          message={apiErrorMessage(error, "No se pudieron cargar tus eventos.")}
          onRetry={() => void refetch()}
          busy={loading}
        />
      ) : firstTime ? (
        <ListSkeleton />
      ) : !data || data.length === 0 ? (
        <Empty>No estás inscripto en ningún evento próximo.</Empty>
      ) : (
        <ExpandableList ariaLabel="Mis eventos">
          {data.map((s) => (
            <ExpandableRow
              key={s.id}
              value={s.id}
              title={s.name}
              subtitle={`Próxima sesión · ${s.spaceName ?? "Espacio"} · ${formatWhen(s.startTime, s.endTime)}`}
              trailing={
                s.participantStatus === "PENDING" ? (
                  <ParticipantStatusBadge status="PENDING" />
                ) : null
              }
            >
              <p className="text-sm text-muted-foreground">
                {s.participantStatus === "PENDING"
                  ? "Tu inscripción espera la aprobación del equipo."
                  : "Estás inscripto en este evento."}
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href={`/events/${s.eventId}`}>Ver evento</Link>
              </Button>
            </ExpandableRow>
          ))}
        </ExpandableList>
      )}
    </section>
  );
}

export function AvailableEventsSection() {
  const { data, error, firstTime, refetch, loading } = useApi<AvailableEvent[]>(
    "/api/user/events/available",
  );
  return (
    <section aria-labelledby="ev-available">
      <SectionHeading id="ev-available">Eventos disponibles</SectionHeading>
      {error && !data ? (
        <LoadError
          message={apiErrorMessage(error, "No se pudieron cargar los eventos.")}
          onRetry={() => void refetch()}
          busy={loading}
        />
      ) : firstTime ? (
        <ListSkeleton />
      ) : !data || data.length === 0 ? (
        <Empty>Por ahora no hay otros eventos a los que sumarte.</Empty>
      ) : (
        <ExpandableList ariaLabel="Eventos disponibles">
          {data.map((e) => (
            <ExpandableRow
              key={e.id}
              value={e.id}
              title={e.name}
              subtitle={`Próxima sesión · ${e.spaceName} · ${formatWhen(e.startTime, e.endTime)}`}
              trailing={
                <ToneBadge
                  tone={
                    e.registration === "open"
                      ? "success"
                      : e.registration === "upcoming"
                        ? "warning"
                        : "info"
                  }
                >
                  {e.registration === "open"
                    ? "Inscripción abierta"
                    : e.registration === "upcoming" && e.opensAt
                      ? `Abre el ${opensLabel(e.opensAt)}`
                      : "Sin inscripción"}
                </ToneBadge>
              }
            >
              {e.summary ? (
                <p className="text-sm break-words">{e.summary}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {e.formSlug ? (
                  <Button asChild size="sm" variant="brand">
                    <Link href={`/forms/${e.formSlug}`}>Inscribirme</Link>
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link href={`/events/${e.id}`}>Ver evento</Link>
                </Button>
              </div>
            </ExpandableRow>
          ))}
        </ExpandableList>
      )}
    </section>
  );
}

export function PastEventsSection() {
  const [page, setPage] = useState(1);
  const { data, error, firstTime, refetch, loading } =
    useApi<PastUserEventsPage>(`/api/user/events/past?page=${page}`);
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;
  return (
    <section aria-labelledby="ev-past">
      <SectionHeading id="ev-past">Eventos pasados</SectionHeading>
      {error && !data ? (
        <LoadError
          message={apiErrorMessage(error, "No se pudo cargar tu historial.")}
          onRetry={() => void refetch()}
          busy={loading}
        />
      ) : firstTime ? (
        <ListSkeleton />
      ) : !data || data.total === 0 ? (
        <Empty>Todavía no tenés eventos pasados.</Empty>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : undefined}>
          <ExpandableList ariaLabel="Eventos pasados">
            {data.items.map((e) => (
              <ExpandableRow
                key={e.id}
                value={e.id}
                title={e.name}
                subtitle={`${e.spaceName ?? "Espacio"} · ${
                  day(e.startTime) === day(e.endedAt)
                    ? day(e.startTime)
                    : `${day(e.startTime)} al ${day(e.endedAt)}`
                }`}
                trailing={
                  <ParticipantStatusBadge status={e.participantStatus} />
                }
              >
                <Button asChild size="sm" variant="outline">
                  <Link href={`/events/${e.id}`}>Ver evento</Link>
                </Button>
              </ExpandableRow>
            ))}
          </ExpandableList>
          <Pager
            page={page}
            totalPages={totalPages}
            total={data.total}
            loading={loading}
            onPage={setPage}
            noun="eventos"
            label="Paginación de eventos pasados"
          />
        </div>
      )}
    </section>
  );
}
