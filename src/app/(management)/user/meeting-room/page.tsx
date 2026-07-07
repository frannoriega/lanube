import { CalendarTemplateClient } from "@/components/templates/user/calendar-template-client";
import {
  listReservationTypeOptions,
  preferredTypeCode,
} from "@/lib/db/reservationTypes";
import { getSpaceBySlug } from "@/lib/db/spaces";
import { notFound } from "next/navigation";

export default async function MeetingRoomPage() {
  const [space, eventTypes] = await Promise.all([
    getSpaceBySlug("meeting-room"),
    listReservationTypeOptions(),
  ]);
  if (!space) notFound();

  return (
    <CalendarTemplateClient
      title={space.name}
      description="Arrastra para seleccionar el horario de tu reunión"
      iconName={space.iconName ?? undefined}
      apiEndpoint={`/api/resources/${space.id}`}
      eventTypes={eventTypes}
      defaultEventType={preferredTypeCode(eventTypes, "MEETING")}
    />
  );
}
