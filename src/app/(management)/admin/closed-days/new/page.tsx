import {
  ClosedDayForm,
  emptyClosedDay,
} from "@/components/organisms/admin/closed-day-form";
import { todayDateKeyInAdminTz } from "@/lib/admin/admin-timezone";
import { nowMs } from "@/lib/clock";
import { requirePagePermission } from "@/lib/page-auth";

/** Alta de un día cerrado como página (milestone 23). */
export default async function NewClosedDayPage() {
  await requirePagePermission("closed-days:manage");
  const today = todayDateKeyInAdminTz(nowMs());
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Nuevo día cerrado
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Mientras dure, no se podrán pedir reservas en ese horario.
        </p>
      </div>
      <ClosedDayForm defaultValues={emptyClosedDay(today)} today={today} />
    </div>
  );
}
