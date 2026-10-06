import "server-only";
import { prisma } from "@/lib/prisma";
import {
  formatEventTimeRange,
  WEEKDAY_SHORT_LABELS,
} from "@/lib/constants/events";
import { weekdaysFromRrule } from "@/lib/db/events";
import { resolveRoleNames } from "@/lib/db/roles";
import { getSpaceFaqs } from "@/lib/db/spaces";
import { parseFormSchema } from "@/lib/events/form-engine";
import type { FormNode } from "@/lib/events/form-schema";
import type { AuditEntityType } from "./registry";

/**
 * Fotos de auditoría por entidad (milestone 16): leen un registro y lo devuelven **como lo
 * leería una persona** — con los ids resueltos a nombres (el espacio, el tipo, la plantilla
 * de formulario), los días de la semana como texto y el árbol de un formulario aplanado en
 * preguntas. `beginAudit` saca una antes de escribir y otra después; el registro decide qué
 * campos de la foto se guardan y cómo se muestran.
 *
 * Por qué resolver nombres acá y no al mostrar: la entrada tiene que contar lo que pasó **en
 * ese momento**. Si mañana el espacio se renombra o la plantilla se borra, la auditoría sigue
 * diciendo "Espacio: Sala A → Auditorio" y no un id que ya no lleva a ningún lado.
 *
 * Agregar una entidad auditable = una función más en `SNAPSHOTS` (un test verifica que toda
 * entidad con eventos de alta/baja/edición tenga la suya).
 */
type Snapshot = Record<string, unknown>;
type SnapshotLoader = (id: string) => Promise<Snapshot | null>;

/** Aplana el árbol de un formulario en preguntas, con la sección (grupo) de cada una. */
function flattenFormFields(nodes: FormNode[], section: string | null = null) {
  const out: Snapshot[] = [];
  for (const node of nodes) {
    if (node.kind === "group") {
      const label = node.label?.trim() || section;
      out.push(...flattenFormFields(node.children, label));
      continue;
    }
    out.push({
      id: node.id,
      label: node.label,
      section,
      type: node.type,
      required: node.required,
      options: node.options ?? [],
    });
  }
  return out;
}

export const SNAPSHOTS: Partial<Record<AuditEntityType, SnapshotLoader>> = {
  Role: async (id) => {
    const r = await prisma.role.findUnique({ where: { id } });
    if (!r) return null;
    return {
      name: r.name,
      key: r.key,
      description: r.description,
      permissions: r.permissions,
      grantableRoles: await resolveRoleNames(r.grantableRoleIds),
      isSystem: r.isSystem,
      isSuperadmin: r.isSuperadmin,
    };
  },

  Space: async (id) => {
    const s = await prisma.space.findUnique({ where: { id } });
    if (!s) return null;
    return { ...s, faqs: getSpaceFaqs(s) };
  },

  Resource: (id) => prisma.resource.findUnique({ where: { id } }),

  ReservationType: (id) => prisma.reservationType.findUnique({ where: { id } }),

  Event: async (id) => {
    const e = await prisma.event.findUnique({
      where: { id },
      include: {
        space: { select: { name: true } },
        type: { select: { name: true } },
        form: {
          select: { templateId: true, opensAt: true, closesAt: true },
        },
      },
    });
    if (!e) return null;
    // La plantilla de origen es un escalar sin FK (ver EventForm.templateId): puede ya no
    // existir, y en ese caso se muestra que hubo una.
    const templateId = e.form?.templateId ?? null;
    const template = templateId
      ? await prisma.form.findUnique({
          where: { id: templateId },
          select: { name: true },
        })
      : null;
    return {
      name: e.name,
      status: e.status,
      eventType: e.type.name,
      space: e.space.name,
      location: e.location,
      startDate: e.startTime,
      endDate: e.recurrenceEnd ?? e.endTime,
      weekdays: weekdaysFromRrule(e.rrule).map((d) => WEEKDAY_SHORT_LABELS[d]),
      schedule: formatEventTimeRange(Number(e.startTime), Number(e.endTime)),
      capacity: e.capacity,
      requiresApproval: e.requiresApproval,
      isFeatured: e.isFeatured,
      summary: e.summary,
      description: e.description,
      imageUrl: e.imageUrl,
      formTemplate: templateId
        ? (template?.name ?? "(plantilla eliminada)")
        : null,
      registrationOpensAt: e.form?.opensAt ?? null,
      registrationClosesAt: e.form?.closesAt ?? null,
    };
  },

  Form: async (id) => {
    const f = await prisma.form.findUnique({ where: { id } });
    if (!f) return null;
    return {
      name: f.name,
      description: f.description,
      fields: flattenFormFields(parseFormSchema(f.schema).nodes),
    };
  },

  // Incluye las borradas (`deletedAt`): la baja y la restauración también se auditan.
  NewsPost: (id) => prisma.newsPost.findUnique({ where: { id } }),

  LandingTheme: (id) => prisma.landingTheme.findUnique({ where: { id } }),

  SiteConfig: (id) => prisma.siteConfig.findUnique({ where: { id } }),

  MaintenanceWindow: (id) =>
    prisma.maintenanceWindow.findUnique({ where: { id } }),
};

/** La foto de un registro, o `null` si no existe (o la entidad no tiene foto). */
export async function loadSnapshot(
  entityType: AuditEntityType,
  id: string,
): Promise<Snapshot | null> {
  const load = SNAPSHOTS[entityType];
  if (!load) return null;
  return (await load(id)) as Snapshot | null;
}
