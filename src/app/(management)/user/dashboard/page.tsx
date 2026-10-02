"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StatGrid,
  StatGridSkeleton,
  StatTile,
} from "@/components/molecules/stat-grid";
import { useUserStats } from "@/hooks/api";
import useUser from "@/hooks/use-user";
import { Calendar, Clock, TrendingUp } from "lucide-react";
import { StatusBadge } from "@/components/atoms/status-badge";
import { formatTimeShort } from "@/lib/utils/date";
import { useEffect } from "react";
import { toast } from "sonner";

/**
 * "13/10/2026 · 10:00 a 13:00" (milestone 14, hallazgo N).
 *
 * Antes se armaba en JSX con `toLocaleDateString()` / `toLocaleTimeString()` sueltos: el
 * espacio en blanco de JSX pegaba el "-" y la "a" a los valores ("-10:00:00 a01:00:00"),
 * salían los segundos y el formato 12/24h dependía del navegador. Acá la fecha va siempre
 * como dd/mm/aaaa y las horas como HH:mm en 24h, en la zona horaria del navegador (la regla
 * del proyecto: se guarda UNIX ms en UTC y se formatea del lado del cliente).
 */
function formatReservationWhen(startMs: number, endMs: number): string {
  const start = new Date(startMs);
  const date = start.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${date} · ${formatTimeShort(start)} a ${formatTimeShort(new Date(endMs))}`;
}

export default function DashboardPage() {
  const user = useUser();
  const { data: stats, error, firstTime } = useUserStats();

  useEffect(() => {
    if (error) {
      toast.error("Error al obtener las estadísticas");
    }
  }, [error]);

  if (firstTime) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-72" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <StatGridSkeleton />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          ¡Bienvenido, {user.name}!
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Gestiona tus reservas y accede a los servicios de La Nube
        </p>
      </div>

      {/* Stats cards — grilla compartida, 2×2 compacta en teléfonos */}
      <StatGrid>
        <StatTile
          title="Próximas Reservas"
          icon={Calendar}
          value={stats?.upcomingReservations || 0}
        />
        <StatTile
          title="Esta Semana"
          icon={Clock}
          value={`${stats?.totalTimeThisWeek || 0}h`}
        />
        <StatTile
          title="Este Mes"
          icon={TrendingUp}
          value={`${stats?.totalTimeThisMonth || 0}h`}
        />
        <StatTile
          title="Reservas Totales"
          icon={Calendar}
          value={stats?.recentReservations?.length || 0}
        />
      </StatGrid>

      {/* Recent reservations */}
      {stats?.recentReservations && stats.recentReservations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Reservas Recientes
          </h2>
          <Card className="glass-card dark:glass-card-dark">
            <CardContent className="p-6">
              <div className="space-y-4">
                {stats.recentReservations
                  .slice(0, 5)
                  .map((reservation, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-3 p-3 border rounded-lg"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{reservation.service}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatReservationWhen(
                            reservation.startTime,
                            reservation.endTime,
                          )}
                        </p>
                      </div>
                      {/* Badge compartido: cubre también CANCELLED, que el switch a mano
                          anterior mostraba como "Rechazada". */}
                      <StatusBadge status={reservation.status} />
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
