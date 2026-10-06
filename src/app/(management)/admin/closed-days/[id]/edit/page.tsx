import { ClosedDayForm } from "@/components/organisms/admin/closed-day-form";
import { ClosedDayImpact } from "@/components/organisms/admin/closed-day-impact";
import { todayDateKeyInAdminTz } from "@/lib/admin/admin-timezone";
import { nowMs } from "@/lib/clock";
import { CLOSED_DAY_SOURCE_LABELS } from "@/lib/constants/closed-days";
import { getClosedDay } from "@/lib/db/closedDays";
import { getReservationsAffectedByClosure } from "@/lib/db/closedDayImpact";
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
  // Un cierre descartado no cierra nada, así que no deja nada por resolver.
  const impact =
    closedDay.status === "DISMISSED"
      ? []
      : await getReservationsAffectedByClosure(closedDay);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Editar día cerrado
        </h1>
        <p className="text-gray-600 dark:text-gray-300">{closedDay.title}</p>
      </div>
      <section aria-labelledby="impact-title" className="max-w-3xl space-y-3">
        <h2 id="impact-title" className="text-lg font-semibold">
          Reservas afectadas
        </h2>
        <ClosedDayImpact items={impact} />
      </section>
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
