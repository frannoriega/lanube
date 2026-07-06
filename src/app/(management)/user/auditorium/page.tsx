import { CalendarTemplateClient } from "@/components/templates/user/calendar-template-client";
import { getSpaceBySlug } from "@/lib/db/spaces";
import { notFound } from "next/navigation";

const EVENT_TYPES = [
  { value: "CONFERENCE", label: "Conferencia" },
  { value: "WORKSHOP", label: "Taller" },
  { value: "MEETING", label: "Reunión" },
  { value: "OTHER", label: "Otro" },
];

export default async function AuditoriumPage() {
  const space = await getSpaceBySlug("auditorium");
  if (!space?.fungibleResourceId) notFound();

  return (
    <CalendarTemplateClient
      title={space.name}
      description="Reserva el auditorio para eventos y presentaciones"
      iconName={space.iconName ?? undefined}
      apiEndpoint={`/api/resources/${space.fungibleResourceId}`}
      eventTypes={EVENT_TYPES}
      defaultEventType="CONFERENCE"
    />
  );
}
