import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportData } from "@/types/stats/report";
import type { DailyStats, ResourceStats } from "@/types/stats";
import { Printer, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";
import { DataTable, useStaticTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

interface AdminReportParams {
  data: ReportData;
  activePeriodLabel: string;
  generatedAt: string;
}

function minutesToDisplay(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const RESOURCE_LABELS: Record<string, string> = {
  COWORKING: "Coworking",
  LAB: "Laboratorio",
  AUDITORIUM: "Auditorio",
  MEETING: "Sala de reuniones",
  UNKNOWN: "Otro",
};

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

type ChartBar = {
  label: string;
  approved: number;
  pending: number;
  rejected: number;
};

function aggregateForChart(daily: DailyStats[], rangeMs: number): ChartBar[] {
  const byMonth = rangeMs > 60 * 24 * 60 * 60 * 1000;

  if (!byMonth) {
    return daily.map((d) => {
      const [, month, day] = d.dateKey.split("-");
      return {
        label: `${day}/${month}`,
        approved: d.approved,
        pending: d.pending,
        rejected: d.rejected,
      };
    });
  }

  const monthMap = new Map<string, ChartBar>();
  for (const d of daily) {
    const monthKey = d.dateKey.slice(0, 7);
    if (!monthMap.has(monthKey)) {
      const mo = Number(d.dateKey.slice(5, 7)) - 1;
      monthMap.set(monthKey, {
        label: MONTH_LABELS[mo],
        approved: 0,
        pending: 0,
        rejected: 0,
      });
    }
    const entry = monthMap.get(monthKey)!;
    entry.approved += d.approved;
    entry.pending += d.pending;
    entry.rejected += d.rejected;
  }
  return Array.from(monthMap.values());
}

function DeltaBadge({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const diff = current - previous;
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> igual que el período anterior
      </span>
    );
  }
  const positive = diff > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}
    >
      {positive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {positive ? "+" : ""}
      {diff} vs período anterior
    </span>
  );
}

const chartConfig = {
  approved: {
    label: "Aprobadas",
    color: "var(--color-approved)",
  },
  pending: {
    label: "Pendientes",
    color: "var(--color-pending)",
  },
  rejected: {
    label: "Rechazadas",
    color: "var(--color-rejected)",
  },
} satisfies ChartConfig;

function ActivityChart({ bars }: { bars: ChartBar[] }) {
  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-50 max-h-100 w-full"
      style={
        {
          "--color-approved": "hsl(142 67.98% 53.32%)",
          "--color-pending": "hsl(45 93% 47%)",
          "--color-rejected": "hsl(0 86.72% 64.92%)",
        } as React.CSSProperties
      }
    >
      <BarChart accessibilityLayer data={bars}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tick={{ fill: "currentColor" }}
        />
        <YAxis
          allowDecimals={false}
          axisLine={{ stroke: "#6b7280", strokeWidth: 1 }}
          tickLine={{ fill: "#6b7280", stroke: "#6b7280", strokeWidth: 2 }}
          tick={{ fill: "currentColor" }}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="approved"
          stackId="a"
          fill="var(--color-approved)"
          radius={[0, 0, 0, 0]}
        >
          <LabelList
            position="inside"
            fontSize={12}
            angle={-90}
            className="fill-black"
          />
        </Bar>
        <Bar
          dataKey="pending"
          stackId="a"
          fill="var(--color-pending)"
          radius={[0, 0, 0, 0]}
        >
          <LabelList
            position="inside"
            fontSize={12}
            angle={-90}
            className="fill-black"
          />
        </Bar>
        <Bar
          dataKey="rejected"
          stackId="a"
          fill="var(--color-rejected)"
          radius={[4, 4, 0, 0]}
        >
          <LabelList
            position="inside"
            fontSize={12}
            angle={-90}
            className="fill-black"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export default function AdminReport({
  data,
  activePeriodLabel,
  generatedAt,
}: AdminReportParams) {
  const rangeMs = data.period.to - data.period.from;
  const chartBars = aggregateForChart(data.daily, rangeMs);
  const hasActivity = data.daily.some(
    (d) => d.approved > 0 || d.pending > 0 || d.rejected > 0 || d.newUsers > 0,
  );

  return (
    <div className="admin-report space-y-6">
      {/* Report header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white print:text-black">
            Reporte de Actividad — La Nube Coworking
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-700">
            Período: {activePeriodLabel}
          </p>
          {generatedAt && (
            <p className="text-xs text-gray-400 dark:text-gray-500 print:text-gray-500">
              Generado: {generatedAt}
            </p>
          )}
          {data.comparison && (
            <p className="text-xs text-muted-foreground mt-1">
              Comparando con:{" "}
              {new Date(data.comparison.period.from).toLocaleDateString(
                "es-AR",
              )}
              {" — "}
              {new Date(data.comparison.period.to).toLocaleDateString("es-AR")}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          className="flex items-center gap-2 print:hidden"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </div>

      {/* USUARIOS */}
      <section>
        <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-100 print:text-black">
          Usuarios
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Nuevos registros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h4 className="text-3xl font-bold text-la-nube-primary print:text-black">
                {data.users.newRegistrations}
              </h4>
              <p className="text-xs text-muted-foreground">en el período</p>
              {data.comparison && (
                <div className="mt-1">
                  <DeltaBadge
                    current={data.users.newRegistrations}
                    previous={data.comparison.users.newRegistrations}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* RESERVAS */}
      <section>
        <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-100 print:text-black">
          Reservas
        </h3>

        {/* Summary cards */}
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Card className="glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h4 className="text-3xl font-bold text-la-nube-primary print:text-black">
                {data.reservations.total}
              </h4>
              <p className="text-xs text-muted-foreground">en el período</p>
              {data.comparison && (
                <div className="mt-1">
                  <DeltaBadge
                    current={data.reservations.total}
                    previous={data.comparison.reservations.total}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Aprobadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h4 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 print:text-black">
                {data.reservations.byStatus.approved}
              </h4>
              {data.reservations.total > 0 && (
                <p className="text-xs text-muted-foreground">
                  {Math.round(
                    (data.reservations.byStatus.approved /
                      data.reservations.total) *
                      100,
                  )}
                  % del total
                </p>
              )}
              {data.comparison && (
                <div className="mt-1">
                  <DeltaBadge
                    current={data.reservations.byStatus.approved}
                    previous={data.comparison.reservations.byStatus.approved}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h4 className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 print:text-black">
                {data.reservations.byStatus.pending}
              </h4>
              {data.reservations.total > 0 && (
                <p className="text-xs text-muted-foreground">
                  {Math.round(
                    (data.reservations.byStatus.pending /
                      data.reservations.total) *
                      100,
                  )}
                  % del total
                </p>
              )}
              {data.comparison && (
                <div className="mt-1">
                  <DeltaBadge
                    current={data.reservations.byStatus.pending}
                    previous={data.comparison.reservations.byStatus.pending}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-500 dark:text-red-400">
                Rechazadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h4 className="text-3xl font-bold text-red-500 dark:text-red-400 print:text-black">
                {data.reservations.byStatus.rejected}
              </h4>
              {data.reservations.total > 0 && (
                <p className="text-xs text-muted-foreground">
                  {Math.round(
                    (data.reservations.byStatus.rejected /
                      data.reservations.total) *
                      100,
                  )}
                  % del total
                </p>
              )}
              {data.comparison && (
                <div className="mt-1">
                  <DeltaBadge
                    current={data.reservations.byStatus.rejected}
                    previous={data.comparison.reservations.byStatus.rejected}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ACTIVIDAD POR DÍA */}
        {hasActivity && (
          <div className="mb-4">
            <Card className="glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Reservas por{" "}
                  {rangeMs > 60 * 24 * 60 * 60 * 1000 ? "mes" : "día"}
                </CardTitle>
              </CardHeader>
              <CardContent className="print:overflow-hidden">
                <ActivityChart bars={chartBars} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Per resource table */}
        {data.reservations.perResource.length > 0 && (
          <Card className="mb-4 glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Reservas por servicio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PerResourceTable data={data} />
            </CardContent>
          </Card>
        )}

        {/* Duration stats (approved only) */}
        {data.reservations.durationStats.overall && (
          <Card className="glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Duración de reservas aprobadas
                <span className="ml-2 font-normal text-muted-foreground">
                  (solo aprobadas)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DurationTable data={data} />
            </CardContent>
          </Card>
        )}

        {data.reservations.total === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay reservas en este período.
          </p>
        )}
      </section>
    </div>
  );
}

/*
 * Tablas del reporte sobre el `DataTable` compartido (milestone 14): tabla desde `md`,
 * tarjetas por debajo. Antes eran `<Table>` de 5–6 columnas numéricas que en un teléfono
 * ensanchaban toda la página a ~630px. Son componentes propios porque `useStaticTable` es un
 * hook y las tablas se muestran condicionalmente.
 */

type PerResourceRow = ReportData["reservations"]["perResource"][number];

/** Reservas por servicio: total y desglose por estado (+ variación vs el período anterior). */
function PerResourceTable({ data }: { data: ReportData }) {
  // Memoizado: armar las filas en el render le daba a TanStack un array nuevo en cada render,
  // y el reinicio de paginación resultante colgaba la página al llegar el reporte
  // (milestone 25, R2).
  const rows = useMemo(
    () =>
      data.reservations.perResource.slice().sort((a, b) => b.count - a.count),
    [data],
  );
  const columns: ColumnDef<PerResourceRow>[] = [
    {
      id: "service",
      header: "Servicio",
      meta: { mobile: "title", label: "Servicio" },
      cell: ({ row }) =>
        RESOURCE_LABELS[row.original.resourceType] ?? row.original.resourceType,
    },
    {
      id: "total",
      header: () => <div className="text-right">Total</div>,
      meta: { label: "Total" },
      cell: ({ row }) => (
        <div className="font-semibold md:text-right">{row.original.count}</div>
      ),
    },
    {
      id: "approved",
      header: () => (
        <div className="text-right text-emerald-700 dark:text-emerald-400">
          Aprobadas
        </div>
      ),
      meta: { label: "Aprobadas" },
      cell: ({ row }) => (
        <div className="text-emerald-700 md:text-right dark:text-emerald-400">
          {row.original.byStatus.approved}
        </div>
      ),
    },
    {
      id: "pending",
      header: () => (
        <div className="text-right text-yellow-700 dark:text-yellow-400">
          Pendientes
        </div>
      ),
      meta: { label: "Pendientes" },
      cell: ({ row }) => (
        <div className="text-yellow-700 md:text-right dark:text-yellow-400">
          {row.original.byStatus.pending}
        </div>
      ),
    },
    {
      id: "rejected",
      header: () => (
        <div className="text-right text-red-600 dark:text-red-400">
          Rechazadas
        </div>
      ),
      meta: { label: "Rechazadas" },
      cell: ({ row }) => (
        <div className="text-red-600 md:text-right dark:text-red-400">
          {row.original.byStatus.rejected}
        </div>
      ),
    },
    ...(data.comparison
      ? [
          {
            id: "delta",
            header: () => <div className="text-right">vs anterior</div>,
            meta: { mobile: "badge", label: "vs anterior" },
            cell: ({ row }) => {
              const cmpRow = data.comparison?.reservations.perResource.find(
                (r) => r.resourceType === row.original.resourceType,
              );
              return (
                <div className="md:text-right">
                  {cmpRow ? (
                    <DeltaBadge
                      current={row.original.count}
                      previous={cmpRow.count}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              );
            },
          } satisfies ColumnDef<PerResourceRow>,
        ]
      : []),
  ];
  const table = useStaticTable(rows, columns);
  return <DataTable table={table} />;
}

/** Fila de la tabla de duraciones: la fila "General" + una por servicio. */
interface DurationRow {
  id: string;
  label: string;
  total: number;
  min: number;
  avg: number;
  max: number;
  overall: boolean;
}

/** Filas de la tabla de duraciones: la "General" primero, después cada servicio por volumen. */
function buildDurationRows(data: ReportData): DurationRow[] {
  const stats = data.reservations.durationStats;
  return [
    ...(stats.overall
      ? [
          {
            id: "overall",
            label: "General",
            total: stats.overall.total,
            min: stats.overall.min,
            avg: stats.overall.avg,
            max: stats.overall.max,
            overall: true,
          },
        ]
      : []),
    ...stats.perResource
      .slice()
      .sort((a: ResourceStats, b: ResourceStats) => b.count - a.count)
      .map((r: ResourceStats) => ({
        id: r.resourceType,
        label: RESOURCE_LABELS[r.resourceType] ?? r.resourceType,
        total: r.totalMinutes,
        min: r.minMinutes,
        avg: r.avgMinutes,
        max: r.maxMinutes,
        overall: false,
      })),
  ];
}

/** Duración de las reservas aprobadas: total / mínima / promedio / máxima. */
function DurationTable({ data }: { data: ReportData }) {
  // Memoizado por la misma razón que en `PerResourceTable` (milestone 25, R2).
  const rows = useMemo(() => buildDurationRows(data), [data]);
  const num = (
    key: "total" | "min" | "avg" | "max",
    label: string,
    bold = false,
  ) =>
    ({
      id: key,
      header: () => <div className="text-right">{label}</div>,
      meta: { label },
      cell: ({ row }) => (
        <div
          className={`md:text-right ${bold ? "font-semibold" : ""} ${
            key === "total" && row.original.overall
              ? "text-la-nube-selected dark:text-la-nube-secondary print:text-black"
              : ""
          }`}
        >
          {minutesToDisplay(row.original[key])}
        </div>
      ),
    }) satisfies ColumnDef<DurationRow>;
  const columns: ColumnDef<DurationRow>[] = [
    {
      id: "service",
      header: "Servicio",
      meta: { mobile: "title", label: "Servicio" },
      cell: ({ row }) => (
        <span className={row.original.overall ? "font-medium" : ""}>
          {row.original.label}
        </span>
      ),
    },
    num("total", "Total", true),
    num("min", "Mínima"),
    num("avg", "Promedio", true),
    num("max", "Máxima"),
  ];
  const table = useStaticTable(rows, columns);
  return <DataTable table={table} />;
}
