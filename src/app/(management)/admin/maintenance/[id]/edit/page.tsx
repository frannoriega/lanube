import { MaintenanceForm } from "@/components/organisms/admin/config/maintenance-form";
import { nowMs } from "@/lib/clock";
import { windowState } from "@/lib/maintenance/evaluate";
import { getMaintenanceWindow, toView } from "@/lib/maintenance/server";
import { requirePagePermission } from "@/lib/page-auth";
import { notFound, redirect } from "next/navigation";

export default async function EditMaintenancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("maintenance:manage");
  const { id } = await params;
  const row = await getMaintenanceWindow(id);
  if (!row) notFound();
  const view = toView(row);
  // Una ventana terminada es historia: no se edita.
  if (windowState(view, nowMs()) === "ended") redirect("/admin/maintenance");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Editar mantenimiento
        </h1>
        <p className="text-gray-600 dark:text-gray-300">{view.title}</p>
      </div>
      <MaintenanceForm
        windowId={view.id}
        defaultValues={{
          title: view.title,
          reasonMd: view.reasonMd,
          mode: view.mode,
          areas: view.areas,
          startsAt: view.startsAt,
          endsAt: view.endsAt,
        }}
      />
    </div>
  );
}
