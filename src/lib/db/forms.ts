import { dateTimeLocalToMs } from "@/lib/events/datetime";
import { DomainError } from "@/lib/errors";
import {
  cloneSchemaWithNewIds,
  parseFormSchema,
  schemaToPublicFields,
} from "@/lib/events/form-engine";
import { type ExportColumn, exportColumns } from "@/lib/events/form-export";
import { type FormSchema, isInputNode } from "@/lib/events/form-schema";
import { prisma } from "@/lib/prisma";
import { EventFormBindingInput, FormTemplateInput } from "@/lib/schemas/events";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@/generated/prisma/client";

/**
 * Flattens a schema's input leaves (including group children, in tree order) into legacy
 * form_fields rows. The rows are a dual-write of the schema's inputs for the picker's field
 * count/preview; visibleWhen/group structure live only in `Form.schema`.
 */
function schemaToRows(
  schema: FormSchema,
  formId: string,
): Prisma.FormFieldCreateManyInput[] {
  return schemaToPublicFields(schema).map((f, index) => ({
    id: f.id,
    formId,
    order: index,
    type: f.type as Prisma.FormFieldCreateManyInput["type"],
    label: f.label,
    placeholder: f.placeholder ?? null,
    required: f.required,
    options: (f.options as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    config: (f.constraints as Prisma.InputJsonValue) ?? Prisma.JsonNull,
  }));
}

/** Serialises a FormSchema for a Prisma Json column. */
function schemaJson(schema: FormSchema): Prisma.InputJsonValue {
  return schema as unknown as Prisma.InputJsonValue;
}

/** Flattened export columns for an event's form (admin participants view/export). */
export async function getEventFormColumns(
  eventId: string,
): Promise<ExportColumn[]> {
  const eventForm = await prisma.eventForm.findUnique({
    where: { eventId },
    select: { form: { select: { schema: true } } },
  });
  if (!eventForm) return [];
  return exportColumns(parseFormSchema(eventForm.form.schema));
}

/** Reusable form templates for the admin Forms section + the event form picker. */
export async function listFormTemplates() {
  return prisma.form.findMany({
    where: { isTemplate: true },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { fields: true } },
      // Lightweight field summary so the picker can preview a template's structure.
      fields: {
        orderBy: { order: "asc" },
        select: { id: true, label: true, type: true, required: true },
      },
    },
  });
}

/** Paginated form templates (newest-updated first) for the admin Forms list. */
export async function listFormTemplatesPage({
  page = 1,
  pageSize = 9,
}: { page?: number; pageSize?: number } = {}) {
  const [templates, total] = await prisma.$transaction([
    prisma.form.findMany({
      where: { isTemplate: true },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { fields: true } } },
    }),
    prisma.form.count({ where: { isTemplate: true } }),
  ]);
  return { templates, total, page, pageSize };
}

/** A single template with its fields ordered, for the builder. */
export async function getFormTemplate(id: string) {
  return prisma.form.findFirst({
    where: { id, isTemplate: true },
    include: { fields: { orderBy: { order: "asc" } } },
  });
}

export async function createFormTemplate(data: FormTemplateInput) {
  const formId = createId();
  const rows = schemaToRows(data.schema, formId);
  return prisma.$transaction(async (tx) => {
    await tx.form.create({
      data: {
        id: formId,
        name: data.name,
        description: data.description ?? null,
        isTemplate: true,
        schema: schemaJson(data.schema),
      },
    });
    if (rows.length > 0) {
      await tx.formField.createMany({ data: rows });
    }
    return tx.form.findUnique({
      where: { id: formId },
      include: { fields: { orderBy: { order: "asc" } } },
    });
  });
}

/** Replaces a template's metadata + fields wholesale. Bound event instances are unaffected. */
export async function updateFormTemplate(id: string, data: FormTemplateInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.form.findFirst({
      where: { id, isTemplate: true },
    });
    if (!existing) throw new DomainError("Formulario no encontrado", 404);

    const rows = schemaToRows(data.schema, id);
    await tx.form.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description ?? null,
        schema: schemaJson(data.schema),
      },
    });
    await tx.formField.deleteMany({ where: { formId: id } });
    if (rows.length > 0) {
      await tx.formField.createMany({ data: rows });
    }

    return tx.form.findUnique({
      where: { id },
      include: { fields: { orderBy: { order: "asc" } } },
    });
  });
}

export async function deleteFormTemplate(id: string): Promise<void> {
  const existing = await prisma.form.findFirst({
    where: { id, isTemplate: true },
  });
  if (!existing) throw new DomainError("Formulario no encontrado", 404);
  // Fields cascade; bound event instances are independent clones, so they survive.
  await prisma.form.delete({ where: { id } });
}

/**
 * Clones a template into a fresh instance Form (isTemplate=false). The instance is a snapshot: the
 * template's `schema` is deep-copied with fresh node ids (branching/repeat references remapped), so
 * later template edits never affect a bound event. The legacy form_fields rows are derived from the
 * cloned input nodes (flat; visibleWhen has no column — it lives only in the schema).
 * Runs inside the caller's transaction. Returns the instance form id.
 */
async function cloneTemplateToInstance(
  tx: Prisma.TransactionClient,
  templateId: string,
): Promise<string> {
  const template = await tx.form.findFirst({
    where: { id: templateId, isTemplate: true },
  });
  if (!template) throw new DomainError("Formulario no encontrado", 404);

  const instanceId = createId();
  const schema = cloneSchemaWithNewIds(parseFormSchema(template.schema));
  await tx.form.create({
    data: {
      id: instanceId,
      name: template.name,
      description: template.description,
      isTemplate: false,
      schema: schemaJson(schema),
    },
  });
  const rows: Prisma.FormFieldCreateManyInput[] = schema.nodes
    .filter(isInputNode)
    .map((n, index) => ({
      id: n.id,
      formId: instanceId,
      order: index,
      type: n.type as Prisma.FormFieldCreateManyInput["type"],
      label: n.label,
      placeholder: n.placeholder ?? null,
      required: n.required,
      options: (n.options as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      config: (n.constraints as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    }));
  if (rows.length > 0) {
    await tx.formField.createMany({ data: rows });
  }
  return instanceId;
}

/**
 * Clones the chosen template and binds it to an event with its registration window.
 * `isPublished` mirrors the event's status (PUBLISHED) — kept in sync so the form row reflects
 * whether the event is live.
 */
export async function bindFormToEvent(
  tx: Prisma.TransactionClient,
  eventId: string,
  binding: EventFormBindingInput,
  isPublished: boolean,
): Promise<void> {
  const instanceId = await cloneTemplateToInstance(tx, binding.templateId);
  await tx.eventForm.create({
    data: {
      eventId,
      formId: instanceId,
      templateId: binding.templateId,
      slug: binding.slug,
      opensAt: dateTimeLocalToMs(binding.opensAt),
      closesAt: dateTimeLocalToMs(binding.closesAt),
      isPublished,
    },
  });
}

/** Removes an event's form binding by deleting its instance Form (cascades the binding). */
export async function unbindFormFromEvent(
  tx: Prisma.TransactionClient,
  formId: string,
): Promise<void> {
  await tx.form.delete({ where: { id: formId } });
}
