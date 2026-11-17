import { ActivityCalendar } from "@/components/organisms/activity-calendar/ActivityCalendar";
import { getSpacesByKind } from "@/lib/db/spaces";
import { requirePagePermission } from "@/lib/page-auth";

/**
 * Calendario de actividades del panel (milestone 32): todas las reservas con quién reservó,
 * los eventos, los días cerrados y el mantenimiento. Solo lectura. Exige el permiso de ver
 * reservas, igual que su endpoint (`/api/admin/calendar`).
 */
export default async function AdminCalendarPage() {
  await requirePagePermission("reservations:manage");
  const spaces = await getSpacesByKind("SPACE");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Calendario</h1>
        <p className="text-muted-foreground">
          Todo lo que pasa en La Nube: reservas, eventos, días cerrados y
          mantenimiento.
        </p>
      </div>
      <ActivityCalendar
        scope="admin"
        spaces={spaces.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
