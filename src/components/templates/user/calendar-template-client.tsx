"use client";
import { WeekCalendar, type ReservationFormData } from "@/components/organisms/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

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
  resourceType: string;
  eventTypes: EventTypeOption[];
  defaultEventType: string;
}) {
  const { data: session, status } = useSession();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) return;
    const run = async () => {
      try {
        const response = await fetch("/api/user/profile");
        if (response.ok) {
          const data = await response.json();
          setUserId(data.id);
        }
      } finally {
        setLoadingUser(false);
      }
    };
    run();
  }, [session, status]);

  const handleCreateReservation = useCallback(async (data: ReservationFormData) => {
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: data.startTime.toISOString(),
        endTime: data.endTime.toISOString(),
        reason: data.reason,
        eventType: data.eventType,
      }),
    });
    if (response.ok) {
      toast.success("Reserva creada exitosamente");
    } else {
      const error = await response.json();
      toast.error(error.error || "Error al crear la reserva");
      throw new Error(error.error);
    }
  }, [apiEndpoint]);

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
            resourceType={resourceType}
            apiEndpoint={apiEndpoint}
            onCreateReservation={handleCreateReservation}
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


