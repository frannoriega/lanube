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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  cancelled: number;
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
        cancelled: d.cancelled,
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
        cancelled: 0,
      });
    }
    const entry = monthMap.get(monthKey)!;
    entry.approved += d.approved;
    entry.pending += d.pending;
    entry.rejected += d.rejected;
    entry.cancelled += d.cancelled;
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
  cancelled: {
    label: "Canceladas",
    color: "var(--color-cancelled)",
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
          "--color-cancelled": "hsl(220 9% 60%)",
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
        />
        <YAxis
          allowDecimals={false}
          axisLine={{ stroke: "#6b7280", strokeWidth: 1 }}
          tickLine={{ fill: "#6b7280", stroke: "#6b7280", strokeWidth: 2 }}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <ChartLegend
          content={<ChartLegendContent />}
          className="print:text-black"
        />
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
          dataKey="cancelled"
          stackId="a"
          fill="var(--color-cancelled)"
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
    <div className="space-y-6">
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

          <Card className="glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Canceladas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h4 className="text-3xl font-bold text-gray-500 dark:text-gray-400 print:text-black">
                {data.reservations.byStatus.cancelled}
              </h4>
              {data.reservations.total > 0 && (
                <p className="text-xs text-muted-foreground">
                  {Math.round(
                    (data.reservations.byStatus.cancelled /
                      data.reservations.total) *
                      100,
                  )}
                  % del total
                </p>
              )}
              {data.comparison && (
                <div className="mt-1">
                  <DeltaBadge
                    current={data.reservations.byStatus.cancelled}
                    previous={data.comparison.reservations.byStatus.cancelled}
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
              <Table className="w-full text-sm">
                <TableHeader>
                  <TableRow className="border-b border-gray-200 dark:border-gray-700 text-left">
                    <TableHead className="pb-2 font-medium text-gray-600 dark:text-gray-300">
                      Servicio
                    </TableHead>
                    <TableHead className="pb-2 text-right font-medium text-gray-600 dark:text-gray-300">
                      Total
                    </TableHead>
                    <TableHead className="pb-2 text-right font-medium text-emerald-600 dark:text-emerald-400">
                      Aprobadas
                    </TableHead>
                    <TableHead className="pb-2 text-right font-medium text-yellow-600 dark:text-yellow-400">
                      Pendientes
                    </TableHead>
                    <TableHead className="pb-2 text-right font-medium text-red-500 dark:text-red-400">
                      Rechazadas
                    </TableHead>
                    <TableHead className="pb-2 text-right font-medium text-gray-500 dark:text-gray-400">
                      Canceladas
                    </TableHead>
                    {data.comparison && (
                      <TableHead className="pb-2 text-right font-medium text-gray-600 dark:text-gray-300">
                        vs anterior
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.reservations.perResource
                    .slice()
                    .sort((a, b) => b.count - a.count)
                    .map((row) => {
                      const cmpRow =
                        data.comparison?.reservations.perResource.find(
                          (r) => r.resourceType === row.resourceType,
                        );
                      return (
                        <TableRow
                          key={row.resourceType}
                          className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                        >
                          <TableCell className="py-2">
                            {RESOURCE_LABELS[row.resourceType] ??
                              row.resourceType}
                          </TableCell>
                          <TableCell className="py-2 text-right font-semibold">
                            {row.count}
                          </TableCell>
                          <TableCell className="py-2 text-right text-emerald-600 dark:text-emerald-400">
                            {row.byStatus.approved}
                          </TableCell>
                          <TableCell className="py-2 text-right text-yellow-600 dark:text-yellow-400">
                            {row.byStatus.pending}
                          </TableCell>
                          <TableCell className="py-2 text-right text-red-500 dark:text-red-400">
                            {row.byStatus.rejected}
                          </TableCell>
                          <TableCell className="py-2 text-right text-gray-500 dark:text-gray-400">
                            {row.byStatus.cancelled}
                          </TableCell>
                          {data.comparison && (
                            <TableCell className="py-2 text-right">
                              {cmpRow ? (
                                <DeltaBadge
                                  current={row.count}
                                  previous={cmpRow.count}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Duration stats (approved only) */}
        {data.reservations.durationStats.overall && (
          <Card className="glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Duración de reservas aprobadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table className="w-full text-sm">
                <TableHeader>
                  <TableRow className="border-b border-gray-200 dark:border-gray-700 text-left">
                    <TableHead className="pb-2 font-medium text-gray-600 dark:text-gray-300">
                      Servicio
                    </TableHead>
                    <TableHead className="pb-2 text-right font-medium text-gray-600 dark:text-gray-300">
                      Mínima
                    </TableHead>
                    <TableHead className="pb-2 text-right font-medium text-gray-600 dark:text-gray-300">
                      Promedio
                    </TableHead>
                    <TableHead className="pb-2 text-right font-medium text-gray-600 dark:text-gray-300">
                      Máxima
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                    <TableCell className="py-2 font-medium">General</TableCell>
                    <TableCell className="py-2 text-right">
                      {minutesToDisplay(
                        data.reservations.durationStats.overall.min,
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right font-semibold text-la-nube-primary print:text-black">
                      {minutesToDisplay(
                        data.reservations.durationStats.overall.avg,
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      {minutesToDisplay(
                        data.reservations.durationStats.overall.max,
                      )}
                    </TableCell>
                  </TableRow>
                  {data.reservations.durationStats.perResource
                    .slice()
                    .sort(
                      (a: ResourceStats, b: ResourceStats) => b.count - a.count,
                    )
                    .map((row: ResourceStats) => (
                      <TableRow
                        key={row.resourceType}
                        className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                      >
                        <TableCell className="py-2">
                          {RESOURCE_LABELS[row.resourceType] ??
                            row.resourceType}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          {minutesToDisplay(row.minMinutes)}
                        </TableCell>
                        <TableCell className="py-2 text-right font-semibold">
                          {minutesToDisplay(row.avgMinutes)}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          {minutesToDisplay(row.maxMinutes)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
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
