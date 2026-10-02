import { RoleForm } from "@/components/organisms/admin/config/role-form";
import { requirePagePermission } from "@/lib/page-auth";

/**
 * Edición de rol como página (milestone 14: antes era un diálogo). El formulario carga el rol
 * desde la lista (`GET /api/admin/roles`), que necesita igual para "Puede otorgar".
 */
export default async function EditRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("roles:manage");
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Editar rol
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Los cambios se aplican de inmediato a quienes ya lo tienen asignado.
        </p>
      </div>
      <RoleForm roleId={id} />
    </div>
  );
}
