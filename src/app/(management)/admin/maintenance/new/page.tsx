import { MaintenanceForm } from "@/components/organisms/admin/config/maintenance-form";
import { requirePagePermission } from "@/lib/page-auth";

export default async function NewMaintenancePage() {
  await requirePagePermission("maintenance:manage");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Nuevo mantenimiento
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Rige desde que lo guardás, salvo que programes el inicio.
        </p>
      </div>
      <MaintenanceForm />
    </div>
  );
}
