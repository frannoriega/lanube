import { nowMs } from "@/lib/clock";
import { SPOT_HOLDING_STATUSES } from "@/lib/constants/participants";
import { toRawReservation } from "@/lib/db/events";
import { formSchema } from "@/lib/db/participants";
import type { EventOccurrence } from "@/lib/events/occurrences";
import { expandAllEventOccurrences } from "@/lib/events/occurrences";
import {
  attendanceBySession,
  type ChoiceDistribution,
  choiceDistributions,
  countSessions,
  type CurvePoint,
  percent,
  registrationCurve,
  type SessionAttendance,
  type SessionCounts,
} from "@/lib/events/report-stats";
import { prisma } from "@/lib/prisma";
import { ParticipantSource, ParticipantStatus } from "@/types/prisma";

/**
 * Reportes de eventos (milestone 31): el bloque «Eventos» de `/admin/reports` (por período) y
 * la página de un evento (`/admin/reports/events/[id]`, toda su vida). Ver
 * `docs/milestones/milestones-31-event-reports.md`.
 *
 * **Por qué no `reservation_occurrences()`** (que usan las reservas): devuelve el horario
 * efectivo de cada ocurrencia pero no su inicio **nominal** — la clave de los check-ins — ni
 * las sesiones canceladas, que este reporte cuenta. Las sesiones se expanden con
 * `expandAllEventOccurrences`, que aplica la misma regla que el SQL
 * (`effective_occurrence_window`: la excepción más nueva por fecha UTC) y es la que usan la
 * agenda pública y el check-in.
 *
 * Los eventos cancelados (`deletedAt`) no entran: cancelar un evento borra sus reservas, así
 * que no le quedan sesiones que contar.
 */

const DAY_MS = 86_400_000;

/** Una fila de la tabla de eventos del período. */
export interface EventReportRow {
  id: string;
  name: string;
  typeName: string;
  spaceName: string;
  sessions: SessionCounts;
  /** Cupo efectivo (el del evento o, si no tiene, el del espacio); `null` = sin cupo. */
  capacity: number | null;
  /** Inscripciones que ocupan lugar hoy (pendientes + aprobadas, incluye sin inscripción). */
  holding: number;
  occupancyPct: number | null;
  /** Personas registradas en la puerta sin inscripción (de toda la vida del evento). */
  walkIns: number;
  checkInEnabled: boolean;
  /** Ingresos registrados a sesiones del período. */
  checkIns: { registered: number; walkIns: number };
  /**
   * Promedio, sobre las sesiones realizadas del período, de inscriptos que ingresaron ÷
   * inscriptos aprobados. `null` sin check-in o sin sesiones realizadas.
   */
  attendancePct: number | null;
}

/** El bloque «Eventos» de un reporte por período. */
export interface EventsReport {
  period: { from: number; to: number };
  totals: {
    /** Eventos con al menos una sesión (de cualquier estado) en el período. */
    events: number;
    sessions: SessionCounts;
    /** Inscripciones recibidas por el formulario en el período, por estado actual. */
    registrations: Record<ParticipantStatus, number> & { total: number };
    /** Registradas en la puerta sin inscripción, en el período. */
    walkIns: number;
    /** De las inscripciones del período: con cuenta en La Nube, y cuántas la crearon después. */
    withAccount: number;
    accountAfter: number;
    /** Eventos con aprobación manual: aprobadas ÷ (aprobadas + rechazadas) del período. */
    approvalPct: number | null;
    /** Canceladas por la propia persona ÷ inscripciones del período. */
    selfCancelPct: number | null;
    /** Promedio de ocupación de los eventos con cupo. */
    avgOccupancyPct: number | null;
    checkIns: { registered: number; walkIns: number };
    /** Promedio de `attendancePct` de los eventos que lo tienen. */
    avgAttendancePct: number | null;
    /** Personas (por email) inscriptas en más de uno de los eventos del período. */
    returning: number;
  };
  byType: { typeName: string; events: number; sessions: number }[];
  bySpace: { spaceName: string; events: number; hours: number }[];
  events: EventReportRow[];
}

type EventRow = Awaited<ReturnType<typeof loadEvents>>[number];

function loadEvents(where: { id?: string; overlap?: [number, number] }) {
  return prisma.event.findMany({
    where: {
      deletedAt: null,
      ...(where.id ? { id: where.id } : {}),
      ...(where.overlap
        ? {
            // Poda gruesa: el evento empezó antes del fin del período y su última sesión es
            // posterior al inicio (con un margen de 31 días por una sesión reprogramada).
            startTime: { lte: BigInt(where.overlap[1]) },
            OR: [
              {
                recurrenceEnd: {
                  gte: BigInt(where.overlap[0] - 31 * DAY_MS),
                },
              },
              {
                recurrenceEnd: null,
                endTime: { gte: BigInt(where.overlap[0] - 31 * DAY_MS) },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      eventType: true,
      capacity: true,
      requiresApproval: true,
      checkInEnabled: true,
      startTime: true,
      endTime: true,
      recurrenceEnd: true,
      status: true,
      type: { select: { name: true } },
      space: { select: { name: true, capacity: true } },
      form: {
        select: {
          opensAt: true,
          closesAt: true,
          form: {
            select: {
              schema: true,
              fields: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });
}

async function loadOccurrences(
  eventIds: string[],
): Promise<Map<string, EventOccurrence[]>> {
  const reservations = await prisma.reservation.findMany({
    where: { reservableType: "EVENT", reservableId: { in: eventIds } },
    include: { exceptions: true },
  });
  const out = new Map<string, EventOccurrence[]>();
  for (const id of eventIds) {
    out.set(
      id,
      expandAllEventOccurrences(
        reservations.filter((r) => r.reservableId === id).map(toRawReservation),
      ),
    );
  }
  return out;
}

function loadParticipants(eventIds: string[]) {
  return prisma.eventParticipant.findMany({
    where: { eventId: { in: eventIds } },
    select: {
      id: true,
      eventId: true,
      email: true,
      status: true,
      source: true,
      createdAt: true,
      userId: true,
      answers: true,
      registeredUser: { select: { createdAt: true } },
    },
  });
}

type ParticipantRow = Awaited<ReturnType<typeof loadParticipants>>[number];

function loadCheckIns(eventIds: string[], range?: [number, number]) {
  return prisma.eventCheckIn.findMany({
    where: {
      eventId: { in: eventIds },
      ...(range
        ? {
            occurrenceStart: {
              gte: BigInt(range[0]),
              lte: BigInt(range[1]),
            },
          }
        : {}),
    },
    select: {
      eventId: true,
      occurrenceStart: true,
      participant: { select: { source: true } },
    },
  });
}

type CheckInRowDb = Awaited<ReturnType<typeof loadCheckIns>>[number];

const effectiveCapacity = (e: EventRow) =>
  e.capacity ?? e.space.capacity ?? null;

const isWalkIn = (p: { source: string }) =>
  p.source === ParticipantSource.WALK_IN;

/**
 * Promedio, sobre las sesiones realizadas, de inscriptos que ingresaron ÷ inscriptos
 * aprobados hoy. Se usa el aprobado **de hoy** (no hay historia de estados): es una
 * aproximación, dicha en la pantalla.
 */
function attendancePct(
  rows: SessionAttendance[],
  approvedRegistered: number,
): number | null {
  if (rows.length === 0 || approvedRegistered === 0) return null;
  const avg =
    rows.reduce((acc, r) => acc + r.registered / approvedRegistered, 0) /
    rows.length;
  return Math.round(avg * 100);
}

function toCheckInRows(rows: CheckInRowDb[]) {
  return rows.map((c) => ({
    occurrenceStart: Number(c.occurrenceStart),
    walkIn: isWalkIn(c.participant),
  }));
}

/** El bloque «Eventos» de `/admin/reports` para `[fromMs, toMs]`. */
export async function getEventsReport(
  fromMs: number,
  toMs: number,
): Promise<EventsReport> {
  const now = nowMs();
  const candidates = await loadEvents({ overlap: [fromMs, toMs] });
  const ids = candidates.map((e) => e.id);
  const [occByEvent, participants, checkIns] = await Promise.all([
    loadOccurrences(ids),
    loadParticipants(ids),
    loadCheckIns(ids, [fromMs, toMs]),
  ]);

  const rows: EventReportRow[] = [];
  const active: EventRow[] = [];
  const byType = new Map<string, { events: number; sessions: number }>();
  const bySpace = new Map<string, { events: number; minutes: number }>();

  for (const e of candidates) {
    const occ = occByEvent.get(e.id) ?? [];
    const sessions = countSessions(occ, fromMs, toMs, now);
    const eCheckIns = checkIns.filter((c) => c.eventId === e.id);
    if (
      sessions.held + sessions.upcoming + sessions.cancelled === 0 &&
      eCheckIns.length === 0
    )
      continue;
    active.push(e);

    const ps = participants.filter((p) => p.eventId === e.id);
    const holding = ps.filter((p) =>
      SPOT_HOLDING_STATUSES.includes(p.status as ParticipantStatus),
    ).length;
    const approvedRegistered = ps.filter(
      (p) => !isWalkIn(p) && p.status === ParticipantStatus.APPROVED,
    ).length;
    const capacity = effectiveCapacity(e);
    const attendance = attendanceBySession(
      occ.filter((o) => o.startMs >= fromMs && o.startMs <= toMs),
      toCheckInRows(eCheckIns),
      now,
    ).filter((r) => r.endMs <= now || r.registered + r.walkIns > 0);

    rows.push({
      id: e.id,
      name: e.name,
      typeName: e.type.name,
      spaceName: e.space.name,
      sessions,
      capacity,
      holding,
      occupancyPct: capacity ? percent(holding, capacity) : null,
      walkIns: ps.filter(isWalkIn).length,
      checkInEnabled: e.checkInEnabled,
      checkIns: {
        registered: eCheckIns.filter((c) => !isWalkIn(c.participant)).length,
        walkIns: eCheckIns.filter((c) => isWalkIn(c.participant)).length,
      },
      attendancePct:
        e.checkInEnabled || eCheckIns.length > 0
          ? attendancePct(attendance, approvedRegistered)
          : null,
    });

    const sessionsInPeriod = sessions.held + sessions.upcoming;
    const t = byType.get(e.type.name) ?? { events: 0, sessions: 0 };
    t.events++;
    t.sessions += sessionsInPeriod;
    byType.set(e.type.name, t);
    const s = bySpace.get(e.space.name) ?? { events: 0, minutes: 0 };
    s.events++;
    for (const o of occ) {
      if (o.status === "cancelled" || o.startMs < fromMs || o.startMs > toMs)
        continue;
      s.minutes += (o.endMs - o.startMs) / 60_000;
    }
    bySpace.set(e.space.name, s);
  }

  const activeIds = new Set(active.map((e) => e.id));
  const requiresApproval = new Set(
    active.filter((e) => e.requiresApproval).map((e) => e.id),
  );
  const inPeriod = (p: ParticipantRow) =>
    activeIds.has(p.eventId) &&
    Number(p.createdAt) >= fromMs &&
    Number(p.createdAt) <= toMs;
  const registrations = participants.filter((p) => inPeriod(p) && !isWalkIn(p));
  const byStatus = {
    [ParticipantStatus.PENDING]: 0,
    [ParticipantStatus.APPROVED]: 0,
    [ParticipantStatus.REJECTED]: 0,
    [ParticipantStatus.CANCELLED]: 0,
  };
  for (const p of registrations) byStatus[p.status as ParticipantStatus]++;
  const decided = registrations.filter(
    (p) =>
      requiresApproval.has(p.eventId) &&
      (p.status === ParticipantStatus.APPROVED ||
        p.status === ParticipantStatus.REJECTED),
  );

  // Personas que vuelven: emails inscriptos (por formulario o en la puerta) en 2+ eventos
  // del período, contando cualquier estado salvo cancelada.
  const eventsByEmail = new Map<string, Set<string>>();
  for (const p of participants) {
    if (!activeIds.has(p.eventId) || p.status === ParticipantStatus.CANCELLED)
      continue;
    const set = eventsByEmail.get(p.email) ?? new Set<string>();
    set.add(p.eventId);
    eventsByEmail.set(p.email, set);
  }

  const occupancies = rows
    .map((r) => r.occupancyPct)
    .filter((v): v is number => v != null);
  const attendances = rows
    .map((r) => r.attendancePct)
    .filter((v): v is number => v != null);
  const mean = (xs: number[]) =>
    xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;

  return {
    period: { from: fromMs, to: toMs },
    totals: {
      events: rows.length,
      sessions: rows.reduce(
        (acc, r) => ({
          held: acc.held + r.sessions.held,
          upcoming: acc.upcoming + r.sessions.upcoming,
          cancelled: acc.cancelled + r.sessions.cancelled,
        }),
        { held: 0, upcoming: 0, cancelled: 0 },
      ),
      registrations: { ...byStatus, total: registrations.length },
      walkIns: participants.filter((p) => inPeriod(p) && isWalkIn(p)).length,
      withAccount: registrations.filter((p) => p.userId != null).length,
      accountAfter: registrations.filter(
        (p) =>
          p.registeredUser != null &&
          Number(p.registeredUser.createdAt) > Number(p.createdAt),
      ).length,
      approvalPct: percent(
        decided.filter((p) => p.status === ParticipantStatus.APPROVED).length,
        decided.length,
      ),
      selfCancelPct: percent(
        byStatus[ParticipantStatus.CANCELLED],
        registrations.length,
      ),
      avgOccupancyPct: mean(occupancies),
      checkIns: rows.reduce(
        (acc, r) => ({
          registered: acc.registered + r.checkIns.registered,
          walkIns: acc.walkIns + r.checkIns.walkIns,
        }),
        { registered: 0, walkIns: 0 },
      ),
      avgAttendancePct: mean(attendances),
      returning: [...eventsByEmail.values()].filter((s) => s.size > 1).length,
    },
    byType: [...byType.entries()]
      .map(([typeName, v]) => ({ typeName, ...v }))
      .sort((a, b) => b.sessions - a.sessions),
    bySpace: [...bySpace.entries()]
      .map(([spaceName, v]) => ({
        spaceName,
        events: v.events,
        hours: Math.round((v.minutes / 60) * 10) / 10,
      }))
      .sort((a, b) => b.hours - a.hours),
    events: rows,
  };
}

/** La página de un evento: toda su vida, no un período. */
export interface EventReport {
  id: string;
  name: string;
  typeName: string;
  spaceName: string;
  status: string;
  firstMs: number;
  lastMs: number;
  checkInEnabled: boolean;
  requiresApproval: boolean;
  sessions: SessionCounts;
  capacity: number | null;
  holding: number;
  occupancyPct: number | null;
  /** Inscripciones por el formulario, por estado actual. */
  byStatus: Record<ParticipantStatus, number>;
  walkIns: number;
  /** Inscriptos por el formulario hoy aprobados: la referencia del gráfico de asistencia. */
  approvedRegistered: number;
  withAccount: number;
  accountAfter: number;
  /** Ventana de inscripción, si tiene formulario. */
  registrationWindow: { opensAt: number; closesAt: number } | null;
  curve: CurvePoint[];
  attendance: SessionAttendance[];
  attendancePct: number | null;
  choices: ChoiceDistribution[];
}

export async function getEventReport(
  eventId: string,
): Promise<EventReport | null> {
  const [e] = await loadEvents({ id: eventId });
  if (!e) return null;
  const now = nowMs();
  const [occByEvent, participants, checkIns] = await Promise.all([
    loadOccurrences([e.id]),
    loadParticipants([e.id]),
    loadCheckIns([e.id]),
  ]);
  const occ = occByEvent.get(e.id) ?? [];
  const registered = participants.filter((p) => !isWalkIn(p));
  const byStatus = {
    [ParticipantStatus.PENDING]: 0,
    [ParticipantStatus.APPROVED]: 0,
    [ParticipantStatus.REJECTED]: 0,
    [ParticipantStatus.CANCELLED]: 0,
  };
  for (const p of registered) byStatus[p.status as ParticipantStatus]++;
  const holdingRows = participants.filter((p) =>
    SPOT_HOLDING_STATUSES.includes(p.status as ParticipantStatus),
  );
  const capacity = effectiveCapacity(e);
  const approvedRegistered = byStatus[ParticipantStatus.APPROVED];
  const attendance = attendanceBySession(occ, toCheckInRows(checkIns), now);
  const schema = e.form ? formSchema(e.form.form) : null;

  return {
    id: e.id,
    name: e.name,
    typeName: e.type.name,
    spaceName: e.space.name,
    status: e.status,
    firstMs: Number(e.startTime),
    lastMs: Number(e.recurrenceEnd ?? e.endTime),
    checkInEnabled: e.checkInEnabled,
    requiresApproval: e.requiresApproval,
    sessions: countSessions(occ, 0, Number.MAX_SAFE_INTEGER, now),
    capacity,
    holding: holdingRows.length,
    occupancyPct: capacity ? percent(holdingRows.length, capacity) : null,
    byStatus,
    walkIns: participants.filter(isWalkIn).length,
    approvedRegistered,
    withAccount: registered.filter((p) => p.userId != null).length,
    accountAfter: registered.filter(
      (p) =>
        p.registeredUser != null &&
        Number(p.registeredUser.createdAt) > Number(p.createdAt),
    ).length,
    registrationWindow: e.form
      ? { opensAt: Number(e.form.opensAt), closesAt: Number(e.form.closesAt) }
      : null,
    curve: registrationCurve(registered.map((p) => Number(p.createdAt))),
    attendance,
    attendancePct:
      e.checkInEnabled || checkIns.length > 0
        ? attendancePct(
            attendance.filter((r) => r.endMs <= now),
            approvedRegistered,
          )
        : null,
    // Las respuestas de quienes ocupan lugar (pendientes y aprobados, con o sin inscripción).
    choices: choiceDistributions(
      schema,
      holdingRows.map((p) => p.answers),
    ),
  };
}
