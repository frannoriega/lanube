import { SpacesManager } from "@/components/organisms/admin/config/spaces-manager";
import { requirePagePermission } from "@/lib/page-auth";

export default async function SpacesPage() {
  await requirePagePermission("spaces:manage");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Espacios
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Administra los espacios reservables del centro.
        </p>
      </div>
      <SpacesManager />
    </div>
  );
}
