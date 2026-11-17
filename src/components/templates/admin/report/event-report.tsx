"use client";

import { LocalDateRange } from "@/components/molecules/local-date";
import { StatGrid, StatTile } from "@/components/molecules/stat-grid";
import { pct } from "@/components/templates/admin/report/events-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { EventReport } from "@/lib/db/eventReports";
import type { ChoiceDistribution } from "@/lib/events/report-stats";
import { CalendarDays, DoorOpen, Percent, UserPlus, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Página de reporte de un evento (milestone 31): toda su vida, no un período.
 *
 * Colores: las dos primeras posiciones de la paleta categórica de referencia de la skill de
 * dataviz (azul, naranja), con su paso propio para modo oscuro — validadas con
 * `validate_palette.js` contra las superficies reales de las tarjetas de reportes
 * (`glass-card`: slate-200 en claro, slate-700 en oscuro): pasan banda de luminosidad, croma,
 * separación para daltonismo (ΔE 24.7 / 26.8) y visión normal. El contraste contra esas
 * superficies (más claras que `--card`) queda en 2.6–2.9:1, por debajo de 3:1: la skill lo
 * admite solo con alivio, que acá es la tabla «Ver como tabla» del gráfico de asistencia, la
 * leyenda, el tooltip y los números visibles de las barras de opciones. El texto nunca va en el
 * color de la serie.
 */
const SERIES = {
  registered: { light: "#2a78d6", dark: "#3987e5" },
  walkIn: { light: "#eb6834", dark: "#d95926" },
};

const attendanceConfig = {
  registered: { label: "Inscriptos que ingresaron", theme: SERIES.registered },
  walkIns: { label: "Sin inscripción", theme: SERIES.walkIn },
} satisfies ChartConfig;

const curveConfig = {
  total: { label: "Inscripciones (acumulado)", theme: SERIES.registered },
} satisfies ChartConfig;

const dayLabel = (ms: number) =>
  new Date(ms).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });

/** `YYYY-MM-DD` → `dd/mm` sin pasar por `Date` (es una fecha del predio, no un instante). */
const keyLabel = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

export default function EventReportView({ data }: { data: EventReport }) {
  const registrations =
    data.byStatus.PENDING +
    data.byStatus.APPROVED +
    data.byStatus.REJECTED +
    data.byStatus.CANCELLED;
  const showAttendance = data.checkInEnabled || data.attendance.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <p className="text-sm text-muted-foreground">
          {data.typeName} · {data.spaceName} ·{" "}
          <LocalDateRange startMs={data.firstMs} endMs={data.lastMs} />
        </p>
      </div>

      <StatGrid>
        <StatTile
          title="Sesiones"
          value={data.sessions.held}
          icon={CalendarDays}
          description={`realizadas · ${data.sessions.upcoming} por venir · ${data.sessions.cancelled} canceladas`}
        />
        <StatTile
          title="Inscripciones"
          value={registrations}
          icon={Users}
          description={`${data.byStatus.APPROVED} aprobadas · ${data.byStatus.PENDING} pendientes · ${data.byStatus.REJECTED} rechazadas · ${data.byStatus.CANCELLED} canceladas`}
        />
        <StatTile
          title="Ocupación"
          value={pct(data.occupancyPct)}
          icon={Percent}
          description={
            data.capacity
              ? `${data.holding} de ${data.capacity} lugares`
              : "Sin cupo"
          }
        />
        <StatTile
          title="Asistencia promedio"
          value={pct(data.attendancePct)}
          icon={DoorOpen}
          description={
            showAttendance
              ? `${data.walkIns} sin inscripción en total`
              : "El evento no usa check-in."
          }
        />
        <StatTile
          title="Con cuenta en La Nube"
          value={data.withAccount}
          icon={UserPlus}
          description={`de ${registrations} · ${data.accountAfter} la crearon después de inscribirse`}
        />
      </StatGrid>

      {showAttendance && (
        <ChartCard
          title="Asistencia por sesión"
          description={`Cuántas personas registraron su ingreso en cada sesión. La línea marca los inscriptos aprobados hoy (${data.approvedRegistered}): el estado de una inscripción no tiene historia, así que es la referencia actual, no la de cada fecha.`}
        >
          {data.attendance.length === 0 ? (
            <Empty>Todavía no pasó ninguna sesión.</Empty>
          ) : (
            <>
              <AttendanceChart data={data} />
              <AttendanceTable data={data} />
            </>
          )}
        </ChartCard>
      )}

      <ChartCard
        title="Inscripciones en el tiempo"
        description="Total acumulado de inscripciones por el formulario, día por día (sin contar a quienes llegaron sin inscripción)."
      >
        {data.curve.length === 0 ? (
          <Empty>Todavía no hay inscripciones.</Empty>
        ) : (
          <RegistrationChart data={data} />
        )}
      </ChartCard>

      {data.choices.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.choices.map((c) => (
            <ChoiceCard key={c.fieldId} choice={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>
  );
}

function AttendanceChart({ data }: { data: EventReport }) {
  const rows = data.attendance.map((r) => ({
    label: dayLabel(r.startMs),
    registered: r.registered,
    walkIns: r.walkIns,
  }));
  const max = Math.max(
    data.approvedRegistered,
    ...rows.map((r) => r.registered + r.walkIns),
  );
  return (
    <ChartContainer
      config={attendanceConfig}
      // `--chart-gap`: el color de la tarjeta, para la separación de 2 px entre segmentos.
      className="aspect-auto h-72 w-full [--chart-gap:var(--color-slate-200)] dark:[--chart-gap:var(--color-slate-700)]"
    >
      <BarChart accessibilityLayer data={rows} barCategoryGap="30%">
        <CartesianGrid vertical={false} strokeOpacity={0.4} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={8}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={32}
          domain={[0, Math.max(1, max)]}
        />
        <ChartTooltip
          cursor={{ fillOpacity: 0.08 }}
          content={<ChartTooltipContent />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        {data.approvedRegistered > 0 && (
          <ReferenceLine
            y={data.approvedRegistered}
            stroke="currentColor"
            strokeOpacity={0.5}
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
            label={{
              value: "Inscriptos aprobados",
              position: "insideTopRight",
              fill: "currentColor",
              fontSize: 12,
            }}
          />
        )}
        {/* Separación de 2 px entre segmentos con el color de la superficie; solo el de
            arriba lleva las puntas redondeadas. */}
        <Bar
          dataKey="registered"
          stackId="a"
          fill="var(--color-registered)"
          stroke="var(--chart-gap)"
          strokeWidth={2}
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="walkIns"
          stackId="a"
          fill="var(--color-walkIns)"
          stroke="var(--chart-gap)"
          strokeWidth={2}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}

/** La misma información como tabla (lectores de pantalla, impresión, quien prefiera números). */
function AttendanceTable({ data }: { data: EventReport }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        Ver como tabla
      </summary>
      <table className="mt-2 w-full text-left tabular-nums">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 font-medium">Sesión</th>
            <th className="py-1 text-right font-medium">Inscriptos</th>
            <th className="py-1 text-right font-medium">Sin inscripción</th>
            <th className="py-1 text-right font-medium">Asistencia</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.attendance.map((r) => (
            <tr key={r.occurrenceStart}>
              <td className="py-1">{dayLabel(r.startMs)}</td>
              <td className="py-1 text-right">{r.registered}</td>
              <td className="py-1 text-right">{r.walkIns}</td>
              <td className="py-1 text-right">
                {pct(
                  data.approvedRegistered
                    ? Math.round((r.registered / data.approvedRegistered) * 100)
                    : null,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function RegistrationChart({ data }: { data: EventReport }) {
  const rows = data.curve.map((p) => ({
    label: keyLabel(p.day),
    total: p.total,
  }));
  return (
    <ChartContainer config={curveConfig} className="aspect-auto h-56 w-full">
      <LineChart accessibilityLayer data={rows}>
        <CartesianGrid vertical={false} strokeOpacity={0.4} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={16}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        {data.capacity ? (
          <ReferenceLine
            y={data.capacity}
            stroke="currentColor"
            strokeOpacity={0.5}
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
            label={{
              value: "Cupo",
              position: "insideTopRight",
              fill: "currentColor",
              fontSize: 12,
            }}
          />
        ) : null}
        <Line
          dataKey="total"
          type="stepAfter"
          stroke="var(--color-total)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}

/** Una pregunta de opciones como lista de barras horizontales en HTML (con su número). */
function ChoiceCard({ choice }: { choice: ChoiceDistribution }) {
  const max = Math.max(1, ...choice.options.map((o) => o.count));
  return (
    <Card className="glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{choice.label}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {choice.answered} respuesta{choice.answered === 1 ? "" : "s"} de
          quienes ocupan un lugar
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {choice.options.map((o) => (
            <li key={o.option} className="space-y-1">
              <div className="flex justify-between gap-2">
                <span className="truncate">{o.option}</span>
                <span className="tabular-nums text-muted-foreground">
                  {o.count}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted" aria-hidden>
                <div
                  className="h-2 rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
                  style={{ width: `${(o.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
