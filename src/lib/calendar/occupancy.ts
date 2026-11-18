import type { CalendarItem } from "./activity";

/**
 * Chips de ocupación del calendario del admin (milestone 35). Función **pura**, testeada en
 * `occupancy.test.ts`; la usa `ActivityCalendar` para las vistas de día / 3 días / semana.
 *
 * Con todos los espacios a la vez, un mismo horario junta una tarjeta por reserva y por espacio:
 * ilegible (un coworking de 20 lugares son hasta 20 tarjetas). Acá, las reservas **de un mismo
 * espacio que se pisan** (se encadenan por superposición, como los carriles de `layoutLanes`) se
 * resumen en **un chip** «Coworking 12/20»: el pico de personas aprobadas a la vez sobre la
 * capacidad, más cuántas pendientes hay. Una reserva que no se pisa con ninguna queda como
 * tarjeta, con su título. Todo lo que no es una reserva con espacio pasa igual.
 *
 * Un espacio es un carril solo cuando está ocupado, no una columna fija: los espacios son
 * configurables y pueden ser muchos.
 */

/**
 * Opciones de {@link aggregateOccupancy}.
 * - `cardsForSingles`: un tramo con **una sola** reserva que lo ocupa entero queda como tarjeta
 *   con su título (útil al mirar un espacio puntual). Con todos los espacios a la vez es `false`:
 *   todo es un chip con su número, así la vista se lee igual con una reserva que con veinte.
 */
export interface AggregateOptions {
  cardsForSingles?: boolean;
  /**
   * `building`: **todo junto**, sin distinguir espacios — un tramo de tiempo es un chip con
   * cuántas reservas hay (y cuántas pendientes), esté en el espacio que esté. Es lo que se usa con
   * «Todos los espacios»: el número de chips por franja no depende de cuántos espacios existan, así
   * que funciona igual con 4 que con 40. El detalle por espacio está en el popover del chip.
   */
  mode?: "space" | "building";
}

/**
 * Parte las reservas de cada espacio en **tramos de tiempo** donde lo que está ocupado no cambia:
 * cada vez que una reserva empieza o termina hay un corte. Cada tramo es un chip con las personas
 * aprobadas a esa hora sobre la capacidad («Coworking 5/20»), así dos reservas que se pisan solo
 * una hora no pintan un bloque gigante con el pico de todo el día. Tramos contiguos con los mismos
 * números se unen.
 */
export function aggregateOccupancy(
  items: readonly CalendarItem[],
  { cardsForSingles = false, mode = "space" }: AggregateOptions = {},
): CalendarItem[] {
  const out: CalendarItem[] = [];
  const bySpace = new Map<string, CalendarItem[]>();
  for (const it of items) {
    if (it.kind === "reservation" && it.spaceId && !it.allDay) {
      const key = mode === "building" ? "*" : it.spaceId;
      bySpace.set(key, [...(bySpace.get(key) ?? []), it]);
    } else {
      out.push(it);
    }
  }

  for (const [spaceId, members] of bySpace) {
    const cuts = [
      ...new Set(members.flatMap((m) => [m.startMs, m.endMs])),
    ].sort((a, b) => a - b);

    type Seg = {
      start: number;
      end: number;
      active: CalendarItem[];
      approved: number;
      pending: number;
    };
    const segs: Seg[] = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const start = cuts[i];
      const end = cuts[i + 1];
      const active = members.filter((m) => m.startMs < end && m.endMs > start);
      if (active.length === 0) continue;
      const approvedList = active.filter((m) => m.status === "APPROVED");
      // Por espacio se cuentan personas (contra la capacidad); del edificio, reservas.
      const approved =
        mode === "building"
          ? approvedList.length
          : approvedList.reduce((n, m) => n + (m.actorSize ?? 1), 0);
      const pending = active.filter((m) => m.status === "PENDING").length;
      const last = segs[segs.length - 1];
      if (
        !cardsForSingles &&
        last &&
        last.end === start &&
        last.approved === approved &&
        last.pending === pending
      ) {
        last.end = end;
        for (const m of active)
          if (!last.active.includes(m)) last.active.push(m);
      } else {
        segs.push({ start, end, active: [...active], approved, pending });
      }
    }

    for (const seg of segs) {
      const only = seg.active.length === 1 ? seg.active[0] : null;
      if (
        cardsForSingles &&
        only &&
        only.startMs === seg.start &&
        only.endMs === seg.end
      ) {
        out.push(only);
        continue;
      }
      out.push({
        id: `occupancy:${spaceId}:${seg.start}`,
        kind: "occupancy",
        startMs: seg.start,
        endMs: seg.end,
        allDay: false,
        title:
          mode === "building"
            ? "Reservas"
            : (seg.active[0].spaceName ?? "Espacio"),
        ...(mode === "building"
          ? {}
          : { spaceId, spaceName: seg.active[0].spaceName }),
        occupancy: {
          mode,
          approved: seg.approved,
          pending: seg.pending,
          capacity:
            mode === "building" ? null : (seg.active[0].capacity ?? null),
          members: seg.active,
        },
      });
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

/** Qué tan llena está la capacidad: baja, media o completa (colorea el chip). */
export function occupancyLevel(
  approved: number,
  capacity: number | null,
): "low" | "mid" | "full" {
  if (!capacity) return "low";
  const ratio = approved / capacity;
  if (ratio >= 1) return "full";
  return ratio >= 0.7 ? "mid" : "low";
}

/**
 * Texto del chip: «12/20» (o «12» si el espacio no tiene capacidad) y, si hay pendientes, « +2».
 * Corto a propósito: en un carril angosto, «· 2 pend.» se partía en tres líneas.
 */
export function occupancyLabel(
  o: NonNullable<CalendarItem["occupancy"]>,
): string {
  const base = o.capacity ? `${o.approved}/${o.capacity}` : `${o.approved}`;
  return o.pending > 0 ? `${base} +${o.pending}` : base;
}
