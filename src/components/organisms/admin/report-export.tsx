"use client";

import { selectionColumn } from "@/components/molecules/bulk-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { apiDownload, apiErrorMessage } from "@/lib/api/client";
import {
  EVENT_PART_LABELS,
  EVENT_PARTS,
  PERIOD_SECTION_LABELS,
  PERIOD_SECTIONS,
  type EventPart,
  type PeriodSection,
} from "@/lib/reports/export/build";
import { exportQuery, MAX_EXPORT_EVENTS } from "@/lib/reports/export/request";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ColumnDef,
  getCoreRowModel,
  type RowSelectionState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, Download, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

/**
 * Panel «Exportar» de los reportes: Excel (con gráficos) o CSV, eligiendo qué bloques van.
 *
 * - En `/admin/reports` (con `period`): los bloques por período (usuarios y reservas,
 *   actividad diaria, eventos del período) y una tabla con **cada evento** del período para
 *   marcar cuáles exportar con su reporte completo.
 * - En el reporte de un evento (sin `period`, con un solo evento fijo): solo las partes de ese
 *   evento.
 *
 * El archivo se arma en el servidor en el mismo pedido (`/api/admin/reports/export`) y se
 * descarga con `apiDownload`. La lista de eventos es una `DataTable` con selección (convención
 * del panel: listas largas en tablas de página, no en un modal).
 */

export interface ExportableEvent {
  id: string;
  name: string;
  detail: string;
}

const schema = z
  .object({
    format: z.enum(["xlsx", "csv"]),
    sections: z.array(z.enum(PERIOD_SECTIONS)),
    eventIds: z
      .array(z.string())
      .max(
        MAX_EXPORT_EVENTS,
        `Se pueden exportar hasta ${MAX_EXPORT_EVENTS} eventos por archivo`,
      ),
    parts: z.array(z.enum(EVENT_PARTS)),
  })
  .refine((v) => v.sections.length > 0 || v.eventIds.length > 0, {
    message: "Elegí al menos un bloque o un evento para exportar.",
    path: ["sections"],
  })
  .refine((v) => v.eventIds.length === 0 || v.parts.length > 0, {
    message: "Elegí al menos una parte de los eventos.",
    path: ["parts"],
  });

type Values = z.infer<typeof schema>;

export function ReportExportPanel({
  period,
  events,
  fixedEvent = false,
  defaultOpen = false,
}: {
  /** Período de `/admin/reports`; sin él, solo se exportan eventos. */
  period?: { fromMs: number; toMs: number };
  events: ExportableEvent[];
  /** Reporte de un evento: el evento va siempre y no se muestra la lista. */
  fixedEvent?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      format: "xlsx",
      sections: period ? ["reservations", "daily", "events"] : [],
      eventIds: fixedEvent ? events.map((e) => e.id) : [],
      parts: [...EVENT_PARTS],
    },
  });

  // Selección de la tabla ↔ `eventIds` del formulario.
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  useEffect(() => {
    if (fixedEvent) return;
    form.setValue(
      "eventIds",
      events.filter((e) => rowSelection[e.id]).map((e) => e.id),
      { shouldValidate: form.formState.isSubmitted },
    );
  }, [rowSelection, events, fixedEvent, form]);
  // Cambió el período (otra lista de eventos): la selección vieja no aplica.
  useEffect(() => setRowSelection({}), [events]);

  const columns = useMemo<ColumnDef<ExportableEvent>[]>(
    () => [
      selectionColumn<ExportableEvent>(),
      {
        id: "name",
        header: "Evento",
        enableHiding: false,
        meta: { mobile: "title", label: "Evento" },
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "detail",
        header: "En el período",
        meta: { label: "En el período" },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.detail}</span>
        ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data: events,
    columns,
    getRowId: (r) => r.id,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    autoResetPageIndex: false,
  });

  const eventIds = form.watch("eventIds");

  async function onSubmit(v: Values) {
    setBusy(true);
    try {
      const q = exportQuery({
        format: v.format,
        period: period ?? null,
        sections: v.sections as PeriodSection[],
        eventIds: v.eventIds,
        parts: v.parts as EventPart[],
      });
      await apiDownload(
        `/api/admin/reports/export?${q}`,
        `lanube-reporte.${v.format === "xlsx" ? "xlsx" : "zip"}`,
      );
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo generar el archivo."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="glass-card dark:glass-card-dark print:hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Exportar</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {fixedEvent
              ? "Descargá el reporte de este evento en Excel (con gráficos) o en CSV."
              : "Descargá el reporte en Excel (con gráficos) o en CSV, eligiendo qué incluir."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          {open ? "Ocultar" : "Elegir qué exportar"}
        </Button>
      </CardHeader>
      {open && (
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="format"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Formato</FormLabel>
                    <FormControl>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={field.value}
                        onValueChange={(v) => v && field.onChange(v)}
                        className="justify-start"
                      >
                        <ToggleGroupItem value="xlsx" className="px-4">
                          Excel (.xlsx)
                        </ToggleGroupItem>
                        <ToggleGroupItem value="csv" className="px-4">
                          CSV
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {field.value === "xlsx"
                        ? "Una hoja por bloque, con formato y gráficos que siguen a los datos. Cada hoja se puede copiar a una planilla propia."
                        : "Un archivo por tabla (si hay más de uno, van juntos en un .zip). Sin gráficos: CSV solo guarda tablas."}
                    </p>
                  </FormItem>
                )}
              />

              {period && (
                <CheckboxGroup
                  form={form}
                  name="sections"
                  label="Estadísticas del período"
                  options={PERIOD_SECTIONS.map((s) => ({
                    value: s,
                    label: PERIOD_SECTION_LABELS[s],
                  }))}
                />
              )}

              {!fixedEvent && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Reporte completo de cada evento
                  </p>
                  {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hubo eventos en este período.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Toda la vida del evento (como su página de reporte), en
                        una hoja por evento.
                      </p>
                      <DataTable table={table} />
                    </>
                  )}
                  <FormField
                    control={form.control}
                    name="eventIds"
                    render={() => (
                      <FormItem>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {(fixedEvent || eventIds.length > 0) && (
                <CheckboxGroup
                  form={form}
                  name="parts"
                  label={fixedEvent ? "Qué incluir" : "De cada evento, incluir"}
                  options={EVENT_PARTS.map((p) => ({
                    value: p,
                    label: EVENT_PART_LABELS[p],
                  }))}
                />
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={busy}>
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {busy ? "Generando…" : "Descargar"}
                </Button>
                {!fixedEvent && eventIds.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {eventIds.length === 1
                      ? "1 evento elegido"
                      : `${eventIds.length} eventos elegidos`}
                  </span>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      )}
    </Card>
  );
}

/** Grupo de casillas sobre un campo de tipo arreglo del formulario. */
function CheckboxGroup<N extends "sections" | "parts">({
  form,
  name,
  label,
  options,
}: {
  form: ReturnType<typeof useForm<Values>>;
  name: N;
  label: string;
  options: { value: Values[N][number]; label: string }[];
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => {
        const value = field.value as string[];
        return (
          <FormItem className="space-y-2">
            <FormLabel>{label}</FormLabel>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {options.map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={value.includes(o.value)}
                    onCheckedChange={(checked) =>
                      field.onChange(
                        checked
                          ? [...value, o.value]
                          : value.filter((v) => v !== o.value),
                      )
                    }
                  />
                  {o.label}
                </label>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
