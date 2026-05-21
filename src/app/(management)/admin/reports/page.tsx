"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  dateKeyFromUnixMs,
  endOfDateKeyMs,
  startOfDateKeyMs,
} from "@/lib/admin/admin-timezone";
import { TZDate } from "@date-fns/tz";
import { BarChart3, CalendarIcon, Printer } from "lucide-react";
import { useServerTime } from "@/components/providers/server-time";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";

const ADMIN_TZ = "America/Argentina/Buenos_Aires";

const RESOURCE_LABELS: Record<string, string> = {
  COWORKING: "Coworking",
  LAB: "Laboratorio",
  AUDITORIUM: "Auditorio",
  MEETING: "Sala de reuniones",
  UNKNOWN: "Otro",
};

type DurationStats = { min: number; avg: number; max: number };

type ResourceStats = {
  resourceType: string;
  count: number;
  minMinutes: number;
  avgMinutes: number;
  maxMinutes: number;
};

type ReportData = {
  period: { from: number; to: number }; // Unix ms UTC
  users: { newRegistrations: number };
  reservations: {
    total: number;
    perResource: { resourceType: string; count: number }[];
    durationStats: {
      overall: DurationStats | null;
      perResource: ResourceStats[];
    };
  };
};

type WindowKey = "last-month" | "current-month" | "last-year" | "custom";

function nowInAdminTz(nowMs: number): TZDate {
  return new TZDate(nowMs, ADMIN_TZ);
}

function toDateKey(d: TZDate): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
}

function formatMs(ms: number): string {
  return formatDateKey(dateKeyFromUnixMs(ms));
}

function minutesToDisplay(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function getWindowRange(
  key: WindowKey,
  nowMs: number,
): { fromMs: number; toMs: number } | null {
  const now = nowInAdminTz(nowMs);

  if (key === "last-month") {
    const prevFirst = new TZDate(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
      ADMIN_TZ,
    );
    const y = prevFirst.getFullYear();
    const mo = prevFirst.getMonth() + 1;
    const fromKey = toDateKey(new TZDate(y, mo - 1, 1, ADMIN_TZ));
    const toKey = toDateKey(new TZDate(y, mo, 0, ADMIN_TZ));
    return { fromMs: startOfDateKeyMs(fromKey), toMs: endOfDateKeyMs(toKey) };
  }

  if (key === "current-month") {
    const fromKey = toDateKey(
      new TZDate(now.getFullYear(), now.getMonth(), 1, ADMIN_TZ),
    );
    const toKey = toDateKey(now);
    return { fromMs: startOfDateKeyMs(fromKey), toMs: endOfDateKeyMs(toKey) };
  }

  if (key === "last-year") {
    const lastYear = now.getFullYear() - 1;
    return {
      fromMs: startOfDateKeyMs(`${lastYear}-01-01`),
      toMs: endOfDateKeyMs(`${lastYear}-12-31`),
    };
  }

  return null;
}

function windowLabel(key: WindowKey, nowMs: number): string {
  const r = getWindowRange(key, nowMs);
  if (!r) return "";
  return `${formatMs(r.fromMs)} — ${formatMs(r.toMs)}`;
}

export default function AdminReportsPage() {
  const { now, alignRevision } = useServerTime();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeWindow, setActiveWindow] = useState<WindowKey>("last-month");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const reportRef = useRef<HTMLDivElement>(null);

  const fetchReport = useCallback(
    async (fromMs: number, toMs: number, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/reports?from=${fromMs}&to=${toMs}`,
          { signal, cache: "no-store" },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message ?? "Error al cargar el reporte");
        }
        const data: ReportData = await res.json();
        setReport(data);
        setGeneratedAt(now().toLocaleString("es-AR", { timeZone: ADMIN_TZ }));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/");
      return;
    }

    if (activeWindow !== "custom") {
      const range = getWindowRange(activeWindow, now().getTime());
      if (!range) return;
      const ctrl = new AbortController();
      void fetchReport(range.fromMs, range.toMs, ctrl.signal);
      return () => ctrl.abort();
    }
  }, [session, status, activeWindow, alignRevision, fetchReport, now, router]);

  const handleCustomFetch = () => {
    if (!customRange?.from || !customRange?.to) return;
    const fromKey = toDateKey(new TZDate(customRange.from.getTime(), ADMIN_TZ));
    const toKey = toDateKey(new TZDate(customRange.to.getTime(), ADMIN_TZ));
    void fetchReport(startOfDateKeyMs(fromKey), endOfDateKeyMs(toKey));
  };

  if (status === "loading") {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-la-nube-primary" />
      </div>
    );
  }

  if (!session) return null;

  const activePeriodLabel = report
    ? `${formatMs(report.period.from)} — ${formatMs(report.period.to)}`
    : activeWindow !== "custom"
      ? windowLabel(activeWindow, now().getTime())
      : "";

  return (
    <div className="space-y-6">
      {/* Page title — hidden when printing */}
      <div className="flex items-center gap-2 print:hidden">
        <BarChart3 className="h-6 w-6 text-la-nube-primary" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Reportes
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Estadísticas de actividad por período.
          </p>
        </div>
      </div>

      {/* Time window selector — hidden when printing */}
      <Card className="glass-card dark:glass-card-dark print:hidden">
        <CardHeader>
          <CardTitle>Período del reporte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: "last-month", label: "Mes anterior" },
                { key: "current-month", label: "Mes actual" },
                { key: "last-year", label: "Año anterior" },
                { key: "custom", label: "Personalizado" },
              ] as { key: WindowKey; label: string }[]
            ).map(({ key, label }) => (
              <Button
                key={key}
                variant={activeWindow === key ? "default" : "outline"}
                onClick={() => {
                  setActiveWindow(key);
                  setReport(null);
                  setError(null);
                }}
              >
                {label}
              </Button>
            ))}
          </div>

          {activeWindow !== "custom" && (
            <p className="text-sm text-muted-foreground">
              {windowLabel(activeWindow, now().getTime())}
            </p>
          )}

          {activeWindow === "custom" && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Rango de fechas</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-72 justify-start gap-2"
                    >
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      {customRange?.from ? (
                        customRange.to ? (
                          <>
                            {customRange.from.toLocaleDateString("es-AR")} —{" "}
                            {customRange.to.toLocaleDateString("es-AR")}
                          </>
                        ) : (
                          customRange.from.toLocaleDateString("es-AR")
                        )
                      ) : (
                        <span className="text-muted-foreground">
                          Seleccioná el período
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={customRange}
                      onSelect={setCustomRange}
                      numberOfMonths={2}
                      disabled={{ after: now() }}
                      toDate={now()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button
                onClick={handleCustomFetch}
                disabled={!customRange?.from || !customRange?.to || loading}
              >
                Generar reporte
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300 print:hidden">
          {error}
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="flex h-32 items-center justify-center print:hidden">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-la-nube-primary" />
        </div>
      )}

      {/* ───── Printable report area ───── */}
      {report && !loading && (
        <div ref={reportRef} className="space-y-6">
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
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 print:text-gray-600">
                    Nuevos registros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-la-nube-primary print:text-black">
                    {report.users.newRegistrations}
                  </p>
                  <p className="text-xs text-muted-foreground">en el período</p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* RESERVAS */}
          <section>
            <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-100 print:text-black">
              Reservas
            </h3>

            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 print:text-gray-600">
                    Total de reservas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-la-nube-primary print:text-black">
                    {report.reservations.total}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    aprobadas en el período
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Per resource table */}
            {report.reservations.perResource.length > 0 && (
              <Card className="mb-4 glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Reservas por servicio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                        <th className="pb-2 font-medium text-gray-600 dark:text-gray-300">
                          Servicio
                        </th>
                        <th className="pb-2 text-right font-medium text-gray-600 dark:text-gray-300">
                          Cantidad
                        </th>
                        <th className="pb-2 text-right font-medium text-gray-600 dark:text-gray-300">
                          % del total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.reservations.perResource
                        .slice()
                        .sort((a, b) => b.count - a.count)
                        .map((row) => (
                          <tr
                            key={row.resourceType}
                            className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                          >
                            <td className="py-2">
                              {RESOURCE_LABELS[row.resourceType] ??
                                row.resourceType}
                            </td>
                            <td className="py-2 text-right font-semibold">
                              {row.count}
                            </td>
                            <td className="py-2 text-right text-muted-foreground">
                              {report.reservations.total > 0
                                ? `${Math.round((row.count / report.reservations.total) * 100)}%`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Duration stats */}
            {report.reservations.durationStats.overall && (
              <Card className="glass-card dark:glass-card-dark print:border print:border-gray-300 print:shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Duración de reservas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                        <th className="pb-2 font-medium text-gray-600 dark:text-gray-300">
                          Servicio
                        </th>
                        <th className="pb-2 text-right font-medium text-gray-600 dark:text-gray-300">
                          Mínima
                        </th>
                        <th className="pb-2 text-right font-medium text-gray-600 dark:text-gray-300">
                          Promedio
                        </th>
                        <th className="pb-2 text-right font-medium text-gray-600 dark:text-gray-300">
                          Máxima
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                        <td className="py-2 font-medium">General</td>
                        <td className="py-2 text-right">
                          {minutesToDisplay(
                            report.reservations.durationStats.overall.min,
                          )}
                        </td>
                        <td className="py-2 text-right font-semibold text-la-nube-primary print:text-black">
                          {minutesToDisplay(
                            report.reservations.durationStats.overall.avg,
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {minutesToDisplay(
                            report.reservations.durationStats.overall.max,
                          )}
                        </td>
                      </tr>
                      {report.reservations.durationStats.perResource
                        .slice()
                        .sort((a, b) => b.count - a.count)
                        .map((row) => (
                          <tr
                            key={row.resourceType}
                            className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                          >
                            <td className="py-2">
                              {RESOURCE_LABELS[row.resourceType] ??
                                row.resourceType}
                            </td>
                            <td className="py-2 text-right">
                              {minutesToDisplay(row.minMinutes)}
                            </td>
                            <td className="py-2 text-right font-semibold">
                              {minutesToDisplay(row.avgMinutes)}
                            </td>
                            <td className="py-2 text-right">
                              {minutesToDisplay(row.maxMinutes)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {report.reservations.total === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay reservas aprobadas en este período.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
