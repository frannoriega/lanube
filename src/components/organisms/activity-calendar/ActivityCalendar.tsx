"use client";

import { LoadError } from "@/components/molecules/load-error";
import { StatusBadge } from "@/components/atoms/status-badge";
import { FramedImage } from "@/components/molecules/framed-image";
import { useServerTime } from "@/components/providers/server-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  aggregateOccupancy,
  occupancyLabel,
  occupancyLevel,
} from "@/lib/calendar/occupancy";
import { toCapitalCase } from "@/lib/utils/string";
import { format, isSameDay, isSameMonth, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlignLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  User,
} from "lucide-react";
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
 * Las tarjetas muestran **título + espacio** (sin horario: lo dice la columna de horas) y, al
 * tocarlas, abren el detalle en un popover anclado a la tarjeta — sin modal (milestone 35).
 *
 * - `scope="admin"`: `/api/admin/calendar` (con quién reservó y filtro por espacio).
 * - `scope="user"`: `/api/user/calendar` (solo sus reservas y los eventos; lo ajeno no se muestra).
 *
 * **Admin, sin una pared de tarjetas (milestone 35):** con todos los espacios a la vez un mismo
 * horario junta una reserva por espacio y por cupo. En día / 3 días / semana, las reservas de
 * un mismo espacio que se pisan se resumen en un **chip de ocupación** «Coworking 12/20»
 * (`lib/calendar/occupancy.ts`; al tocarlo, la lista de esas reservas); una reserva que no se
 * pisa con nadie sigue siendo una tarjeta. En el **mes**, cada día muestra **conteos** (eventos,
 * aprobadas, pendientes) en vez de chips; tocar el día lo abre. Tres **capas** (Eventos,
 * Pendientes, Aprobadas) filtran lo que se ve. Los espacios son configurables y pueden ser
 * muchos: por eso un espacio es un carril solo cuando está ocupado, no una columna fija.
 *
 * Pide solo el rango visible. Se navega hasta el fin del año próximo (el servidor valida lo
 * mismo). La vista elegida se recuerda en `localStorage`; sin elección previa, depende del
 * ancho (día en teléfonos).
 */

type Layer = "events" | "pending" | "approved";
const LAYERS: { value: Layer; label: string }[] = [
  { value: "events", label: "Eventos" },
  { value: "pending", label: "Pendientes" },
  { value: "approved", label: "Aprobadas" },
];

const VIEW_STORAGE_KEY = "lanube:activity-calendar:view";
const HOUR_PX = 48;
const MONTH_MAX_CHIPS = 3;

/** Colores por tipo de ítem (texto blanco ≥ 4.5:1 sobre los fondos -700, como `DayColumn`). */
/** Color del chip de ocupación según cuán llena está la capacidad (texto blanco ≥ 4.5:1). */
const OCCUPANCY_CLASSES = {
  low: "bg-sky-800 text-white",
  mid: "bg-amber-700 text-white",
  full: "bg-red-700 text-white",
} as const;

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
    case "occupancy":
      // Solo pendientes (nadie aprobado todavía): el mismo trazo punteado que una reserva
      // pendiente, para no confundirlo con un espacio libre.
      if (item.occupancy && item.occupancy.approved === 0) {
        return "border border-dashed border-amber-700 bg-amber-100 text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100";
      }
      return OCCUPANCY_CLASSES[
        occupancyLevel(
          item.occupancy?.approved ?? 0,
          item.occupancy?.capacity ?? null,
        )
      ];
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
    case "occupancy":
      return "Ocupación";
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
  // Capas visibles (admin). `null` = la elección automática según el espacio (ver arriba).
  const [layers, setLayers] = useState<Layer[] | null>(null);

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
  const activeLayers: Layer[] = layers ?? ["events", "pending", "approved"];
  const items = useMemo(() => {
    const all = data?.items ?? [];
    if (scope !== "admin") return all;
    return all.filter((i) => {
      if (i.kind === "event") return activeLayers.includes("events");
      if (i.kind === "reservation")
        return activeLayers.includes(
          i.status === "PENDING" ? "pending" : "approved",
        );
      return true; // cierres y mantenimiento: siempre
    });
    // `activeLayers` se recalcula en cada render; su contenido depende de `layers`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, scope, layers]);
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

      {scope === "admin" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Mostrar:</span>
          <ToggleGroup
            type="multiple"
            variant="outline"
            size="sm"
            value={activeLayers}
            onValueChange={(v) => setLayers(v as Layer[])}
            aria-label="Qué mostrar"
          >
            {LAYERS.map((l) => (
              <ToggleGroupItem key={l.value} value={l.value} className="px-3">
                {l.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      <Legend scope={scope} singleSpace={space !== "all"} />

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
            scope={scope}
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
            scope={scope}
            singleSpace={space !== "all"}
          />
        ))}
    </div>
  );
}

function Legend({
  scope,
  singleSpace,
}: {
  scope: "admin" | "user";
  singleSpace: boolean;
}) {
  const entries: { label: string; className: string }[] =
    scope === "admin"
      ? [
          ...(singleSpace
            ? [
                { label: "Reserva aprobada", className: "bg-la-nube-selected" },
                { label: "Ocupación baja", className: "bg-sky-800" },
                { label: "Ocupación media (70%+)", className: "bg-amber-700" },
                { label: "Ocupación completa", className: "bg-red-700" },
              ]
            : [{ label: "Reservas aprobadas", className: "bg-sky-800" }]),
          {
            label: singleSpace ? "Reserva pendiente" : "Solo pendientes",
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
      {scope === "admin" && (
        <li>
          {singleSpace
            ? "Los chips dicen «personas aprobadas/capacidad» y «+N» reservas pendientes."
            : "Cada bloque cuenta las reservas de todos los espacios a esa hora; tocalo para ver cuáles."}
        </li>
      )}
    </ul>
  );
}

/** Vista de día / 3 días / semana: franja de «todo el día» arriba y la grilla horaria. */
function TimeGrid({
  days,
  today,
  items,
  scope,
  singleSpace,
}: {
  days: Date[];
  today: Date;
  items: CalendarItem[];
  scope: Scope;
  /** Hay un espacio elegido en el filtro: ahí una reserva suelta se ve como tarjeta. */
  singleSpace: boolean;
}) {
  // Admin: las reservas de un espacio que se pisan se resumen en un chip de ocupación.
  const shown =
    scope === "admin"
      ? aggregateOccupancy(items, {
          cardsForSingles: singleSpace,
          mode: singleSpace ? "space" : "building",
        })
      : items;
  const timed = shown.filter((i) => !i.allDay);
  const allDay = shown.filter((i) => i.allDay);
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
                <ItemChip key={i.id} item={i} scope={scope} />
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
            scope={scope}
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
  scope,
}: {
  day: Date;
  items: CalendarItem[];
  bounds: { start: number; end: number };
  scope: Scope;
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
          <ItemPopover key={i.id} item={i} scope={scope}>
            {/* Un <button> centra su contenido en vertical por defecto: `justify-start` lo
                pega arriba. Solo título y espacio: el horario lo dice la columna de horas. */}
            <button
              type="button"
              className={cn(
                // `ring-1 ring-background`: un hilo del color del fondo para que dos tramos
                // seguidos se distingan.
                "absolute flex flex-col items-start justify-start overflow-hidden rounded px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm ring-1 ring-background focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                itemClasses(i),
              )}
              style={{
                top: `${pos.top}%`,
                height: `max(${pos.height}%, 1.25rem)`,
                left: `calc(${lane.lane * width}% + 1px)`,
                width: `calc(${width}% - 2px)`,
              }}
              aria-label={
                i.kind === "occupancy" && i.occupancy
                  ? i.occupancy.mode === "building"
                    ? `${i.occupancy.approved} reservas aprobadas y ${i.occupancy.pending} pendientes, ${timeLabel(i)}`
                    : `Ocupación de ${i.title}: ${i.occupancy.approved}${i.occupancy.capacity ? ` de ${i.occupancy.capacity}` : ""} personas aprobadas, ${i.occupancy.pending} reservas pendientes, ${timeLabel(i)}`
                  : `${kindLabel(i)}: ${i.title}, ${timeLabel(i)}${i.spaceName ? `, ${i.spaceName}` : ""}`
              }
            >
              {i.kind === "occupancy" && i.occupancy ? (
                i.occupancy.mode === "building" ? (
                  // Todo el edificio: cuántas reservas hay a esa hora, sin decir de qué espacio.
                  <>
                    <span className="w-full font-semibold tabular-nums">
                      {i.occupancy.approved === 0
                        ? `${i.occupancy.pending} ${i.occupancy.pending === 1 ? "pendiente" : "pendientes"}`
                        : `${i.occupancy.approved} ${i.occupancy.approved === 1 ? "reserva" : "reservas"}`}
                    </span>
                    {i.occupancy.approved > 0 && i.occupancy.pending > 0 ? (
                      <span className="w-full truncate opacity-90">
                        {i.occupancy.pending} pend.
                      </span>
                    ) : null}
                  </>
                ) : (
                  // Un espacio: el número primero («12/20 +2») y debajo el espacio.
                  <>
                    <span className="w-full font-semibold tabular-nums">
                      {occupancyLabel(i.occupancy)}
                    </span>
                    <span className="w-full truncate opacity-90">
                      {i.title}
                    </span>
                  </>
                )
              ) : (
                <span className="w-full truncate font-semibold">{i.title}</span>
              )}
              {i.kind === "occupancy" ? null : i.spaceName ? (
                <span className="w-full truncate opacity-90">
                  {i.spaceName}
                </span>
              ) : null}
            </button>
          </ItemPopover>
        );
      })}
    </div>
  );
}

/**
 * Una línea compacta (franja de todo el día y vista de mes). El mes no tiene columna de horas,
 * así que ahí sí lleva la hora de inicio.
 */
function ItemChip({
  item,
  scope,
  showStart = false,
}: {
  item: CalendarItem;
  scope: Scope;
  showStart?: boolean;
}) {
  return (
    <ItemPopover item={item} scope={scope}>
      <button
        type="button"
        className={cn(
          "block w-full truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
          itemClasses(item),
        )}
        aria-label={`${kindLabel(item)}: ${item.title}, ${timeLabel(item)}`}
      >
        {showStart && !item.allDay && (
          <span className="mr-1 opacity-90">{hm(item.startMs)}</span>
        )}
        {item.title}
      </button>
    </ItemPopover>
  );
}

/**
 * Conteos de un día en el mes del admin (milestone 35): en vez de una pila de chips, un número
 * por tipo — eventos, reservas aprobadas, pendientes — con el color de su leyenda, y una marca
 * si el día está cerrado o en mantenimiento. Tocar el día lo abre en la vista de día.
 */
function DayCounts({
  day,
  items,
  onOpen,
}: {
  day: Date;
  items: CalendarItem[];
  onOpen: (d: Date) => void;
}) {
  const events = items.filter((i) => i.kind === "event").length;
  const approved = items.filter(
    (i) => i.kind === "reservation" && i.status === "APPROVED",
  ).length;
  const pending = items.filter(
    (i) => i.kind === "reservation" && i.status === "PENDING",
  ).length;
  const closed = items.some((i) => i.kind === "closed");
  const maintenance = items.some((i) => i.kind === "maintenance");
  if (!events && !approved && !pending && !closed && !maintenance) return null;

  const counts = [
    { n: events, dot: "bg-violet-700", one: "evento", many: "eventos" },
    {
      n: approved,
      dot: "bg-la-nube-selected",
      one: "reserva aprobada",
      many: "reservas aprobadas",
    },
    {
      n: pending,
      dot: "bg-amber-600",
      one: "reserva pendiente",
      many: "reservas pendientes",
    },
  ].filter((c) => c.n > 0);
  const label = [
    ...counts.map((c) => `${c.n} ${c.n === 1 ? c.one : c.many}`),
    closed ? "cerrado" : null,
    maintenance ? "mantenimiento" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      onClick={() => onOpen(day)}
      aria-label={`${format(day, "EEEE d 'de' MMMM", { locale: es })}: ${label}`}
      className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded px-1 py-0.5 text-left text-[11px] font-medium tabular-nums hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      {counts.map((c) => (
        <span key={c.dot} className="inline-flex items-center gap-1">
          <span
            aria-hidden="true"
            className={cn("h-2 w-2 rounded-full", c.dot)}
          />
          {c.n}
        </span>
      ))}
      {closed && <span className="text-muted-foreground">Cerrado</span>}
      {maintenance && (
        <span className="text-amber-700 dark:text-amber-400">Mant.</span>
      )}
    </button>
  );
}

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function MonthGrid({
  days,
  anchor,
  today,
  items,
  scope,
  onOpenDay,
}: {
  days: Date[];
  anchor: Date;
  today: Date;
  items: CalendarItem[];
  scope: Scope;
  /** Abre ese día en la vista de día (también lo hace «+N más»: no hay un modal con la lista). */
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
              {scope === "admin" ? (
                <DayCounts day={d} items={dayItems} onOpen={onOpenDay} />
              ) : (
                shown.map((i) => (
                  <ItemChip key={i.id} item={i} scope={scope} showStart />
                ))
              )}
              {scope !== "admin" && more > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenDay(d)}
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

type Scope = "admin" | "user";

/** Franja de color de la cabecera del detalle: la misma familia que usa la leyenda. */
function accentClass(item: CalendarItem): string {
  switch (item.kind) {
    case "event":
      return "bg-violet-700";
    case "reservation":
      if (item.status === "PENDING") return "bg-amber-600";
      return item.own ? "bg-green-700" : "bg-la-nube-selected";
    case "maintenance":
      return "bg-amber-600";
    case "occupancy":
      return {
        low: "bg-sky-800",
        mid: "bg-amber-700",
        full: "bg-red-700",
      }[
        occupancyLevel(
          item.occupancy?.approved ?? 0,
          item.occupancy?.capacity ?? null,
        )
      ];
    default:
      return "bg-muted-foreground/50";
  }
}

/** Ancla un popover con el detalle a la tarjeta (`children` es el botón). */
function ItemPopover({
  item,
  scope,
  children,
}: {
  item: CalendarItem;
  scope: Scope;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="w-80 max-w-[calc(100vw-2rem)] overflow-hidden p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ItemDetails item={item} scope={scope} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * El detalle de un ítem del calendario (milestone 35): franja de color, portada (eventos),
 * título, el tipo y el estado, y una fila con ícono por dato — día, horario exacto, espacio,
 * quién reservó, descripción —. Es lo único que muestra el horario exacto: la tarjeta de la
 * grilla solo lleva título y espacio.
 */
function ItemDetails({ item, scope }: { item: CalendarItem; scope: Scope }) {
  if (item.kind === "occupancy" && item.occupancy) {
    return <OccupancyDetails item={item} occupancy={item.occupancy} />;
  }
  const start = new Date(item.startMs);
  const showImage = item.kind === "event" && item.imageUrl;
  return (
    <div className="text-sm">
      <div className={cn("h-1.5", accentClass(item))} aria-hidden="true" />
      {showImage ? (
        <FramedImage
          src={item.imageUrl!}
          alt=""
          sizes="320px"
          className="h-32 w-full"
        />
      ) : null}
      <div className="space-y-3 p-4">
        <div className="space-y-1.5">
          <h3 className="text-base leading-snug font-semibold [overflow-wrap:anywhere]">
            {item.title}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{kindLabel(item)}</span>
            {item.status && <StatusBadge status={item.status} />}
            {item.eventStatus && (
              <Badge variant="outline">
                {EVENT_STATUS_LABELS[item.eventStatus]}
              </Badge>
            )}
          </div>
        </div>

        <dl className="space-y-2">
          <Row icon={CalendarDays} label="Día">
            {item.allDay && !isSameDay(start, new Date(item.endMs))
              ? timeLabel(item)
              : toCapitalCase(
                  format(start, "EEEE d 'de' MMMM", { locale: es }),
                )}
          </Row>
          {!item.allDay && (
            <Row icon={Clock} label="Horario">
              {hm(item.startMs)} a {hm(item.endMs)}
            </Row>
          )}
          {item.spaceName && (
            <Row icon={MapPin} label="Espacio">
              {item.spaceName}
            </Row>
          )}
          {item.requester && (
            <Row icon={User} label="Reservó">
              {item.requester}
            </Row>
          )}
          {item.description && (
            <Row icon={AlignLeft} label="Descripción">
              <span className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
                {item.description}
              </span>
            </Row>
          )}
          {item.detail && (
            <Row icon={AlignLeft} label="Detalle">
              {item.detail}
            </Row>
          )}
        </dl>

        {item.kind === "event" && item.href && (
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {scope === "admin" && item.eventId && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/events/${item.eventId}`}>
                  Editar evento
                </Link>
              </Button>
            )}
            {item.eventStatus !== "DRAFT" && item.eventStatus !== "PAUSED" && (
              <Button
                asChild
                size="sm"
                variant={item.registrationOpen ? "brand" : "outline"}
              >
                <Link href={item.href}>
                  {item.registrationOpen ? "Inscribirme" : "Ver evento"}
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Detalle de un chip de ocupación: el resumen y la lista de las reservas que lo forman. */
function OccupancyDetails({
  item,
  occupancy,
}: {
  item: CalendarItem;
  occupancy: NonNullable<CalendarItem["occupancy"]>;
}) {
  const members = [...occupancy.members].sort((a, b) => a.startMs - b.startMs);
  if (occupancy.mode === "building") {
    return <BuildingDetails item={item} occupancy={occupancy} />;
  }
  return (
    <div className="text-sm">
      <div className={cn("h-1.5", accentClass(item))} aria-hidden="true" />
      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-base leading-snug font-semibold [overflow-wrap:anywhere]">
            {item.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {toCapitalCase(
              format(new Date(item.startMs), "EEEE d 'de' MMMM", {
                locale: es,
              }),
            )}
            {" · "}
            {hm(item.startMs)} a {hm(item.endMs)}
          </p>
        </div>
        <p>
          <span className="text-lg font-semibold tabular-nums">
            {occupancy.capacity
              ? `${occupancy.approved}/${occupancy.capacity}`
              : occupancy.approved}
          </span>{" "}
          <span className="text-muted-foreground">
            personas como máximo a la vez
            {occupancy.pending > 0
              ? ` · ${occupancy.pending} ${occupancy.pending === 1 ? "reserva pendiente" : "reservas pendientes"}`
              : ""}
          </span>
        </p>
        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-start justify-between gap-2 border-t border-border pt-2 first:border-0 first:pt-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{m.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {hm(m.startMs)} a {hm(m.endMs)}
                  {m.requester ? ` · ${m.requester}` : ""}
                  {m.actorSize && m.actorSize > 1
                    ? ` · ${m.actorSize} personas`
                    : ""}
                </p>
              </div>
              {m.status ? <StatusBadge status={m.status} /> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Detalle de un tramo de **todo el edificio**: las reservas de esa franja agrupadas por espacio,
 * cada espacio con su ocupación («Coworking 3/12»). Es donde el admin ve el «qué espacio».
 */
function BuildingDetails({
  item,
  occupancy,
}: {
  item: CalendarItem;
  occupancy: NonNullable<CalendarItem["occupancy"]>;
}) {
  const bySpace = new Map<string, CalendarItem[]>();
  for (const m of occupancy.members) {
    const key = m.spaceName ?? "Sin espacio";
    bySpace.set(key, [...(bySpace.get(key) ?? []), m]);
  }
  const groups = [...bySpace.entries()].sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="text-sm">
      <div className="h-1.5 bg-sky-800" aria-hidden="true" />
      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-base leading-snug font-semibold">
            {occupancy.approved}{" "}
            {occupancy.approved === 1 ? "reserva" : "reservas"}
            {occupancy.pending > 0
              ? ` · ${occupancy.pending} ${occupancy.pending === 1 ? "pendiente" : "pendientes"}`
              : ""}
          </h3>
          <p className="text-xs text-muted-foreground">
            {toCapitalCase(
              format(new Date(item.startMs), "EEEE d 'de' MMMM", {
                locale: es,
              }),
            )}
            {" · "}
            {hm(item.startMs)} a {hm(item.endMs)}
          </p>
        </div>
        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {groups.map(([name, list]) => {
            const people = list
              .filter((m) => m.status === "APPROVED")
              .reduce((n, m) => n + (m.actorSize ?? 1), 0);
            const capacity = list[0].capacity;
            return (
              <section key={name}>
                <h4 className="flex items-baseline justify-between gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <span className="truncate">{name}</span>
                  <span className="tabular-nums">
                    {capacity ? `${people}/${capacity}` : people}
                  </span>
                </h4>
                <ul className="mt-1 space-y-1.5">
                  {[...list]
                    .sort((a, b) => a.startMs - b.startMs)
                    .map((m) => (
                      <li
                        key={m.id}
                        className="flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{m.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {hm(m.startMs)} a {hm(m.endMs)}
                            {m.requester ? ` · ${m.requester}` : ""}
                          </p>
                        </div>
                        {m.status ? <StatusBadge status={m.status} /> : null}
                      </li>
                    ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
