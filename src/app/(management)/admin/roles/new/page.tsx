import { RoleForm } from "@/components/organisms/admin/config/role-form";
import { requirePagePermission } from "@/lib/page-auth";

/** Alta de rol como página (milestone 14: antes era un diálogo). */
export default async function NewRolePage() {
  await requirePagePermission("roles:manage");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Nuevo rol
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Elegí qué puede hacer este rol y a qué roles puede ascender usuarios.
        </p>
      </div>
      <RoleForm />
    </div>
  );
}
