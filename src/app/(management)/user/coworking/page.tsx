import { CalendarTemplateClient } from "@/components/templates/user/calendar-template-client";
import { getSpaceBySlug } from "@/lib/db/spaces";
import { notFound } from "next/navigation";

const EVENT_TYPES = [
  { value: "MEETING", label: "Reunión" },
  { value: "WORKSHOP", label: "Taller" },
  { value: "OTHER", label: "Trabajo individual" },
];

export default async function CoworkingPage() {
  const space = await getSpaceBySlug("coworking");
  if (!space?.fungibleResourceId) notFound();

  return (
    <CalendarTemplateClient
      title={space.name}
      description="Reserva un espacio de trabajo colaborativo en La Nube"
      iconName={space.iconName ?? undefined}
      apiEndpoint={`/api/resources/${space.fungibleResourceId}`}
      eventTypes={EVENT_TYPES}
      defaultEventType="OTHER"
    />
  );
}
