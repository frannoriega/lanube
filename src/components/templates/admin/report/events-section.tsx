"use client";

import { StatGrid, StatTile } from "@/components/molecules/stat-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, useStaticTable } from "@/components/ui/data-table";
import type { EventReportRow, EventsReport } from "@/lib/db/eventReports";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CalendarDays,
  DoorOpen,
  Percent,
  Repeat,
  UserPlus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

/**
 * Bloque «Eventos» de `/admin/reports` (milestone 31), para el mismo período que el reporte
 * de reservas. Cifras en tiles (un número vale más que un gráfico para estos totales) y una
 * tabla por evento: tocar una fila abre su página (`/admin/reports/events/[id]`), con la
 * curva de inscripciones y el gráfico de asistencia.
 */

/** «42 %» o «—» cuando no hay con qué calcularlo (nunca un «0 %» que no es tal). */
export function pct(v: number | null): string {
  return v == null ? "—" : `${v} %`;
}

export default function EventsReportSection({ data }: { data: EventsReport }) {
  const router = useRouter();
  const t = data.totals;

  return (
    <section className="space-y-4 break-before-page">
      <div>
        <h2 className="text-xl font-bold print:text-black">Eventos</h2>
        <p className="text-sm text-muted-foreground print:text-gray-600">
          Sesiones del período (cuentan en el día en que ocurren) y las
          inscripciones recibidas en el período.
        </p>
      </div>

      {t.events === 0 ? (
        <Card className="glass-card dark:glass-card-dark">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hubo eventos con sesiones en este período.
          </CardContent>
        </Card>
      ) : (
        <>
          <StatGrid>
            <StatTile
              title="Eventos"
              value={t.events}
              icon={CalendarDays}
              description={`${t.sessions.held} sesiones realizadas · ${t.sessions.cancelled} canceladas${t.sessions.upcoming ? ` · ${t.sessions.upcoming} por venir` : ""}`}
            />
            <StatTile
              title="Inscripciones"
              value={t.registrations.total}
              icon={Users}
              description={`${t.registrations.APPROVED} aprobadas · ${t.registrations.PENDING} pendientes · ${t.registrations.REJECTED} rechazadas · ${t.registrations.CANCELLED} canceladas`}
            />
            <StatTile
              title="Asistencia promedio"
              value={pct(t.avgAttendancePct)}
              icon={DoorOpen}
              description={
                t.avgAttendancePct == null
                  ? "Sin check-in en los eventos del período."
                  : `${t.checkIns.registered} ingresos de inscriptos · ${t.checkIns.walkIns} sin inscripción`
              }
            />
            <StatTile
              title="Ocupación promedio"
              value={pct(t.avgOccupancyPct)}
              icon={Percent}
              description="Lugares ocupados ÷ cupo, en los eventos con cupo."
            />
            <StatTile
              title="Con cuenta en La Nube"
              value={t.withAccount}
              icon={UserPlus}
              description={`de ${t.registrations.total} inscripciones · ${t.accountAfter} crearon su cuenta después de inscribirse`}
            />
            <StatTile
              title="Sin inscripción"
              value={t.walkIns}
              icon={DoorOpen}
              description="Personas registradas en la puerta en el período."
            />
            <StatTile
              title="Personas que vuelven"
              value={t.returning}
              icon={Repeat}
              description="Inscriptas en más de un evento del período."
            />
            <StatTile
              title="Aprobación · cancelación"
              value={`${pct(t.approvalPct)} · ${pct(t.selfCancelPct)}`}
              description="Aprobadas en eventos con aprobación manual · canceladas por la propia persona."
            />
          </StatGrid>

          <Card className="glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Por evento</CardTitle>
              <p className="text-xs text-muted-foreground print:hidden">
                Tocá un evento para ver su detalle: curva de inscripciones y
                asistencia por sesión.
              </p>
            </CardHeader>
            <CardContent>
              <EventsTable
                rows={data.events}
                onOpen={(id) => router.push(`/admin/reports/events/${id}`)}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <BreakdownCard
              title="Por tipo de evento"
              rows={data.byType.map((r) => ({
                key: r.typeName,
                label: r.typeName,
                a: `${r.events} evento${r.events === 1 ? "" : "s"}`,
                b: `${r.sessions} sesiones`,
              }))}
            />
            <BreakdownCard
              title="Por espacio"
              rows={data.bySpace.map((r) => ({
                key: r.spaceName,
                label: r.spaceName,
                a: `${r.events} evento${r.events === 1 ? "" : "s"}`,
                b: `${r.hours.toLocaleString("es-AR")} h de sesiones`,
              }))}
            />
          </div>
        </>
      )}
    </section>
  );
}

function EventsTable({
  rows,
  onOpen,
}: {
  rows: EventReportRow[];
  onOpen: (id: string) => void;
}) {
  const columns = useMemo<ColumnDef<EventReportRow, unknown>[]>(
    () => [
      {
        id: "event",
        header: "Evento",
        meta: { mobile: "title", label: "Evento" },
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.typeName} · {row.original.spaceName}
            </p>
          </div>
        ),
      },
      {
        id: "sessions",
        header: "Sesiones",
        meta: { label: "Sesiones" },
        cell: ({ row }) => {
          const s = row.original.sessions;
          return (
            <span className="tabular-nums">
              {s.held} realizadas
              {s.cancelled > 0 ? ` · ${s.cancelled} canceladas` : ""}
              {s.upcoming > 0 ? ` · ${s.upcoming} por venir` : ""}
            </span>
          );
        },
      },
      {
        id: "occupancy",
        header: "Inscriptos",
        meta: { label: "Inscriptos" },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span className="tabular-nums">
              {r.holding}
              {r.capacity ? ` de ${r.capacity} (${pct(r.occupancyPct)})` : ""}
            </span>
          );
        },
      },
      {
        id: "attendance",
        header: "Asistencia",
        meta: { label: "Asistencia" },
        cell: ({ row }) => {
          const r = row.original;
          if (
            !r.checkInEnabled &&
            r.checkIns.registered + r.checkIns.walkIns === 0
          )
            return <span className="text-muted-foreground">Sin check-in</span>;
          return (
            <span className="tabular-nums">
              {pct(r.attendancePct)}
              {r.checkIns.walkIns > 0
                ? ` · ${r.checkIns.walkIns} sin inscripción`
                : ""}
            </span>
          );
        },
      },
    ],
    [],
  );
  const table = useStaticTable(rows, columns);
  return (
    <DataTable
      table={table}
      onRowClick={(r) => onOpen(r.id)}
      emptyMessage="No hubo eventos en el período."
    />
  );
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; a: string; b: string }[];
}) {
  return (
    <Card className="glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li
              key={r.key}
              className="flex flex-wrap items-baseline justify-between gap-x-4 py-2"
            >
              <span className="font-medium">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.a} · {r.b}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
