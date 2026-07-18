import { FormTemplateBuilder } from "@/components/organisms/admin/form-template-builder";
import { DeleteFormButton } from "@/components/organisms/admin/delete-form-button";
import { getFormTemplate } from "@/modules/events/db/forms";
import { notFound } from "next/navigation";

export default async function EditFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await getFormTemplate(id);
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Editar formulario</h1>
        <DeleteFormButton id={id} />
      </div>
      <FormTemplateBuilder mode="edit" templateId={id} />
    </div>
  );
}
