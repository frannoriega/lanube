"use client";

import { WeekCalendar, type ReservationFormData } from "@/components/organisms/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Presentation } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const EVENT_TYPES = [
  { value: "CONFERENCE", label: "Conferencia" },
  { value: "WORKSHOP", label: "Taller" },
  { value: "MEETING", label: "Reunión" },
  { value: "OTHER", label: "Otro" },
];

export default function AuditoriumPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/");
      return;
    }

    if (!userId) {
      fetchUserId();
    }
  }, [session, status, router, userId]);

  const fetchUserId = async () => {
    try {
      const response = await fetch("/api/user/profile");
      if (response.ok) {
        const data = await response.json();
        setUserId(data.id);
      }
    } catch (error) {
      console.error("Error fetching user ID:", error);
    }
  };

  const handleCreateReservation = useCallback(async (data: ReservationFormData) => {
    const response = await fetch("/api/resources/auditorium", {
      method: "POST",
        headers: {
        "Content-Type": "application/json",
        },
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
  }, []);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-la-nube-primary"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Auditorio</h1>
        <p className="text-gray-600 dark:text-gray-300">Reserva el auditorio para eventos y presentaciones</p>
      </div>

          <Card className="glass-card dark:glass-card-dark">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
            <Presentation className="h-5 w-5" />
            Calendario de Reservas
              </CardTitle>
          <CardDescription>Haz clic y arrastra para reservar</CardDescription>
            </CardHeader>
            <CardContent>
          <WeekCalendar
            resourceType="AUDITORIUM"
            apiEndpoint="/api/resources/auditorium"
            onCreateReservation={handleCreateReservation}
            eventTypes={EVENT_TYPES}
            defaultEventType="CONFERENCE"
            title="Nueva Reserva del Auditorio"
            description="Descripción del evento"
            userId={userId}
          />
            </CardContent>
          </Card>
    </div>
  );
}
