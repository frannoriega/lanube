import { ClosedDayForm } from "@/components/organisms/admin/closed-day-form";
import { todayDateKeyInAdminTz } from "@/lib/admin/admin-timezone";
import { nowMs } from "@/lib/clock";
import { CLOSED_DAY_SOURCE_LABELS } from "@/lib/constants/closed-days";
import { getClosedDay } from "@/lib/db/closedDays";
import { requirePagePermission } from "@/lib/page-auth";
import { notFound } from "next/navigation";

/** Edición de un día cerrado (milestone 23). */
export default async function EditClosedDayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("closed-days:manage");
  const { id } = await params;
  const closedDay = await getClosedDay(id);
  if (!closedDay) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Editar día cerrado
        </h1>
        <p className="text-gray-600 dark:text-gray-300">{closedDay.title}</p>
      </div>
      <ClosedDayForm
        closedDayId={closedDay.id}
        sourceLabel={CLOSED_DAY_SOURCE_LABELS[closedDay.source]}
        today={todayDateKeyInAdminTz(nowMs())}
        defaultValues={{
          title: closedDay.title,
          startDate: closedDay.startDate,
          endDate: closedDay.endDate,
          startTime: closedDay.startTime,
          endTime: closedDay.endTime,
        }}
      />
    </div>
  );
}
