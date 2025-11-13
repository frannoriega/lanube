"use client";
import { CalendarTemplateClient } from "@/components/templates/user/calendar-template-client";
import { Building2 } from "lucide-react";

const EVENT_TYPES = [
  { value: "MEETING", label: "Reunión" },
  { value: "WORKSHOP", label: "Taller" },
  { value: "OTHER", label: "Trabajo individual" },
];

export default function CoworkingPage() {
  return (
    <CalendarTemplateClient
      title="Coworking"
      description="Reserva un espacio de trabajo colaborativo en La Nube"
      icon={Building2}
      apiEndpoint="/api/resources/coworking"
      eventTypes={EVENT_TYPES}
      defaultEventType="OTHER"
    />
  );
}
