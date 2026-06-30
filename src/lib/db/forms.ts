import { dateTimeLocalToMs } from "@/lib/events/datetime";
import { prisma } from "@/lib/prisma";
import { EventFormBindingInput, FormTemplateInput } from "@/lib/schemas/events";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@/generated/prisma/client";

function fieldCreateData(
  fields: FormTemplateInput["fields"],
  formId: string,
): Prisma.FormFieldCreateManyInput[] {
  return fields.map((f, index) => ({
    id: createId(),
    formId,
    order: index,
    type: f.type,
    label: f.label,
    placeholder: f.placeholder ?? null,
    required: f.required,
    options: f.options && f.options.length > 0 ? f.options : Prisma.JsonNull,
    config: Prisma.JsonNull,
  }));
}

/** Ordered fields of the instance form bound to an event (admin participants view/export). */
export async function getEventFormFields(eventId: string) {
  const eventForm = await prisma.eventForm.findUnique({
    where: { eventId },
    include: { form: { include: { fields: { orderBy: { order: "asc" } } } } },
  });
  return eventForm?.form.fields ?? [];
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
  return prisma.$transaction(async (tx) => {
    await tx.form.create({
      data: {
        id: formId,
        name: data.name,
        description: data.description ?? null,
        isTemplate: true,
      },
    });
    if (data.fields.length > 0) {
      await tx.formField.createMany({
        data: fieldCreateData(data.fields, formId),
      });
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
    if (!existing) throw new Error("Formulario no encontrado");

    await tx.form.update({
      where: { id },
      data: { name: data.name, description: data.description ?? null },
    });
    await tx.formField.deleteMany({ where: { formId: id } });
    if (data.fields.length > 0) {
      await tx.formField.createMany({ data: fieldCreateData(data.fields, id) });
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
  if (!existing) throw new Error("Formulario no encontrado");
  // Fields cascade; bound event instances are independent clones, so they survive.
  await prisma.form.delete({ where: { id } });
}

/**
 * Clones a template into a fresh instance Form (isTemplate=false) with copied fields
 * (new field ids). Runs inside the caller's transaction. Returns the instance form id.
 */
async function cloneTemplateToInstance(
  tx: Prisma.TransactionClient,
  templateId: string,
): Promise<string> {
  const template = await tx.form.findFirst({
    where: { id: templateId, isTemplate: true },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  if (!template) throw new Error("Formulario no encontrado");

  const instanceId = createId();
  await tx.form.create({
    data: {
      id: instanceId,
      name: template.name,
      description: template.description,
      isTemplate: false,
    },
  });
  if (template.fields.length > 0) {
    await tx.formField.createMany({
      data: template.fields.map((f) => ({
        id: createId(),
        formId: instanceId,
        order: f.order,
        type: f.type,
        label: f.label,
        placeholder: f.placeholder,
        required: f.required,
        options: f.options ?? Prisma.JsonNull,
        config: f.config ?? Prisma.JsonNull,
      })),
    });
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
