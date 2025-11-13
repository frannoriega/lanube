"use client";
import { WeekCalendar } from "@/components/organisms/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResourceType } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface EventTypeOption { value: string; label: string }

export function CalendarTemplateClient({
  title,
  description,
  icon: Icon,
  apiEndpoint,
  resourceType,
  eventTypes,
  defaultEventType,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  apiEndpoint: string;
  resourceType: ResourceType;
  eventTypes: EventTypeOption[];
  defaultEventType: string;
}) {
  const { data: session, status } = useSession();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || !session.userId) return;
    setUserId(session.userId);
    setLoadingUser(false);
  }, [session, status]);


  // Skeleton while auth/user loads
  if (status === "loading" || loadingUser) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-6 w-56 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          <div className="mt-2 h-4 w-80 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        </div>
        <div className="rounded-lg border p-6">
          <div className="h-5 w-40 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-2" />
          <div className="h-4 w-60 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          <div className="mt-6 h-[500px] w-full bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
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
            userId={userId}
          />
        </CardContent>
      </Card>
    </div>
  );
}


