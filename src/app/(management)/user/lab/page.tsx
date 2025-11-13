"use client";
import { CalendarTemplateClient } from "@/components/templates/user/calendar-template-client";
import { FlaskConical } from "lucide-react";

const EVENT_TYPES = [
  { value: "WORKSHOP", label: "Taller" },
  { value: "MEETING", label: "Reunión de proyecto" },
  { value: "OTHER", label: "Otro" },
];

export default function LabPage() {
  return (
    <CalendarTemplateClient
      title="Laboratorio"
      description="Reserva el laboratorio para tus proyectos tecnológicos"
      icon={FlaskConical}
      apiEndpoint="/api/resources/lab"
      eventTypes={EVENT_TYPES}
      defaultEventType="WORKSHOP"
    />
  );
}
