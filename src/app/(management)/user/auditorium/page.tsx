"use client";
import { CalendarTemplateClient } from "@/components/templates/user/calendar-template-client";
import { Presentation } from "lucide-react";

const EVENT_TYPES = [
  { value: "CONFERENCE", label: "Conferencia" },
  { value: "WORKSHOP", label: "Taller" },
  { value: "MEETING", label: "Reunión" },
  { value: "OTHER", label: "Otro" },
];

export default function AuditoriumPage() {
  return (
    <CalendarTemplateClient
      title="Auditorio"
      description="Reserva el auditorio para eventos y presentaciones"
      icon={Presentation}
      apiEndpoint="/api/resources/auditorium"
      resourceType="AUDITORIUM"
      eventTypes={EVENT_TYPES}
      defaultEventType="CONFERENCE"
    />
  );
}
