import { CalendarTemplateClient } from "@/components/templates/user/calendar-template-client";
import {
  listReservationTypeOptions,
  preferredTypeCode,
} from "@/lib/db/reservationTypes";
import { getSpaceBySlug } from "@/lib/db/spaces";
import { notFound } from "next/navigation";

/**
 * Booking calendar for a single reservable space, resolved by its (superadmin-editable) slug.
 * Replaces the former hardcoded /user/coworking, /lab, /auditorium, /meeting-room pages so the
 * URL always matches the space's stored slug — the sidebar links here from the same DB rows.
 */
export default async function SpacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [space, eventTypes] = await Promise.all([
    getSpaceBySlug(slug),
    listReservationTypeOptions(),
  ]);
  if (!space || !space.isReservable) notFound();

  return (
    <CalendarTemplateClient
      title={space.name}
      description={space.description}
      iconName={space.iconName ?? undefined}
      apiEndpoint={`/api/resources/${space.id}`}
      eventTypes={eventTypes}
      defaultEventType={preferredTypeCode(eventTypes, "")}
    />
  );
}
