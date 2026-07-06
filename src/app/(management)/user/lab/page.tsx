import { CalendarTemplateClient } from "@/components/templates/user/calendar-template-client";
import { getSpaceBySlug } from "@/lib/db/spaces";
import { notFound } from "next/navigation";

const EVENT_TYPES = [
  { value: "WORKSHOP", label: "Taller" },
  { value: "MEETING", label: "Reunión de proyecto" },
  { value: "OTHER", label: "Otro" },
];

export default async function LabPage() {
  const space = await getSpaceBySlug("lab");
  if (!space) notFound();

  return (
    <CalendarTemplateClient
      title={space.name}
      description="Reserva el laboratorio para tus proyectos tecnológicos"
      iconName={space.iconName ?? undefined}
      apiEndpoint={`/api/resources/${space.id}`}
      eventTypes={EVENT_TYPES}
      defaultEventType="WORKSHOP"
    />
  );
}
