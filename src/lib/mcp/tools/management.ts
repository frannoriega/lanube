import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { isValidDateKey } from "@/lib/admin/admin-timezone";
import { nowMs } from "@/lib/clock";
import {
  EVENT_STATUS_LABELS,
  eventDisplayStatus,
  formatEventTimeRange,
  WEEKDAY_SHORT_LABELS,
} from "@/lib/constants/events";
import { getReportForRange } from "@/lib/db/adminReports";
import { getEvent, listEvents, weekdaysFromRrule } from "@/lib/db/events";
import {
  getEventFormColumns,
  getFormTemplate,
  listFormTemplatesPage,
} from "@/lib/db/forms";
import { listEventParticipants } from "@/lib/db/participants";
import { listProfileChangeRequestsForAdmin } from "@/lib/db/profileChangeRequests";
import { listResources } from "@/lib/db/resources";
import { parseFormSchema } from "@/lib/events/form-engine";
import { exportCell } from "@/lib/events/form-export";
import type { FormNode } from "@/lib/events/form-schema";
import { prisma } from "@/lib/prisma";
import { formatVenueRange, parseVenueDate, toVenueIso } from "../format";
import { defineTool, fail, ok, pageArgs, type McpToolContext } from "./shared";

/**
 * Consulta de gestión, **solo lectura** (milestone 21): eventos, formularios, solicitudes de
 * cambio de datos personales, reportes y recursos (equipamiento). Cada tool exige el mismo
 * permiso que su pantalla del panel (`access.ts`), además del scope `management:read`.
 *
 * Ninguna escribe: para cualquier cambio (aprobar inscriptos, decidir una solicitud, editar un
 * evento…) las respuestas traen el link al panel.
 *
 * ⚠️ Algunas devuelven **datos personales** (emails y respuestas de inscriptos, DNI pedidos en
 * una solicitud de cambio): los mismos que ve en el panel quien tiene ese permiso, que es quien
 * conectó el asistente.
 */

const iso = (ms: bigint | number | null | undefined) =>
  ms == null ? null : toVenueIso(Number(ms));

const PARTICIPANT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente de aprobación",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada por la persona",
};

const PROFILE_FIELD_LABELS: Record<string, string> = {
  DNI: "DNI",
  REASON_TO_JOIN: "Motivo para unirse",
};

const PROFILE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
};

/** El árbol de un formulario, simplificado para leerlo (sin condiciones internas). */
function describeNodes(nodes: FormNode[]): unknown[] {
  return nodes.map((n) =>
    n.kind === "input"
      ? {
          question: n.label,
          type: n.type,
          required: n.required,
          ...(n.options?.length ? { options: n.options } : {}),
          ...(n.visibleWhen ? { conditional: true } : {}),
        }
      : {
          group: n.label ?? "Grupo",
          ...(n.repeat ? { repeats: true } : {}),
          ...(n.visibleWhen ? { conditional: true } : {}),
          fields: describeNodes(n.children),
        },
  );
}

function eventSchedule(e: {
  startTime: bigint;
  endTime: bigint;
  rrule: string | null;
  recurrenceEnd: bigint | null;
}) {
  const weekdays = weekdaysFromRrule(e.rrule);
  return {
    first_session: formatVenueRange(Number(e.startTime), Number(e.endTime)),
    starts_at: iso(e.startTime),
    ends_on: iso(e.recurrenceEnd ?? e.endTime),
    weekdays: weekdays.map((d) => WEEKDAY_SHORT_LABELS[d]),
    time: formatEventTimeRange(Number(e.startTime), Number(e.endTime)),
  };
}

export function registerManagementTools(
  server: McpServer,
  ctx: McpToolContext,
): void {
  // ── Eventos (events:manage) ────────────────────────────────────────────────

  defineTool(
    server,
    ctx,
    "list_events",
    {
      title: "Listar eventos",
      description:
        "Eventos del panel (talleres, cursos), los más nuevos primero, con estado, fechas, espacio e inscripciones. Filtros opcionales por estado y por rango de fechas (YYYY-MM-DD).",
      inputSchema: z.object({
        status: z
          .enum(["DRAFT", "PUBLISHED", "PAUSED", "ENDED", "CANCELLED"])
          .optional(),
        from_date: z.string().optional().describe("YYYY-MM-DD"),
        to_date: z.string().optional().describe("YYYY-MM-DD"),
        page: z.number().int().min(1).optional(),
        page_size: z.number().int().min(1).max(50).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      for (const d of [args.from_date, args.to_date])
        if (d && !isValidDateKey(d))
          return fail("Fecha inválida: usá YYYY-MM-DD.");
      const { page, pageSize } = pageArgs(args.page, args.page_size);
      const { events, total } = await listEvents({
        status: args.status,
        from: args.from_date,
        to: args.to_date,
        page,
        pageSize,
      });
      const at = nowMs();
      return ok({
        total,
        page,
        page_size: pageSize,
        events: events.map((e) => {
          const status = eventDisplayStatus(
            e.status,
            Number(e.recurrenceEnd ?? e.endTime),
            at,
            e.deletedAt == null ? null : Number(e.deletedAt),
          );
          return {
            id: e.id,
            name: e.name,
            summary: e.summary,
            status,
            status_label: EVENT_STATUS_LABELS[status],
            type: e.type.name,
            space: e.space.name,
            ...eventSchedule(e),
            registrations: e._count.participants,
            featured: e.isFeatured,
            admin_url: `${ctx.origin}/admin/events/${e.id}`,
          };
        }),
      });
    },
  );

  defineTool(
    server,
    ctx,
    "get_event",
    {
      title: "Ver un evento",
      description:
        "Detalle de un evento: descripción (markdown), agenda, cupo, si requiere aprobación, ventana de inscripción y conteo de inscriptos por estado.",
      inputSchema: z.object({
        id: z.string().describe("Id del evento (de list_events)"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const e = await getEvent(args.id);
      if (!e) return fail("Evento no encontrado");
      const status = eventDisplayStatus(
        e.status,
        Number(e.recurrenceEnd ?? e.endTime),
        nowMs(),
        e.deletedAt == null ? null : Number(e.deletedAt),
      );
      const byStatus = await prisma.eventParticipant.groupBy({
        by: ["status"],
        where: { eventId: e.id },
        _count: true,
      });
      return ok({
        id: e.id,
        name: e.name,
        summary: e.summary,
        description_markdown: e.description,
        status,
        status_label: EVENT_STATUS_LABELS[status],
        space: e.space.name,
        location: e.location,
        ...eventSchedule(e),
        capacity: e.capacity ?? e.space.capacity,
        requires_approval: e.requiresApproval,
        registration: e.form
          ? {
              opens_at: iso(e.form.opensAt),
              closes_at: iso(e.form.closesAt),
              public_form_url:
                status === "PUBLISHED"
                  ? `${ctx.origin}/forms/${e.form.slug}`
                  : null,
            }
          : null,
        participants_by_status: Object.fromEntries(
          byStatus.map((s) => [
            PARTICIPANT_STATUS_LABELS[s.status] ?? s.status,
            s._count,
          ]),
        ),
        admin_url: `${ctx.origin}/admin/events/${e.id}`,
        participants_url: `${ctx.origin}/admin/events/${e.id}/participants`,
      });
    },
  );

  defineTool(
    server,
    ctx,
    "list_event_participants",
    {
      title: "Ver inscriptos de un evento",
      description:
        "Las inscripciones de un evento: email, estado y respuestas del formulario (con la pregunta como etiqueta). Contiene datos personales: usalos solo para lo que la persona pidió. Aprobar o rechazar se hace desde el panel.",
      inputSchema: z.object({
        id: z.string().describe("Id del evento"),
        status: z
          .enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"])
          .optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const e = await getEvent(args.id);
      if (!e) return fail("Evento no encontrado");
      const [rows, columns] = await Promise.all([
        listEventParticipants(e.id),
        getEventFormColumns(e.id),
      ]);
      const filtered = args.status
        ? rows.filter((r) => r.status === args.status)
        : rows;
      return ok({
        event: e.name,
        total: filtered.length,
        participants: filtered.map((p) => {
          const answers = (p.answers ?? {}) as Record<string, unknown>;
          return {
            email: p.displayEmail ?? p.email,
            status: p.status,
            status_label: PARTICIPANT_STATUS_LABELS[p.status] ?? p.status,
            registered_at: iso(p.createdAt),
            decision_reason: p.decisionReason,
            answers: Object.fromEntries(
              columns.map((c) => [c.label, exportCell(c, answers)]),
            ),
          };
        }),
        participants_url: `${ctx.origin}/admin/events/${e.id}/participants`,
      });
    },
  );

  // ── Formularios (forms:manage) ─────────────────────────────────────────────

  defineTool(
    server,
    ctx,
    "list_form_templates",
    {
      title: "Listar plantillas de formulario",
      description:
        "Las plantillas de formulario de inscripción (las que se usan al crear un evento), las editadas más recientemente primero.",
      inputSchema: z.object({
        page: z.number().int().min(1).optional(),
        page_size: z.number().int().min(1).max(50).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const { page, pageSize } = pageArgs(args.page, args.page_size);
      const { templates, total } = await listFormTemplatesPage({
        page,
        pageSize,
      });
      return ok({
        total,
        page,
        page_size: pageSize,
        templates: templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          updated_at: iso(t.updatedAt),
          admin_url: `${ctx.origin}/admin/forms/${t.id}`,
        })),
      });
    },
  );

  defineTool(
    server,
    ctx,
    "get_form_template",
    {
      title: "Ver una plantilla de formulario",
      description:
        "Las preguntas de una plantilla de formulario, en orden, con su tipo, si son obligatorias, opciones y grupos.",
      inputSchema: z.object({ id: z.string().describe("Id de la plantilla") }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const t = await getFormTemplate(args.id);
      if (!t) return fail("Plantilla no encontrada");
      return ok({
        id: t.id,
        name: t.name,
        description: t.description,
        questions: describeNodes(parseFormSchema(t.schema).nodes),
        admin_url: `${ctx.origin}/admin/forms/${t.id}`,
      });
    },
  );

  // ── Solicitudes de cambio de datos (users:profile-requests:review) ─────────

  defineTool(
    server,
    ctx,
    "list_profile_change_requests",
    {
      title: "Ver solicitudes de cambio de datos",
      description:
        "Solicitudes de cambio de DNI o de motivo para unirse: quién pide, valor actual y pedido, justificación, y si el DNI pedido ya lo usa otra cuenta. Las pendientes salen de la más vieja a la más nueva. Contiene datos personales. Aprobar o rechazar se hace desde el panel.",
      inputSchema: z.object({
        status: z
          .enum(["PENDING", "RESOLVED", "ALL"])
          .optional()
          .describe("Por defecto, PENDING"),
        page: z.number().int().min(1).optional(),
        page_size: z.number().int().min(1).max(50).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const { page, pageSize } = pageArgs(args.page, args.page_size);
      const { items, total, pendingCount } =
        await listProfileChangeRequestsForAdmin({
          status: args.status ?? "PENDING",
          page,
          pageSize,
        });
      return ok({
        total,
        pending_total: pendingCount,
        page,
        page_size: pageSize,
        requests: items.map((r) => ({
          id: r.id,
          requester: {
            name: `${r.requester.name} ${r.requester.lastName}`.trim(),
            email: r.requester.email,
          },
          field: PROFILE_FIELD_LABELS[r.field] ?? r.field,
          current_value: r.currentValue,
          requested_value: r.requestedValue,
          justification: r.justification,
          status: PROFILE_STATUS_LABELS[r.status] ?? r.status,
          requested_at: iso(r.createdAt),
          decided_at: iso(r.decidedAt),
          decision_reason: r.decisionReason,
          dni_already_in_use: r.dniConflict,
        })),
        review_url: `${ctx.origin}/admin/profile-requests`,
      });
    },
  );

  // ── Reportes (reports:view) ─────────────────────────────────────────────────

  defineTool(
    server,
    ctx,
    "get_usage_report",
    {
      title: "Reporte de uso",
      description:
        "El reporte de uso de un período (como la pantalla Reportes): registros nuevos, reservas por estado y por espacio, duraciones, y el detalle diario; opcionalmente comparado con otro período. Fechas YYYY-MM-DD, inclusive, máximo 366 días.",
      inputSchema: z.object({
        from_date: z.string().describe("Primer día, YYYY-MM-DD"),
        to_date: z.string().describe("Último día (inclusive), YYYY-MM-DD"),
        compare_from_date: z.string().optional(),
        compare_to_date: z.string().optional(),
        include_daily: z
          .boolean()
          .optional()
          .describe("Incluir el detalle por día (por defecto false)"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const DAY = 24 * 60 * 60 * 1000;
      const range = (from?: string, to?: string) => {
        if (!from || !to) return null;
        const f = parseVenueDate(from);
        const t = parseVenueDate(to);
        return f == null || t == null
          ? undefined
          : { from: f, to: t + DAY - 1 };
      };
      const main = range(args.from_date, args.to_date);
      if (!main) return fail("Fechas inválidas: usá YYYY-MM-DD.");
      if (main.from > main.to)
        return fail(
          "La fecha de inicio debe ser anterior o igual a la de fin.",
        );
      if (main.to - main.from > 366 * DAY)
        return fail("El rango máximo es de 366 días.");
      const cmp = range(args.compare_from_date, args.compare_to_date);
      if (cmp === undefined) return fail("Fechas de comparación inválidas.");
      const report = await getReportForRange(
        main.from,
        main.to,
        cmp?.from,
        cmp?.to,
      );
      const { daily, ...rest } = report;
      return ok({
        ...rest,
        ...(args.include_daily ? { daily } : {}),
        report_url: `${ctx.origin}/admin/reports`,
        note: rest.coverage.hasPrunedPortion
          ? "Parte del período es anterior a la retención del detalle: esa parte puede aparecer con menos actividad de la real (ver coverage)."
          : undefined,
      });
    },
  );

  // ── Recursos / equipamiento (resources:manage) ──────────────────────────────

  defineTool(
    server,
    ctx,
    "list_resources",
    {
      title: "Listar recursos",
      description:
        "El inventario de recursos físicos (equipamiento) de La Nube.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const resources = await listResources();
      return ok({
        total: resources.length,
        resources: resources.map((r) => ({
          id: r.id,
          name: r.name,
          serial_number: r.serialNumber,
        })),
        admin_url: `${ctx.origin}/admin/resources`,
      });
    },
  );

  defineTool(
    server,
    ctx,
    "get_resource",
    {
      title: "Ver un recurso",
      description:
        "Detalle de un recurso (equipamiento): nombre, número de serie y datos adicionales.",
      inputSchema: z.object({ id: z.string().describe("Id del recurso") }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const r = await prisma.resource.findUnique({ where: { id: args.id } });
      if (!r) return fail("Recurso no encontrado");
      return ok({
        id: r.id,
        name: r.name,
        serial_number: r.serialNumber,
        details: r.metadata,
        created_at: iso(r.createdAt),
        updated_at: iso(r.updatedAt),
      });
    },
  );
}
