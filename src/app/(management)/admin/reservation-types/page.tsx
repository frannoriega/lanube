import { ReservationTypesManager } from "@/components/organisms/admin/config/reservation-types-manager";
import { requirePagePermission } from "@/lib/page-auth";

export default async function ReservationTypesPage() {
  await requirePagePermission("reservation-types:manage");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Tipos de reserva
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Administra las categorías de reservas y eventos.
        </p>
      </div>
      <ReservationTypesManager />
    </div>
  );
}
