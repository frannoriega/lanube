import "server-only";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { nowMs } from "@/lib/clock";
import {
  getUnavailableSlots,
  getUserNextReservations,
} from "@/lib/db/reservations";
import { listReservationTypes } from "@/lib/db/reservationTypes";
import { getReservableSpaces, getSpaceById } from "@/lib/db/spaces";
import { isDomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { hasScopes, type OAuthScope } from "@/lib/oauth/config";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  cancelUserReservation,
  requestUserReservation,
} from "@/lib/reservations/user-actions";
import { unixMsToDate } from "@/lib/unix-ms";
import type { McpUser } from "./auth";
import { computeFreeWindows, type BusyBlock } from "./availability";
import {
  formatVenueDay,
  formatVenueRange,
  formatVenueTime,
  ISO_FORMAT_HINT,
  parseIsoWithOffset,
  parseVenueDate,
  toVenueDateKey,
  toVenueIso,
} from "./format";

/**
 * Las cinco tools del conector MCP (milestone 20). El pedido fue **pedir** y **cancelar**
 * reservas; las tres de lectura son el soporte mínimo para eso (qué espacios hay, qué está
 * libre, qué reservas tengo y su id para cancelar).
 *
 * El conector actúa como **usuario común sobre sus propias reservas**, aunque la cuenta sea
 * admin: no hay tools de eventos, inscripciones, perfil ni administración.
 *
 * Reglas comunes:
 * - Las reglas de negocio son **el mismo código que la web** (`requestUserReservation` /
 *   `cancelUserReservation`). Un `DomainError` vuelve como resultado con `isError: true` y el
 *   mismo texto en castellano que ve la web, así el asistente puede corregirse solo.
 * - Scope por tool (`reservations:read` / `reservations:write`).
 * - Rate limit por usuario: 60 llamadas de lectura por minuto y 20 escrituras por hora — un
 *   asistente en loop no debe poder llenar el calendario de solicitudes.
 * - Los textos libres (motivo de una reserva) se devuelven como **datos** dentro del JSON,
 *   nunca como instrucciones.
 */

/** Contexto de la request ya autenticada que necesitan las tools. */
export interface McpToolContext {
  /** `null` si la cuenta está bloqueada (perfil, baneo, políticas): ver `blockedMessage`. */
  user: McpUser | null;
  /** Por qué no se puede operar; cada tool lo devuelve como error. */
  blockedMessage: string | null;
  origin: string;
}

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

const READ_LIMIT = { maxAttempts: 60, windowMs: 60_000 };
// Cuentan también los intentos fallidos (formato, horario): 20 deja margen para que el
// asistente se corrija solo sin que la persona quede bloqueada una hora.
const WRITE_LIMIT = { maxAttempts: 20, windowMs: 60 * 60 * 1000 };

/** Máximo rango de días que consulta `get_availability`. */
const MAX_AVAILABILITY_DAYS = 14;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "pendiente de aprobación",
  APPROVED: "aprobada",
  REJECTED: "rechazada",
  CANCELLED: "cancelada",
};

function ok(payload: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Envuelve cada tool con lo común: cuenta bloqueada, scope, rate limit y traducción de
 * errores. Un error inesperado se loguea y sale genérico, sin filtrar detalles internos.
 */
function guarded<A>(
  ctx: McpToolContext,
  name: string,
  scope: OAuthScope,
  fn: (args: A, user: McpUser) => Promise<ToolResult>,
): (args: A) => Promise<ToolResult> {
  return async (args: A) => {
    if (ctx.blockedMessage || !ctx.user)
      return fail(ctx.blockedMessage ?? "Cuenta no habilitada");
    const user = ctx.user;
    if (!hasScopes(user.scopes, [scope]))
      return fail(
        "Esta conexión no tiene permiso para esta acción. Desconectá y volvé a conectar el asistente aceptando todos los permisos.",
      );
    const limit = scope === "reservations:write" ? WRITE_LIMIT : READ_LIMIT;
    const { allowed } = await checkRateLimit(
      `user:${user.registeredUserId}`,
      `/api/mcp:${scope}`,
      limit,
    );
    if (!allowed)
      return fail(
        scope === "reservations:write"
          ? "Demasiadas solicitudes de reserva o cancelaciones en la última hora. Esperá un rato antes de volver a intentar."
          : "Demasiadas consultas seguidas. Esperá un minuto y volvé a intentar.",
      );
    try {
      return await fn(args, user);
    } catch (err) {
      if (isDomainError(err)) return fail(err.message);
      logger.error(`mcp ${name}`, err);
      return fail(
        "Ocurrió un error interno en La Nube. Probá de nuevo en un rato.",
      );
    }
  };
}

export function buildMcpServer(ctx: McpToolContext): McpServer {
  const server = new McpServer(
    { name: "la-nube", title: "La Nube", version: "1.0.0" },
    {
      instructions:
        "Herramientas para las reservas de espacios de La Nube (un espacio de coworking y laboratorio). " +
        "Las fechas de entrada van en ISO 8601 con offset (hora de Argentina, -03:00). " +
        "Las reservas solo se pueden pedir de lunes a viernes de 09:00 a 18:00, en intervalos de 15 minutos y con 24 h de anticipación; " +
        "quedan pendientes hasta que el equipo de La Nube las aprueba. " +
        "Antes de pedir o cancelar una reserva, confirmá con la persona el espacio, el día y el horario.",
    },
  );

  server.registerTool(
    "list_spaces",
    {
      title: "Listar espacios",
      description:
        "Lista los espacios de La Nube que se pueden reservar (id, nombre, descripción, capacidad) y los tipos de reserva válidos para request_reservation, junto con las reglas de horario.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guarded(ctx, "list_spaces", "reservations:read", async () => {
      const [spaces, types] = await Promise.all([
        getReservableSpaces(),
        listReservationTypes(),
      ]);
      return ok({
        spaces: spaces.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          capacity: s.capacity,
          exclusive: s.isExclusive,
          booking_url: `${ctx.origin}/user/spaces/${s.slug}`,
        })),
        reservation_types: types.map((t) => ({ code: t.code, name: t.name })),
        booking_rules:
          "Lunes a viernes de 09:00 a 18:00 (hora de Argentina), en intervalos de 15 minutos, con al menos 24 h de anticipación. Toda reserva queda pendiente de aprobación.",
      });
    }),
  );

  server.registerTool(
    "get_availability",
    {
      title: "Ver horarios libres",
      description: `Devuelve los tramos libres y reservables de un espacio, por día, entre dos fechas (como máximo ${MAX_AVAILABILITY_DAYS} días). Ya descuenta lo ocupado, los fines de semana, el horario de apertura y la anticipación mínima de 24 h.`,
      inputSchema: z.object({
        space_id: z.string().describe("Id del espacio (de list_spaces)"),
        from_date: z
          .string()
          .describe("Primer día a consultar, YYYY-MM-DD (fecha de Argentina)"),
        to_date: z
          .string()
          .optional()
          .describe(
            "Último día a consultar (inclusive), YYYY-MM-DD. Si falta, 7 días desde from_date.",
          ),
        min_duration_minutes: z
          .number()
          .int()
          .min(15)
          .max(540)
          .optional()
          .describe("Omitir tramos más cortos que esto (por defecto 15)"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guarded(
      ctx,
      "get_availability",
      "reservations:read",
      async (args, user) => {
        const space = await getSpaceById(args.space_id);
        if (!space || !space.isReservable) return fail("Espacio no encontrado");
        const fromDayMs = parseVenueDate(args.from_date);
        if (fromDayMs == null)
          return fail("from_date inválida. Usá el formato YYYY-MM-DD.");
        let lastDayMs = fromDayMs;
        if (args.to_date) {
          const parsed = parseVenueDate(args.to_date);
          if (parsed == null)
            return fail("to_date inválida. Usá el formato YYYY-MM-DD.");
          lastDayMs = parsed;
        } else {
          lastDayMs = fromDayMs + 6 * 24 * 60 * 60 * 1000;
        }
        if (lastDayMs < fromDayMs)
          return fail("to_date es anterior a from_date.");
        // Medianoche local del día siguiente al último (exclusive). +36 h y recorte por fecha
        // para no depender de la duración del día.
        const toDayMs = parseVenueDate(
          toVenueDateKey(lastDayMs + 36 * 60 * 60 * 1000),
        )!;
        const days = Math.round((toDayMs - fromDayMs) / (24 * 60 * 60 * 1000));
        if (days > MAX_AVAILABILITY_DAYS)
          return fail(
            `El rango no puede superar ${MAX_AVAILABILITY_DAYS} días.`,
          );

        const [slots, own] = await Promise.all([
          getUnavailableSlots(
            space.id,
            unixMsToDate(fromDayMs),
            unixMsToDate(toDayMs),
          ),
          getUserNextReservations(user.registeredUserId, space.id, 200, 0),
        ]);
        // Lo ocupado por otros + las reservas propias vigentes en ese espacio (pedir encima de
        // una propia fallaría igual).
        const busy: BusyBlock[] = [
          ...slots.map((s) => ({
            startMs: Number(s.startTime),
            endMs: Number(s.endTime),
          })),
          ...own
            .filter((r) => r.status === "PENDING" || r.status === "APPROVED")
            .map((r) => ({
              startMs: Number(r.occurrenceStartTime),
              endMs: Number(r.occurrenceEndTime),
            })),
        ];
        const availability = computeFreeWindows({
          fromDayMs,
          toDayMs,
          busy,
          nowMs: nowMs(),
          minDurationMs: (args.min_duration_minutes ?? 15) * 60 * 1000,
        });
        return ok({
          space: { id: space.id, name: space.name },
          timezone: "America/Argentina/Buenos_Aires",
          days: availability.map((d) => ({
            date: toVenueDateKey(d.dayStartMs),
            label: formatVenueDay(d.dayStartMs),
            free: d.windows.map((w) => ({
              start: toVenueIso(w.startMs),
              end: toVenueIso(w.endMs),
              label: `${formatVenueTime(w.startMs)}–${formatVenueTime(w.endMs)}`,
            })),
          })),
        });
      },
    ),
  );

  server.registerTool(
    "list_my_reservations",
    {
      title: "Ver mis reservas",
      description:
        "Lista las próximas reservas de la persona (incluye cada ocurrencia de las recurrentes), con su id, espacio, horario y estado. El id y, para las recurrentes, occurrence_start son los que pide cancel_reservation.",
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Máximo de reservas (por defecto 20)"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guarded(
      ctx,
      "list_my_reservations",
      "reservations:read",
      async (args, user) => {
        const rows = await getUserNextReservations(
          user.registeredUserId,
          undefined,
          args.limit ?? 20,
          0,
        );
        const ids = [...new Set(rows.map((r) => r.reservationId))];
        const meta = await prisma.reservation.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            isRecurring: true,
            space: { select: { name: true } },
          },
        });
        const byId = new Map(meta.map((m) => [m.id, m]));
        return ok({
          reservations: rows.map((r) => {
            const m = byId.get(r.reservationId);
            const start = Number(r.occurrenceStartTime);
            const end = Number(r.occurrenceEndTime);
            return {
              reservation_id: r.reservationId,
              space: m?.space?.name ?? null,
              start: toVenueIso(start),
              end: toVenueIso(end),
              label: formatVenueRange(start, end),
              status: r.status,
              status_label: STATUS_LABELS[r.status] ?? r.status,
              recurring: m?.isRecurring ?? false,
              ...(m?.isRecurring
                ? { occurrence_start: toVenueIso(start) }
                : {}),
              reason: r.reason,
            };
          }),
        });
      },
    ),
  );

  server.registerTool(
    "request_reservation",
    {
      title: "Pedir una reserva",
      description:
        "Pide una reserva de un espacio a nombre de la persona. Queda PENDIENTE hasta que el equipo de La Nube la apruebe; no está confirmada. Confirmá con la persona espacio, día, horario y motivo antes de llamarla.",
      inputSchema: z.object({
        space_id: z.string().describe("Id del espacio (de list_spaces)"),
        start: z.string().describe(`Inicio. ${ISO_FORMAT_HINT}`),
        end: z.string().describe(`Fin, el mismo día. ${ISO_FORMAT_HINT}`),
        reason: z
          .string()
          .min(3)
          .max(500)
          .describe("Motivo de la reserva, tal como lo diría la persona"),
        reservation_type: z
          .string()
          .optional()
          .describe(
            "Código del tipo de reserva (de list_spaces). Por defecto MEETING.",
          ),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    guarded(
      ctx,
      "request_reservation",
      "reservations:write",
      async (args, user) => {
        const startMs = parseIsoWithOffset(args.start);
        const endMs = parseIsoWithOffset(args.end);
        if (startMs == null || endMs == null)
          return fail(`Fecha inválida. ${ISO_FORMAT_HINT}`);
        const reservation = await requestUserReservation(
          user.registeredUserId,
          {
            spaceId: args.space_id,
            startMs,
            endMs,
            reason: args.reason,
            eventType: args.reservation_type,
            origin: { clientName: user.clientName },
          },
        );
        return ok({
          reservation_id: reservation.id,
          status: reservation.status,
          status_label: STATUS_LABELS[reservation.status] ?? reservation.status,
          space: reservation.space?.name ?? null,
          start: toVenueIso(startMs),
          end: toVenueIso(endMs),
          label: formatVenueRange(startMs, endMs),
          note: "La reserva quedó pendiente: el equipo de La Nube tiene que aprobarla. La persona va a ver el estado en su panel.",
        });
      },
    ),
  );

  server.registerTool(
    "cancel_reservation",
    {
      title: "Cancelar una reserva",
      description:
        "Cancela una reserva propia que todavía no empezó (o, si es recurrente y se indica occurrence_start, solo esa ocurrencia). Es irreversible: antes de llamarla, mostrale a la persona el espacio y el horario y pedile confirmación.",
      inputSchema: z.object({
        reservation_id: z
          .string()
          .describe("Id de la reserva (de list_my_reservations)"),
        occurrence_start: z
          .string()
          .optional()
          .describe(
            `Solo para reservas recurrentes: inicio de la ocurrencia a cancelar (de list_my_reservations). ${ISO_FORMAT_HINT}`,
          ),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    guarded(
      ctx,
      "cancel_reservation",
      "reservations:write",
      async (args, user) => {
        let occurrenceStartMs: number | null = null;
        if (args.occurrence_start) {
          occurrenceStartMs = parseIsoWithOffset(args.occurrence_start);
          if (occurrenceStartMs == null)
            return fail(`occurrence_start inválida. ${ISO_FORMAT_HINT}`);
        }
        await cancelUserReservation(user.registeredUserId, {
          reservationId: args.reservation_id,
          occurrenceStartMs,
        });
        return ok({
          cancelled: true,
          reservation_id: args.reservation_id,
          ...(occurrenceStartMs != null
            ? { occurrence_start: toVenueIso(occurrenceStartMs) }
            : {}),
        });
      },
    ),
  );

  return server;
}
