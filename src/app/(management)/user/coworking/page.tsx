import { CalendarTemplateClient } from "@/components/templates/user/calendar-template-client";
import {
  listReservationTypeOptions,
  preferredTypeCode,
} from "@/lib/db/reservationTypes";
import { getSpaceBySlug } from "@/lib/db/spaces";
import { notFound } from "next/navigation";

export default async function CoworkingPage() {
  const [space, eventTypes] = await Promise.all([
    getSpaceBySlug("coworking"),
    listReservationTypeOptions(),
  ]);
  if (!space) notFound();

  return (
    <CalendarTemplateClient
      title={space.name}
      description="Reserva un espacio de trabajo colaborativo en La Nube"
      iconName={space.iconName ?? undefined}
      apiEndpoint={`/api/resources/${space.id}`}
      eventTypes={eventTypes}
      defaultEventType={preferredTypeCode(eventTypes, "OTHER")}
    />
  );
}
