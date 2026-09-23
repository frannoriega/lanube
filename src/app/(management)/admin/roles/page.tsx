import { RolesManager } from "@/components/organisms/admin/config/roles-manager";
import { requirePagePermission } from "@/lib/page-auth";

export default async function RolesPage() {
  await requirePagePermission("roles:manage");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Roles y permisos
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Definí qué puede hacer cada rol. Los cambios se aplican de inmediato a
          quienes ya lo tienen asignado.
        </p>
      </div>
      <RolesManager />
    </div>
  );
}
