import { FormTemplateBuilder } from "@/components/organisms/admin/form-template-builder";

export default function NewFormPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nuevo formulario</h1>
      <FormTemplateBuilder mode="create" />
    </div>
  );
}
