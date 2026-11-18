"use client";

import { StatusBadge } from "@/components/atoms/status-badge";
import {
  ExpandableList,
  ExpandableRow,
} from "@/components/molecules/expandable-list";
import { LoadError } from "@/components/molecules/load-error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage } from "@/lib/api/client";
import type {
  UserEventSession,
  UserReservationItem,
  UserReservationsPage,
} from "@/lib/db/userActivity";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

/**
 * Las tres secciones del tablero del usuario (milestone 35): **Eventos** (próximas sesiones a
 * las que está inscripto), **Reservas** (las que vienen) y **Reservas pasadas** (todo su
 * historial, paginado). Antes había una sola lista con «las últimas 10 creadas», que mezclaba
 * pasado y futuro y nunca mostraba el resto.
 */

/** "mié 18/11 · 15:15 a 17:00": el día corto y el horario, siempre en español y 24 h. */
export function formatWhen(startMs: number, endMs: number): string {
  const start = new Date(startMs);
  const day = start.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  const time = (ms: number) =>
    new Date(ms).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  return `${day} · ${time(startMs)} a ${time(endMs)}`;
}

export function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: string;
}) {
  return (
    <h2
      id={id}
      className="mb-3 text-lg font-semibold text-gray-900 dark:text-white"
    >
      {children}
    </h2>
  );
}

export function ListSkeleton() {
  return (
    <div className="space-y-px overflow-hidden rounded-lg border border-border">
      <Skeleton className="h-14 w-full rounded-none" />
      <Skeleton className="h-14 w-full rounded-none" />
    </div>
  );
}

export function Empty({ children }: { children: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function ReservationRows({ items }: { items: UserReservationItem[] }) {
  return (
    <ExpandableList>
      {items.map((r) => (
        <ExpandableRow
          key={r.id}
          value={r.id}
          title={r.title}
          subtitle={`${r.spaceName ?? "Espacio"} · ${formatWhen(r.startTime, r.endTime)}`}
          trailing={<StatusBadge status={r.status} />}
        >
          {r.reason ? (
            <p className="text-sm break-words whitespace-pre-wrap">
              {r.reason}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Sin descripción.</p>
          )}
          {r.isRecurring ? (
            <p className="text-sm text-muted-foreground">
              Parte de una reserva recurrente.
            </p>
          ) : null}
          {r.status === "REJECTED" && r.deniedReason ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                Motivo del rechazo:
              </span>{" "}
              {r.deniedReason}
            </p>
          ) : null}
        </ExpandableRow>
      ))}
    </ExpandableList>
  );
}

export function UpcomingEventsSection() {
  const { data, error, firstTime, refetch, loading } = useApi<
    UserEventSession[]
  >("/api/user/upcoming-events");
  return (
    <section aria-labelledby="dash-events">
      <SectionHeading id="dash-events">Eventos</SectionHeading>
      {error && !data ? (
        <LoadError
          message={apiErrorMessage(error, "No se pudieron cargar tus eventos.")}
          onRetry={() => void refetch()}
          busy={loading}
        />
      ) : firstTime ? (
        <ListSkeleton />
      ) : !data || data.length === 0 ? (
        <Empty>No tenés sesiones de eventos próximas.</Empty>
      ) : (
        <ExpandableList>
          {data.map((s) => (
            <ExpandableRow
              key={s.id}
              value={s.id}
              title={s.name}
              subtitle={`${s.spaceName ?? "Espacio"} · ${formatWhen(s.startTime, s.endTime)}`}
              trailing={
                s.participantStatus === "PENDING" ? (
                  <StatusBadge status="PENDING" />
                ) : null
              }
            >
              <p className="text-sm text-muted-foreground">
                {s.participantStatus === "PENDING"
                  ? "Tu inscripción espera la aprobación del equipo."
                  : "Estás inscripto en este evento."}
              </p>
              <Button asChild size="sm" variant="outline">
                <a href={`/events/${s.eventId}`}>Ver evento</a>
              </Button>
            </ExpandableRow>
          ))}
        </ExpandableList>
      )}
    </section>
  );
}

export function UpcomingReservationsSection() {
  const { data, error, firstTime, refetch, loading } =
    useApi<UserReservationsPage>("/api/user/reservations?when=upcoming&page=1");
  return (
    <section aria-labelledby="dash-upcoming">
      <SectionHeading id="dash-upcoming">Reservas</SectionHeading>
      {error && !data ? (
        <LoadError
          message={apiErrorMessage(
            error,
            "No se pudieron cargar tus reservas.",
          )}
          onRetry={() => void refetch()}
          busy={loading}
        />
      ) : firstTime ? (
        <ListSkeleton />
      ) : !data || data.items.length === 0 ? (
        <Empty>No tenés reservas próximas.</Empty>
      ) : (
        <>
          <ReservationRows items={data.items} />
          {data.total > data.items.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Mostrando las próximas {data.items.length} de {data.total}. Ves el
              resto en el calendario.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

/** El historial completo, de a 10, de la más reciente a la más antigua. */
export function PastReservationsSection() {
  const [page, setPage] = useState(1);
  const { data, error, firstTime, refetch, loading } =
    useApi<UserReservationsPage>(
      `/api/user/reservations?when=past&page=${page}`,
    );
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;
  return (
    <section aria-labelledby="dash-past">
      <SectionHeading id="dash-past">Reservas pasadas</SectionHeading>
      {error && !data ? (
        <LoadError
          message={apiErrorMessage(error, "No se pudo cargar tu historial.")}
          onRetry={() => void refetch()}
          busy={loading}
        />
      ) : firstTime ? (
        <ListSkeleton />
      ) : !data || data.total === 0 ? (
        <Empty>Todavía no tenés reservas pasadas.</Empty>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : undefined}>
          <ReservationRows items={data.items} />
          <Pager
            page={page}
            totalPages={totalPages}
            total={data.total}
            loading={loading}
            onPage={setPage}
            noun="reservas"
            label="Paginación del historial"
          />
        </div>
      )}
    </section>
  );
}

/** Paginación Anterior / Siguiente de los historiales del usuario. */
export function Pager({
  page,
  totalPages,
  total,
  loading,
  onPage,
  noun,
  label,
}: {
  page: number;
  totalPages: number;
  total: number;
  loading: boolean;
  onPage: (page: number) => void;
  noun: string;
  label: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      className="mt-3 flex items-center justify-center gap-3"
      aria-label={label}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1 || loading}
        onClick={() => onPage(Math.max(1, page - 1))}
      >
        <ChevronLeft className="h-4 w-4" />
        Anterior
      </Button>
      <span className="text-sm text-muted-foreground tabular-nums">
        Página {page} de {totalPages} · {total} {noun}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= totalPages || loading}
        onClick={() => onPage(Math.min(totalPages, page + 1))}
      >
        Siguiente
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
