import { EventCheckIn } from "@/components/organisms/admin/event-checkin";
import { requirePagePermission } from "@/lib/page-auth";

/**
 * Check-in de un evento en la puerta (milestone 30). Toda la pantalla es un componente de
 * cliente que habla con `/api/admin/events/[id]/checkin/*`; la página solo exige el permiso
 * (la API lo vuelve a exigir, y responde 409 si el evento no tiene el check-in habilitado).
 */
export default async function EventCheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("events:checkin");
  const { id } = await params;
  return <EventCheckIn eventId={id} />;
}
