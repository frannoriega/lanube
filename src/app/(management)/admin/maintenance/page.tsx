import { MaintenanceManager } from "@/components/organisms/admin/config/maintenance-manager";
import { requirePagePermission } from "@/lib/page-auth";

export default async function MaintenancePage() {
  await requirePagePermission("maintenance:manage");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Mantenimiento
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Avisá a los usuarios de un mantenimiento y, si hace falta, poné todo o
          parte del sitio en solo lectura.
        </p>
      </div>
      <MaintenanceManager />
    </div>
  );
}
