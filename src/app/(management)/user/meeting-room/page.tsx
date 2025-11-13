"use client";
import { CalendarTemplateClient } from "@/components/templates/user/calendar-template-client";
import { ResourceType } from "@prisma/client";
import { Users } from "lucide-react";

const EVENT_TYPES = [
  { value: "MEETING", label: "Reunión" },
  { value: "WORKSHOP", label: "Taller" },
  { value: "CONFERENCE", label: "Conferencia" },
  { value: "OTHER", label: "Otro" },
];

export default function MeetingRoomPage() {
  return (
    <CalendarTemplateClient
      title="Sala de Reuniones"
      description="Arrastra para seleccionar el horario de tu reunión"
      icon={Users}
      apiEndpoint={`/api/resources/${ResourceType.MEETING.toLowerCase()}`}
      eventTypes={EVENT_TYPES}
      defaultEventType="MEETING"
    />
  );
}
