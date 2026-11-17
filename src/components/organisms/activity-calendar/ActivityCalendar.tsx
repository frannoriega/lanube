"use client";

import { LoadError } from "@/components/molecules/load-error";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import { useServerTime } from "@/components/providers/server-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage } from "@/lib/api/client";
import {
  calendarNavigationEndMs,
  type ActivityCalendarData,
  type CalendarItem,
} from "@/lib/calendar/activity";
import { EVENT_STATUS_LABELS } from "@/lib/constants/events";
import { cn } from "@/lib/utils";
import { format, isSameDay, isSameMonth, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CALENDAR_VIEWS,
  defaultViewFor,
  hourBounds,
  isCalendarView,
  itemsOnDay,
  layoutLanes,
  shiftAnchor,
  verticalPosition,
  viewDays,
  viewRange,
  viewTitle,
  type CalendarView,
} from "./calendar-view";

/**
 * Calendario de actividades (milestone 32): **solo lectura**, con vistas de día, 3 días,
 * semana y mes. Todo lo que pasa en La Nube: reservas, eventos, días cerrados y (admins)
 * mantenimiento. No se reserva desde acá — para eso está el calendario de cada espacio
 * (`WeekCalendar`), que no se tocó.
 *
 * - `scope="admin"`: `/api/admin/calendar` (con quién reservó y filtro por espacio).
 * - `scope="user"`: `/api/user/calendar` (lo ajeno llega como «Ocupado»).
 *
 * Pide solo el rango visible. Se navega hasta el fin del año próximo (el servidor valida lo
 * mismo). La vista elegida se recuerda en `localStorage`; sin elección previa, depende del
 * ancho (día en teléfonos).
 */

const VIEW_STORAGE_KEY = "lanube:activity-calendar:view";
const HOUR_PX = 48;
const MONTH_MAX_CHIPS = 3;

/** Colores por tipo de ítem (texto blanco ≥ 4.5:1 sobre los fondos -700, como `DayColumn`). */
function itemClasses(item: CalendarItem): string {
  switch (item.kind) {
    case "event":
      return item.eventStatus && item.eventStatus !== "PUBLISHED"
        ? "border border-dashed border-violet-700 bg-violet-100 text-violet-950 dark:border-violet-300 dark:bg-violet-950 dark:text-violet-100"
        : "bg-violet-700 text-white";
    case "reservation":
      if (item.status === "PENDING") {
        return "border border-dashed border-amber-700 bg-amber-100 text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100";
      }
      return item.own
        ? "bg-green-700 text-white"
        : "bg-la-nube-selected text-white";
    case "busy":
      return "border border-border bg-muted text-muted-foreground";
    case "closed":
      return "border border-border bg-[repeating-linear-gradient(135deg,var(--muted)_0,var(--muted)_6px,transparent_6px,transparent_12px)] bg-background text-foreground";
    case "maintenance":
      return "border border-amber-700 bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100";
  }
}

function kindLabel(item: CalendarItem): string {
  switch (item.kind) {
    case "event":
      return "Evento";
    case "reservation":
      return item.own ? "Tu reserva" : "Reserva";
    case "busy":
      return "Ocupado";
    case "closed":
      return "Cerrado";
    case "maintenance":
      return "Mantenimiento";
  }
}

const hm = (ms: number) => format(new Date(ms), "HH:mm");

function timeLabel(item: CalendarItem): string {
  if (item.allDay) {
    const s = new Date(item.startMs);
    const e = new Date(item.endMs);
    return isSameDay(s, e)
      ? format(s, "EEEE d 'de' MMMM", { locale: es })
      : `${format(s, "d/MM")} al ${format(e, "d/MM")}`;
  }
  return `${hm(item.startMs)} a ${hm(item.endMs)}`;
}

export function ActivityCalendar({
  scope,
  spaces = [],
}: {
  scope: "admin" | "user";
  /** Solo admins: espacios para el filtro. */
  spaces?: { id: string; name: string }[];
}) {
  const { now } = useServerTime();

  const [view, setView] = useState<CalendarView | null>(null);
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(now()));
  const [space, setSpace] = useState<string>("all");
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [dayList, setDayList] = useState<Date | null>(null);

  // Vista: la guardada, o la que corresponde al ancho. En un efecto (no en el render) para no
  // leer `localStorage` en el servidor.
  useEffect(() => {
    let stored: unknown = null;
    try {
      stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    } catch {
      // Almacenamiento bloqueado: se usa la vista por ancho.
    }
    setView(
      isCalendarView(stored)
        ? stored
        : defaultViewFor({
            // `matchMedia` directo y no `useMediaQuery`: durante la hidratación ese hook
            // devuelve su valor de servidor, y en un teléfono abría en «Semana».
            isSm: window.matchMedia("(min-width: 640px)").matches,
            isMd: window.matchMedia("(min-width: 768px)").matches,
          }),
    );
    // Solo al montar: después manda lo que elija la persona.
  }, []);

  const chooseView = (v: CalendarView) => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      // Sin almacenamiento: la elección vale hasta recargar.
    }
  };

  const activeView = view ?? "day";
  const days = useMemo(
    () => viewDays(activeView, anchor),
    [activeView, anchor],
  );
  const range = viewRange(days);
  const limitMs = calendarNavigationEndMs(now().getTime());
  const canGoForward =
    viewRange(viewDays(activeView, shiftAnchor(activeView, anchor, 1))).from <=
    limitMs;

  const url = view
    ? `/api/${scope}/calendar?${new URLSearchParams({
        from: String(range.from),
        to: String(range.to),
        ...(scope === "admin" && space !== "all" ? { space } : {}),
      })}`
    : null;
  const { data, error, loading, refetch } = useApi<ActivityCalendarData>(url);
  const items = useMemo(() => data?.items ?? [], [data]);
  const today = startOfDay(now());

  return (
    <div className="space-y-4">
      {/* Barra: navegación, título, vista y filtro */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setAnchor(today)}>
          Hoy
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Anterior"
          onClick={() => setAnchor(shiftAnchor(activeView, anchor, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Siguiente"
          disabled={!canGoForward}
          title={
            canGoForward
              ? undefined
              : "El calendario llega hasta el fin del año próximo"
          }
          onClick={() => setAnchor(shiftAnchor(activeView, anchor, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="min-w-0 flex-1 text-lg font-semibold" aria-live="polite">
          {viewTitle(activeView, days, anchor)}
          {loading && (
            <Loader2
              className="ml-2 inline h-4 w-4 animate-spin text-muted-foreground"
              aria-label="Cargando"
            />
          )}
        </h2>
        <ToggleGroup
          type="single"
          variant="outline"
          value={activeView}
          onValueChange={(v) => isCalendarView(v) && chooseView(v)}
          aria-label="Vista"
        >
          {CALENDAR_VIEWS.map((v) => (
            <ToggleGroupItem key={v.value} value={v.value} className="px-3">
              {v.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {scope === "admin" && spaces.length > 0 && (
          <Select value={space} onValueChange={setSpace}>
            <SelectTrigger className="w-48" aria-label="Espacio">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los espacios</SelectItem>
              {spaces.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Legend scope={scope} />

      {error && (
        <LoadError
          message={apiErrorMessage(error, "No se pudo cargar el calendario.")}
          onRetry={() => void refetch()}
          busy={loading}
        />
      )}

      {view &&
        (activeView === "month" ? (
          <MonthGrid
            days={days}
            anchor={anchor}
            today={today}
            items={items}
            onSelect={setSelected}
            onMore={setDayList}
            onOpenDay={(d) => {
              setAnchor(d);
              chooseView("day");
            }}
          />
        ) : (
          <TimeGrid
            days={days}
            today={today}
            items={items}
            onSelect={setSelected}
          />
        ))}

      <ItemDialog
        item={selected}
        scope={scope}
        onClose={() => setSelected(null)}
      />
      <DayListDialog
        day={dayList}
        items={dayList ? itemsOnDay(items, dayList) : []}
        onClose={() => setDayList(null)}
        onSelect={(i) => {
          setDayList(null);
          setSelected(i);
        }}
      />
    </div>
  );
}

function Legend({ scope }: { scope: "admin" | "user" }) {
  const entries: { label: string; className: string }[] =
    scope === "admin"
      ? [
          { label: "Reserva aprobada", className: "bg-la-nube-selected" },
          {
            label: "Reserva pendiente",
            className: "border border-dashed border-amber-700 bg-amber-100",
          },
          { label: "Evento", className: "bg-violet-700" },
          {
            label: "Evento sin publicar",
            className: "border border-dashed border-violet-700 bg-violet-100",
          },
          { label: "Cerrado", className: "border border-border bg-muted" },
          {
            label: "Mantenimiento",
            className: "border border-amber-700 bg-amber-50",
          },
        ]
      : [
          { label: "Tu reserva", className: "bg-green-700" },
          {
            label: "Tu reserva pendiente",
            className: "border border-dashed border-amber-700 bg-amber-100",
          },
          { label: "Evento", className: "bg-violet-700" },
          { label: "Ocupado", className: "border border-border bg-muted" },
          { label: "Cerrado", className: "border border-border bg-background" },
        ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {entries.map((e) => (
        <li key={e.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn("inline-block h-3 w-3 rounded-sm", e.className)}
          />
          {e.label}
        </li>
      ))}
    </ul>
  );
}

/** Vista de día / 3 días / semana: franja de «todo el día» arriba y la grilla horaria. */
function TimeGrid({
  days,
  today,
  items,
  onSelect,
}: {
  days: Date[];
  today: Date;
  items: CalendarItem[];
  onSelect: (i: CalendarItem) => void;
}) {
  const timed = items.filter((i) => !i.allDay);
  const allDay = items.filter((i) => i.allDay);
  const bounds = hourBounds(days.flatMap((d) => itemsOnDay(timed, d)));
  const hours = bounds.end - bounds.start;
  const cols = {
    gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))`,
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      {/* Encabezado de días */}
      <div className="grid border-b border-border" style={cols}>
        <div />
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "border-l border-border px-1 py-2 text-center",
                isToday &&
                  "bg-la-nube-primary/10 font-bold text-la-nube-selected dark:text-la-nube-secondary",
              )}
            >
              <div className="text-xs font-medium uppercase">
                {format(d, "EEE", { locale: es })}
              </div>
              <div className="text-lg font-bold">{format(d, "d")}</div>
            </div>
          );
        })}
      </div>

      {/* Todo el día: cierres y mantenimiento */}
      {days.some((d) => itemsOnDay(allDay, d).length > 0) && (
        <div className="grid border-b border-border" style={cols}>
          <div className="px-1 py-1 text-[10px] leading-tight text-muted-foreground">
            Todo el día
          </div>
          {days.map((d) => (
            <div
              key={d.toISOString()}
              className="space-y-1 border-l border-border p-1"
            >
              {itemsOnDay(allDay, d).map((i) => (
                <ItemChip key={i.id} item={i} onSelect={onSelect} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Grilla horaria */}
      <div className="grid" style={cols}>
        <div className="relative" style={{ height: hours * HOUR_PX }}>
          {Array.from({ length: hours }, (_, h) => (
            <div
              key={h}
              className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground"
              style={{ top: h * HOUR_PX }}
            >
              {h > 0 ? `${String(bounds.start + h).padStart(2, "0")}:00` : ""}
            </div>
          ))}
        </div>
        {days.map((d) => (
          <DayColumn
            key={d.toISOString()}
            day={d}
            items={itemsOnDay(timed, d)}
            bounds={bounds}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({
  day,
  items,
  bounds,
  onSelect,
}: {
  day: Date;
  items: CalendarItem[];
  bounds: { start: number; end: number };
  onSelect: (i: CalendarItem) => void;
}) {
  const hours = bounds.end - bounds.start;
  const lanes = layoutLanes(items);
  return (
    <div
      className="relative border-l border-border"
      style={{ height: hours * HOUR_PX }}
    >
      {Array.from({ length: hours - 1 }, (_, h) => (
        <div
          key={h}
          className="absolute w-full border-t border-border/70"
          style={{ top: (h + 1) * HOUR_PX }}
        />
      ))}
      {items.map((i) => {
        const pos = verticalPosition(i, day, bounds);
        const lane = lanes.get(i.id) ?? { lane: 0, lanes: 1 };
        const width = 100 / lane.lanes;
        return (
          <button
            key={i.id}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "absolute overflow-hidden rounded px-1 py-0.5 text-left text-[11px] leading-tight shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              itemClasses(i),
            )}
            style={{
              top: `${pos.top}%`,
              height: `max(${pos.height}%, 1.25rem)`,
              left: `calc(${lane.lane * width}% + 1px)`,
              width: `calc(${width}% - 2px)`,
            }}
            aria-label={`${kindLabel(i)}: ${i.title}, ${timeLabel(i)}${i.spaceName ? `, ${i.spaceName}` : ""}`}
          >
            <div className="truncate font-semibold">{i.title}</div>
            <div className="truncate opacity-90">
              {hm(i.startMs)}–{hm(i.endMs)}
              {i.spaceName ? ` · ${i.spaceName}` : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Una línea compacta (franja de todo el día y vista de mes). */
function ItemChip({
  item,
  onSelect,
}: {
  item: CalendarItem;
  onSelect: (i: CalendarItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={cn(
        "block w-full truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        itemClasses(item),
      )}
      aria-label={`${kindLabel(item)}: ${item.title}, ${timeLabel(item)}`}
    >
      {!item.allDay && (
        <span className="mr-1 opacity-90">{hm(item.startMs)}</span>
      )}
      {item.title}
    </button>
  );
}

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function MonthGrid({
  days,
  anchor,
  today,
  items,
  onSelect,
  onMore,
  onOpenDay,
}: {
  days: Date[];
  anchor: Date;
  today: Date;
  items: CalendarItem[];
  onSelect: (i: CalendarItem) => void;
  onMore: (d: Date) => void;
  onOpenDay: (d: Date) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-1.5 text-center text-xs font-medium text-muted-foreground uppercase"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, idx) => {
          // Lo de todo el día primero, después por hora.
          const dayItems = itemsOnDay(items, d).sort(
            (a, b) =>
              Number(b.allDay) - Number(a.allDay) || a.startMs - b.startMs,
          );
          const shown = dayItems.slice(0, MONTH_MAX_CHIPS);
          const more = dayItems.length - shown.length;
          const inMonth = isSameMonth(d, anchor);
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "min-h-24 space-y-0.5 border-border p-1",
                idx % 7 !== 0 && "border-l",
                idx >= 7 && "border-t",
                !inMonth && "bg-muted/40",
              )}
            >
              <button
                type="button"
                onClick={() => onOpenDay(d)}
                className={cn(
                  "mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs focus-visible:outline-2 focus-visible:outline-ring",
                  isSameDay(d, today)
                    ? "bg-la-nube-selected font-bold text-white"
                    : inMonth
                      ? "text-foreground hover:bg-muted"
                      : "text-muted-foreground hover:bg-muted",
                )}
                aria-label={`Ver el ${format(d, "EEEE d 'de' MMMM", { locale: es })}`}
              >
                {format(d, "d")}
              </button>
              {shown.map((i) => (
                <ItemChip key={i.id} item={i} onSelect={onSelect} />
              ))}
              {more > 0 && (
                <button
                  type="button"
                  onClick={() => onMore(d)}
                  className="w-full rounded px-1 text-left text-[11px] font-medium text-la-nube-selected hover:bg-muted dark:text-la-nube-secondary"
                >
                  +{more} más
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayListDialog({
  day,
  items,
  onClose,
  onSelect,
}: {
  day: Date | null;
  items: CalendarItem[];
  onClose: () => void;
  onSelect: (i: CalendarItem) => void;
}) {
  return (
    <ResponsiveDialog open={day != null} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {day ? format(day, "EEEE d 'de' MMMM", { locale: es }) : ""}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {items.length} {items.length === 1 ? "actividad" : "actividades"}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="max-h-[60vh] space-y-1 overflow-y-auto px-4 pb-4 md:px-0">
          {items.map((i) => (
            <ItemChip key={i.id} item={i} onSelect={onSelect} />
          ))}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function ItemDialog({
  item,
  scope,
  onClose,
}: {
  item: CalendarItem | null;
  scope: "admin" | "user";
  onClose: () => void;
}) {
  return (
    <ResponsiveDialog open={item != null} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent>
        {item && (
          <>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>{item.title}</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {kindLabel(item)} · {timeLabel(item)}
                {!item.allDay &&
                  ` · ${format(new Date(item.startMs), "EEEE d 'de' MMMM", { locale: es })}`}
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <dl className="space-y-2 px-4 text-sm md:px-0">
              {item.spaceName && <Row label="Espacio">{item.spaceName}</Row>}
              {item.requester && <Row label="Reservó">{item.requester}</Row>}
              {item.status && (
                <Row label="Estado">
                  <Badge
                    variant={
                      item.status === "PENDING" ? "outline" : "secondary"
                    }
                  >
                    {item.status === "PENDING" ? "Pendiente" : "Aprobada"}
                  </Badge>
                </Row>
              )}
              {item.eventStatus && (
                <Row label="Estado">
                  <Badge variant="outline">
                    {EVENT_STATUS_LABELS[item.eventStatus]}
                  </Badge>
                </Row>
              )}
              {item.detail && <Row label="Detalle">{item.detail}</Row>}
              {item.kind === "busy" && (
                <p className="text-muted-foreground">
                  Otra persona tiene este horario reservado.
                </p>
              )}
            </dl>
            {item.kind === "event" && item.href && (
              <ResponsiveDialogFooter>
                {scope === "admin" && item.eventId && (
                  <Button asChild variant="outline">
                    <Link href={`/admin/events/${item.eventId}`}>
                      Editar evento
                    </Link>
                  </Button>
                )}
                {item.eventStatus !== "DRAFT" &&
                  item.eventStatus !== "PAUSED" && (
                    <Button
                      asChild
                      variant={item.registrationOpen ? "brand" : "outline"}
                    >
                      <Link href={item.href}>
                        {item.registrationOpen ? "Inscribirme" : "Ver evento"}
                      </Link>
                    </Button>
                  )}
              </ResponsiveDialogFooter>
            )}
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
