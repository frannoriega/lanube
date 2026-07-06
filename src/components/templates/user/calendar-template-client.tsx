"use client";
import { WeekCalendar } from "@/components/organisms/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import useUser from "@/hooks/use-user";
import { getSpaceIcon } from "@/lib/constants/spaces";
import { LayoutGrid } from "lucide-react";

interface EventTypeOption {
  value: string;
  label: string;
}

export function CalendarTemplateClient({
  title,
  description,
  iconName,
  apiEndpoint,
  eventTypes,
  defaultEventType,
}: {
  title: string;
  description: string;
  iconName?: string;
  apiEndpoint: string;
  eventTypes: EventTypeOption[];
  defaultEventType: string;
}) {
  const Icon = iconName ? getSpaceIcon(iconName) : LayoutGrid;
  // Provided server-side by the layout — available on first render.
  const user = useUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {title}
        </h1>
        <p className="text-gray-600 dark:text-gray-300">{description}</p>
      </div>

      <Card className="glass-card dark:glass-card-dark">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            Calendario de Reservas
          </CardTitle>
          <CardDescription>Haz clic y arrastra para reservar</CardDescription>
        </CardHeader>
        <CardContent>
          <WeekCalendar
            apiEndpoint={apiEndpoint}
            eventTypes={eventTypes}
            defaultEventType={defaultEventType}
            title="Nueva Reserva"
            description="Motivo de la reserva"
            userId={user?.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
