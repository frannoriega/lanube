import { ResourcesManager } from "@/components/organisms/admin/config/resources-manager";
import { requirePagePermission } from "@/lib/page-auth";

export default async function ResourcesPage() {
  await requirePagePermission("resources:manage");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Recursos
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Administra el inventario de equipamiento del centro.
        </p>
      </div>
      <ResourcesManager />
    </div>
  );
}
