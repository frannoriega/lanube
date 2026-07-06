import { CalendarTemplateClient } from "@/components/templates/user/calendar-template-client";
import { getSpaceBySlug } from "@/lib/db/spaces";
import { notFound } from "next/navigation";

const EVENT_TYPES = [
  { value: "MEETING", label: "Reunión" },
  { value: "WORKSHOP", label: "Taller" },
  { value: "CONFERENCE", label: "Conferencia" },
  { value: "OTHER", label: "Otro" },
];

export default async function MeetingRoomPage() {
  const space = await getSpaceBySlug("meeting-room");
  if (!space) notFound();

  return (
    <CalendarTemplateClient
      title={space.name}
      description="Arrastra para seleccionar el horario de tu reunión"
      iconName={space.iconName ?? undefined}
      apiEndpoint={`/api/resources/${space.id}`}
      eventTypes={EVENT_TYPES}
      defaultEventType="MEETING"
    />
  );
}
