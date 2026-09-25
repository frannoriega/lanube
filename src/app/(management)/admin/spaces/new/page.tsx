import { SpaceForm } from "@/components/organisms/admin/config/space-form";
import { requirePagePermission } from "@/lib/page-auth";

export default async function NewSpacePage() {
  await requirePagePermission("spaces:manage");
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Nuevo espacio
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Creá un espacio del centro y configurá su contenido público.
          </p>
        </div>
      </div>
      <SpaceForm />
    </div>
  );
}
