import { requirePagePermission } from "@/lib/page-auth";
import { EventForm } from "@/components/organisms/admin/event-form";
import { Suspense } from "react";

export default async function NewEventPage() {
  // La página exige el permiso, no solo el `admin:access` del middleware (arreglo de
  // seguridad del 2026-11-17: la página arma datos de eventos en el servidor).
  await requirePagePermission("events:manage");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nuevo evento</h1>
      <Suspense>
        <EventForm mode="create" />
      </Suspense>
    </div>
  );
}
