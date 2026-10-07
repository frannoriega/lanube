import { AdminReservationListResult } from "@/components/templates/admin/dashboard-recent-reservations";
import {
  ADMIN_TIMEZONE,
  dateKeyFromUnixMs,
  enumerateDateKeysInclusive,
} from "@/lib/admin/admin-timezone";
import { DomainError } from "@/lib/errors";
import { formatRange } from "@/lib/notifications/render/format";
import { prisma } from "@/lib/prisma";
import {
  classifyConflict,
  mergeWindows,
  type ApprovalConflict,
  type ApprovalPreview,
} from "@/lib/reservations/approval-conflicts";
import { Prisma } from "@/generated/prisma/client";
import { ReservationStatus } from "@/generated/prisma/client";

const MAX_PAGE_SIZE = 100;
const RANGE_FETCH_MAX = 3000;

/**
 * Las reservas de un evento (`reservableType = EVENT`) **no** se gestionan desde la gestión de
 * reservas: nacen `APPROVED` con el evento y se modifican con las herramientas de eventos
 * (editar, cancelar o reprogramar sesiones). Listarlas acá mezclaba filas sin dueño con las
 * reservas de personas, inflaba los contadores y dejaba cancelar a mano una reserva que el
 * evento sigue dando por hecha. Todo `where` de una vista de gestión de reservas la incluye.
 * Los reportes de uso, en cambio, siguen contando los eventos.
 */
export const EXCLUDE_EVENT_RESERVATIONS = {
  reservableType: { not: "EVENT" },
} satisfies Prisma.ReservationWhereInput;

/** Default forward window length for admin reservation views (days, inclusive of today). */
export const ADMIN_RESERVATION_FORWARD_DAYS = 14;

type ReservationAdminRow = Prisma.ReservationGetPayload<{
  include: {
    space: true;
    registeredUser: {
      select: {
        name: true;
        lastName: true;
        dni: true;
        institution: true;
        user: { select: { email: true; displayEmail: true } };
      };
    };
  };
}>;

/**
 * Cuántas personas representa cada reserva (`actor_size` del ledger), para la columna del panel.
 *
 * Antes traía **todas** las filas del ledger de las reservas listadas — una por bucket de 15 min
 * de cada ocurrencia: una recurrente semanal de 2 h suma 8 por semana hacia adelante, y las vistas
 * por rango listan hasta 3000 reservas — y después, por cada reserva, recorría ese array completo
 * con `find`/`filter`: O(reservas × filas) en memoria (milestone 25, DB3). `actor_size` se
 * calcula por reserva (`get_actor_size`), así que alcanza con una fila: `DISTINCT ON` elige en la
 * base el bucket más temprano, usando el índice por `reservation_id` — lo mismo que hacía antes
 * (preferir la primera ocurrencia), por si una reconstrucción hacia adelante recalculó los
 * buckets futuros con otro tamaño de equipo.
 * Una reserva sin ledger (rechazada antes de materializarse) representa a 1 persona.
 */
async function actorSizeByReservationId(
  reservations: { id: string }[],
): Promise<Map<string, number>> {
  if (reservations.length === 0) return new Map();
  const ids = [...new Set(reservations.map((r) => r.id))];
  const rows = await prisma.$queryRaw<
    { reservation_id: string; actor_size: number }[]
  >`
    SELECT DISTINCT ON (reservation_id) reservation_id, actor_size
    FROM reservation_ledger
    WHERE reservation_id = ANY(${ids}::text[])
    ORDER BY reservation_id, occurrence_start_time
  `;
  const sizes = new Map(
    rows.map((r) => [r.reservation_id, Number(r.actor_size)]),
  );
  return new Map(ids.map((id) => [id, sizes.get(id) ?? 1]));
}

function toAdminReservationListResult(
  row: ReservationAdminRow,
  actorSize: number,
): AdminReservationListResult {
  return {
    id: row.id,
    startTime: Number(row.startTime),
    endTime: Number(row.endTime),
    reason: row.reason,
    status: row.status,
    createdAt: Number(row.createdAt),
    deniedReason: row.deniedReason,
    actorSize,
    assistantName:
      row.origin === "ASSISTANT" ? (row.originClientName ?? "Asistente") : null,
    resource: {
      id: row.space?.id ?? "",
      name: row.space?.name ?? "",
      capacity: row.space?.capacity ?? 1,
      isExclusive: row.space?.isExclusive ?? false,
      spaceName: row.space?.name ?? "",
    },
    registeredUser: row.registeredUser,
  };
}

async function mapRowsToAdminResults(
  rows: ReservationAdminRow[],
): Promise<AdminReservationListResult[]> {
  const sizes = await actorSizeByReservationId(rows);
  return rows.map((r) => toAdminReservationListResult(r, sizes.get(r.id) ?? 1));
}

/**
 * Traduce las fallas de precondición de `approve_reservation()` (milestone-12 D3) a mensajes
 * seguros para el usuario. La función se niega a promover una reserva que ya no entra en el
 * espacio tal como está ahora — el lugar puede haberse ocupado entre la creación y la
 * aprobación (un evento nuevo, otra aprobación, una capacidad reducida), y antes de que
 * existiera la precondición aprobar simplemente fabricaba un sobrecupo.
 */
function translateApprovalError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message.includes("Approval conflict: space taken")) {
      throw new DomainError(
        "El espacio ya está ocupado en ese horario — la reserva no puede aprobarse",
        409,
      );
    }
    if (error.message.includes("Approval conflict: capacity exceeded")) {
      throw new DomainError(
        "No queda capacidad en el espacio para ese horario — la reserva no puede aprobarse",
        409,
      );
    }
    if (error.message.includes("Approval conflict: actor already approved")) {
      throw new DomainError(
        "Quien reserva ya tiene una reserva aprobada en otro espacio en ese horario",
        409,
      );
    }
  }
  throw error;
}

/**
 * Approves a reservation and lets `approve_reservation()` reject whatever it conflicts
 * with — one admin click can cascade into rejecting other people's reservations.
 *
 * The SQL function has always RETURNED those ids (`auto_rejected_ids`, a comma-separated
 * text column), but this helper called it through `$executeRaw`, which yields a row count
 * and discards the result set — so the cascade was invisible to the app and the audit
 * trail had nothing to attribute. `$queryRaw` reads them properly.
 *
 * Desde la slice B del milestone-12 la función además rechaza la aprobación de plano cuando
 * la reserva ya no entra — ver {@link translateApprovalError}.
 */
export async function approveReservationAndRejectConflicts(
  id: string,
): Promise<{ approvedId: string; autoRejectedIds: string[] }> {
  const rows = await prisma.$queryRaw<
    Array<{ approved_id: string | null; auto_rejected_ids: string | null }>
  >`SELECT * FROM approve_reservation(${id}::text)`.catch(
    translateApprovalError,
  );

  const raw = rows[0]?.auto_rejected_ids ?? "";
  const autoRejectedIds = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value !== id);

  return { approvedId: rows[0]?.approved_id ?? id, autoRejectedIds };
}

/**
 * Las reservas que aprobar `id` rechazaría automáticamente, sin aprobar nada.
 *
 * Era un stub que devolvía `[]` (con el id de la reserva comentado en su único call site), así
 * que la pantalla de confirmación del admin siempre decía "esto no afecta a nadie" y después
 * la aprobación rechazaba reservas de otras personas y les mandaba mail (milestone-12 D15).
 *
 * `preview_approval_conflicts()` replica en solo lectura los dos loops de cascada de
 * `approve_reservation()`, con el mismo chequeo de capacidad `peak_space_usage` que usa el
 * camino de escritura. Las dos viven contiguas en
 * `20260924150000_actor_size_and_approval_preview` a propósito: la falla que hay que evitar es
 * que la vista previa y la acción se separen.
 */
export async function previewConflictingPending(id: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ reservation_id: string }[]>`
    SELECT reservation_id FROM preview_approval_conflicts(${id}::text)
  `;
  return [...new Set(rows.map((r) => r.reservation_id))].filter(
    (value) => value !== id,
  );
}

/**
 * Vista previa de aprobación con el detalle de cada reserva que se rechazaría, para que el
 * admin decida sabiendo a quién afecta (ver `src/lib/reservations/approval-conflicts.ts`).
 *
 * Los ids salen de {@link previewConflictingPending} (la misma lógica que la aprobación real);
 * esta función solo los enriquece:
 * - datos de la reserva y de quien la pidió (nombre, correo, institución, motivo, cuándo);
 * - las franjas exactas en que choca con la reserva a aprobar, leídas del ledger y unidas con
 *   `mergeWindows` (el ledger está en buckets de 15 min; en una recurrente hay una franja por
 *   fecha que choca);
 * - el motivo del rechazo (`classifyConflict`) y las personas que representa.
 */
export async function getApprovalPreview(id: string): Promise<ApprovalPreview> {
  const autoRejectedIds = await previewConflictingPending(id);

  const target = await prisma.reservation.findUnique({
    where: { id },
    select: {
      spaceId: true,
      space: { select: { name: true, capacity: true, isExclusive: true } },
    },
  });
  const space = target?.space ?? null;

  if (autoRejectedIds.length === 0) {
    return { autoRejectedIds, conflicts: [], space };
  }

  const [rows, overlapBuckets] = await Promise.all([
    prisma.reservation.findMany({
      where: { id: { in: autoRejectedIds } },
      select: {
        id: true,
        reservableType: true,
        spaceId: true,
        reason: true,
        isRecurring: true,
        createdAt: true,
        space: { select: { name: true } },
        type: { select: { name: true } },
        registeredUser: {
          select: {
            name: true,
            lastName: true,
            institution: true,
            user: { select: { email: true, displayEmail: true } },
          },
        },
      },
    }),
    // Buckets de cada reserva afectada que se pisan con algún bucket de la que se aprueba
    // (mismo criterio de superposición que `preview_approval_conflicts()`).
    prisma.$queryRaw<
      {
        reservation_id: string;
        start: bigint;
        end: bigint;
        actor_size: number;
      }[]
    >`
      SELECT rl.reservation_id,
             rl.occurrence_start_time AS start,
             rl.occurrence_end_time   AS "end",
             rl.actor_size
      FROM reservation_ledger rl
      WHERE rl.reservation_id = ANY(${autoRejectedIds}::text[])
        AND rl.status = 'PENDING'
        AND EXISTS (
          SELECT 1 FROM reservation_ledger a
          WHERE a.reservation_id = ${id}::text
            AND rl.occurrence_start_time < a.occurrence_end_time
            AND rl.occurrence_end_time   > a.occurrence_start_time
        )
    `,
  ]);

  const conflicts: ApprovalConflict[] = rows.map((row) => {
    const buckets = overlapBuckets.filter((b) => b.reservation_id === row.id);
    const isUser = row.reservableType === "USER" && row.registeredUser;
    return {
      id: row.id,
      kind: classifyConflict(row.spaceId, {
        spaceId: target?.spaceId ?? null,
        isExclusive: space?.isExclusive ?? false,
      }),
      ownerName: isUser
        ? `${row.registeredUser.name} ${row.registeredUser.lastName}`.trim()
        : null,
      email: isUser
        ? (row.registeredUser.user.displayEmail ??
          row.registeredUser.user.email)
        : null,
      institution: isUser ? row.registeredUser.institution : null,
      spaceName: row.space?.name ?? null,
      reservationTypeName: row.type.name,
      reason: row.reason,
      // Una reserva afectada siempre tiene buckets superpuestos (por eso se rechaza).
      actorSize: Math.max(1, ...buckets.map((b) => Number(b.actor_size))),
      isRecurring: row.isRecurring,
      createdAt: Number(row.createdAt),
      overlaps: mergeWindows(
        buckets.map((b) => ({ start: Number(b.start), end: Number(b.end) })),
      ),
    };
  });

  // Primero lo que choca antes: es el orden en que el admin lee el calendario.
  conflicts.sort(
    (a, b) => (a.overlaps[0]?.start ?? 0) - (b.overlaps[0]?.start ?? 0),
  );

  return { autoRejectedIds, conflicts, space };
}

/**
 * Cambia el estado de una reserva (rechazar / cancelar — aprobar pasa por
 * `approveReservationAndRejectConflicts`).
 *
 * Las filas correspondientes de `reservation_ledger` las actualiza el trigger
 * `sync_reservation_ledger_status` (migración `20260924100000_ledger_integrity`), **no** esta
 * función. No agregar una escritura manual al ledger: el trigger cubre a todos los writers, y
 * antes de que existiera esta función dejaba en APPROVED las filas del ledger de una reserva
 * cancelada, así que el espacio quedaba ocupado para siempre (milestone-12 D1).
 */
export async function setReservationStatus(
  id: string,
  status: ReservationStatus,
  deniedReason?: string,
) {
  return prisma.reservation.update({
    where: { id },
    data: {
      status,
      ...(deniedReason ? { deniedReason } : {}),
    },
  });
}

/**
 * Everything `notify()` and the audit trail need to describe a reservation decision — who
 * it was for, what, and when. Shared because both answer the exact same underlying
 * question ("which reservation is this?") for two different readers (the owner, an admin
 * reading the log).
 */
export interface ReservationNotificationContext {
  id: string;
  reservableType: string;
  reservableId: string;
  spaceName: string | null;
  reservationTypeName: string;
  startTime: number;
  endTime: number;
  deniedReason: string | null;
  /** Null for a TEAM/ORG/EVENT reservation — there's no one person to name. */
  ownerName: string | null;
}

/**
 * Reads back just enough of a reservation to build a `reservation.approved`/`.rejected`
 * event, or an audit-log `context`. Only `reservableType === "USER"` gets `ownerName` (and
 * a notification recipient) — a TEAM/ORG/EVENT reservation has no one owner (see the
 * milestone doc).
 */
export async function getReservationNotificationContext(
  id: string,
): Promise<ReservationNotificationContext | null> {
  const row = await prisma.reservation.findUnique({
    where: { id },
    select: {
      id: true,
      reservableType: true,
      reservableId: true,
      startTime: true,
      endTime: true,
      deniedReason: true,
      space: { select: { name: true } },
      type: { select: { name: true } },
      registeredUser: { select: { name: true, lastName: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    reservableType: row.reservableType,
    reservableId: row.reservableId,
    spaceName: row.space?.name ?? null,
    reservationTypeName: row.type.name,
    startTime: Number(row.startTime),
    endTime: Number(row.endTime),
    deniedReason: row.deniedReason,
    ownerName:
      row.reservableType === "USER" && row.registeredUser
        ? `${row.registeredUser.name} ${row.registeredUser.lastName}`.trim()
        : null,
  };
}

/** `{ "Espacio": "Sala A", "Horario": "…", "Reservado por": "…" }` for the audit log. */
export function buildReservationAuditContext(
  context: ReservationNotificationContext,
): Record<string, string> {
  const result: Record<string, string> = {
    [context.spaceName ? "Espacio" : "Tipo de reserva"]:
      context.spaceName ?? context.reservationTypeName,
    Horario: formatRange(context.startTime, context.endTime),
  };
  if (context.ownerName) result["Reservado por"] = context.ownerName;
  return result;
}

export interface ListAdminReservationsOptions {
  startMs?: number;
  endMs?: number;
  status?: ReservationStatus;
  page?: number;
  pageSize?: number;
}

export interface ListAdminReservationsResult {
  items: AdminReservationListResult[];
  total: number;
}

const reservationAdminInclude = {
  space: true,
  registeredUser: {
    select: {
      name: true,
      lastName: true,
      dni: true,
      institution: true,
      user: { select: { email: true, displayEmail: true } },
    },
  },
} as const;

/**
 * Una ocurrencia de reserva dentro de un rango (milestone 25, C3). Los listados por rango
 * muestran **ocurrencias**, no series: una reserva semanal aparece en cada semana del rango, con
 * el horario de esa ocurrencia (o el reprogramado, si tiene excepción). El `id` sigue siendo el de
 * la reserva: aprobar o rechazar desde una ocurrencia decide la serie entera, como siempre.
 */
type OccurrenceRef = {
  reservation_id: string;
  occurrence_start_time: bigint;
  occurrence_end_time: bigint;
};

interface OccurrenceFilter {
  spaceId?: string;
  status?: ReservationStatus;
}

/**
 * Las ocurrencias de reservas de personas (sin eventos: `EXCLUDE_EVENT_RESERVATIONS`) cuyo
 * inicio cae en [startMs, endMs], en orden cronológico, paginadas en la base (el total para la
 * paginación lo da `countOccurrences`).
 */
async function listOccurrenceRefs(
  startMs: number,
  endMs: number,
  filter: OccurrenceFilter,
  page: { limit: number; offset: number },
): Promise<OccurrenceRef[]> {
  return prisma.$queryRaw<OccurrenceRef[]>`
    SELECT o.reservation_id, o.occurrence_start_time, o.occurrence_end_time
    FROM reservation_occurrences(
      ${BigInt(startMs)}, ${BigInt(endMs)}, NULL, NULL, ${filter.spaceId ?? null}::text
    ) o
    JOIN reservations r ON r.id = o.reservation_id
    WHERE r.reservable_type <> 'EVENT'
      AND (${filter.status ?? null}::text IS NULL
           OR r.status::text = ${filter.status ?? null}::text)
    ORDER BY o.occurrence_start_time, o.reservation_id
    LIMIT ${page.limit} OFFSET ${page.offset}`;
}

/** Total de ocurrencias que devolvería `listOccurrenceRefs` sin paginar. */
async function countOccurrences(
  startMs: number,
  endMs: number,
  filter: OccurrenceFilter,
): Promise<number> {
  const [row] = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(*)::int AS total
    FROM reservation_occurrences(
      ${BigInt(startMs)}, ${BigInt(endMs)}, NULL, NULL, ${filter.spaceId ?? null}::text
    ) o
    JOIN reservations r ON r.id = o.reservation_id
    WHERE r.reservable_type <> 'EVENT'
      AND (${filter.status ?? null}::text IS NULL
           OR r.status::text = ${filter.status ?? null}::text)`;
  return row?.total ?? 0;
}

/**
 * Arma las filas del panel para una lista de ocurrencias: carga cada reserva una sola vez y
 * repite su fila por ocurrencia, con el horario de la ocurrencia.
 */
async function occurrencesToAdminResults(
  refs: OccurrenceRef[],
): Promise<AdminReservationListResult[]> {
  if (refs.length === 0) return [];
  const ids = [...new Set(refs.map((r) => r.reservation_id))];
  const rows = await prisma.reservation.findMany({
    where: { id: { in: ids } },
    include: reservationAdminInclude,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const sizes = await actorSizeByReservationId(rows);
  return refs.flatMap((ref) => {
    const row = byId.get(ref.reservation_id);
    if (!row) return [];
    return [
      {
        ...toAdminReservationListResult(row, sizes.get(row.id) ?? 1),
        startTime: Number(ref.occurrence_start_time),
        endTime: Number(ref.occurrence_end_time),
      },
    ];
  });
}

/** Ocurrencias por día (fecha en la hora del predio), contadas en la base (milestone 25, DB6). */
async function occurrenceCountsByDay(
  startMs: number,
  endMs: number,
  filter: OccurrenceFilter,
): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ day: string; count: number }[]>`
    SELECT to_char(to_timestamp(o.occurrence_start_time / 1000.0) AT TIME ZONE ${ADMIN_TIMEZONE},
                   'YYYY-MM-DD') AS day,
           COUNT(*)::int AS count
    FROM reservation_occurrences(
      ${BigInt(startMs)}, ${BigInt(endMs)}, NULL, NULL, ${filter.spaceId ?? null}::text
    ) o
    JOIN reservations r ON r.id = o.reservation_id
    WHERE r.reservable_type <> 'EVENT'
      AND (${filter.status ?? null}::text IS NULL
           OR r.status::text = ${filter.status ?? null}::text)
    GROUP BY 1`;
  return new Map(rows.map((r) => [r.day, r.count]));
}

export async function listAdminReservationsBySpace(
  spaceId: string,
  options?: ListAdminReservationsOptions,
): Promise<ListAdminReservationsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, options?.pageSize ?? 50),
  );

  // Con rango: ocurrencias del rango (milestone 25, C3). Sin rango: la lista de reservas
  // (series) del espacio, que no tiene período en el que expandirlas.
  if (options?.startMs != null && options?.endMs != null) {
    const filter = { spaceId, status: options.status };
    const [refs, total] = await Promise.all([
      listOccurrenceRefs(options.startMs, options.endMs, filter, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      countOccurrences(options.startMs, options.endMs, filter),
    ]);
    return { items: await occurrencesToAdminResults(refs), total };
  }

  const where: Prisma.ReservationWhereInput = {
    spaceId,
    ...EXCLUDE_EVENT_RESERVATIONS,
  };

  if (options?.status) {
    where.status = options.status;
  }

  const [rows, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: reservationAdminInclude,
      orderBy: { startTime: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.reservation.count({ where }),
  ]);

  const items = await mapRowsToAdminResults(rows);
  return { items, total };
}

/**
 * Todas las ocurrencias de un espacio en [startMs, endMs], de todo estado (hasta
 * `RANGE_FETCH_MAX`). Por ocurrencia desde el milestone 25 (C3).
 */
export async function listAllAdminReservationsInDateRange(
  spaceId: string,
  startMs: number,
  endMs: number,
): Promise<AdminReservationListResult[]> {
  return occurrencesToAdminResults(
    await listOccurrenceRefs(
      startMs,
      endMs,
      { spaceId },
      { limit: RANGE_FETCH_MAX, offset: 0 },
    ),
  );
}

/** Todas las ocurrencias en [startMs, endMs], de todos los espacios (milestone 25, C3). */
export async function listAllAdminReservationsAllServicesInDateRange(
  startMs: number,
  endMs: number,
): Promise<AdminReservationListResult[]> {
  return occurrencesToAdminResults(
    await listOccurrenceRefs(
      startMs,
      endMs,
      {},
      { limit: RANGE_FETCH_MAX, offset: 0 },
    ),
  );
}

export async function listAdminReservationsAllServicesByRange(
  startMs: number,
  endMs: number,
  options?: { status?: ReservationStatus; page?: number; pageSize?: number },
): Promise<ListAdminReservationsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, options?.pageSize ?? 50),
  );

  // Ocurrencias del rango, paginadas en la base (milestone 25, C3).
  const filter = { status: options?.status };
  const [refs, total] = await Promise.all([
    listOccurrenceRefs(startMs, endMs, filter, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    countOccurrences(startMs, endMs, filter),
  ]);
  return { items: await occurrencesToAdminResults(refs), total };
}

export function groupAdminReservationsByDateKey(
  items: AdminReservationListResult[],
  keysInOrder: string[],
): Record<string, AdminReservationListResult[]> {
  const buckets: Record<string, AdminReservationListResult[]> = {};
  for (const k of keysInOrder) {
    buckets[k] = [];
  }
  for (const item of items) {
    const k = dateKeyFromUnixMs(item.startTime);
    if (buckets[k]) {
      buckets[k].push(item);
    }
  }
  return buckets;
}

export interface DayWithReservations {
  date: string;
  count: number;
}

export interface ListDaysWithReservationsOptions {
  page?: number;
  pageSize?: number;
}

export interface ListDaysWithReservationsResult {
  items: DayWithReservations[];
  total: number;
}

/** Per-day reservation counts for a space in [startMs, endMs]. */
export async function listReservationDayCountsInRange(
  spaceId: string,
  status: ReservationStatus | undefined,
  startMs: number,
  endMs: number,
): Promise<ListDaysWithReservationsResult> {
  const fromKey = dateKeyFromUnixMs(startMs);
  const toKey = dateKeyFromUnixMs(endMs);
  const keys = enumerateDateKeysInclusive(fromKey, toKey);

  // Ocurrencias por día, contadas en la base (milestone 25, C3 + DB6).
  const byDay = await occurrenceCountsByDay(startMs, endMs, {
    spaceId,
    status,
  });
  const counts: Record<string, number> = {};
  for (const k of keys) counts[k] = byDay.get(k) ?? 0;

  const items = keys.map((date) => ({ date, count: counts[date] }));
  return { items, total: items.length };
}

export async function listDaysWithPendingReservationsAllServices(
  startMs: number,
  endMs: number,
  options?: ListDaysWithReservationsOptions,
): Promise<ListDaysWithReservationsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, options?.pageSize ?? 50),
  );

  // Días con ocurrencias pendientes, contadas en la base (milestone 25, C3 + DB6).
  const byDay = Object.fromEntries(
    await occurrenceCountsByDay(startMs, endMs, { status: "PENDING" }),
  );

  const allDays = Object.entries(byDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const total = allDays.length;
  const items = allDays.slice((page - 1) * pageSize, page * pageSize);
  return { items, total };
}
