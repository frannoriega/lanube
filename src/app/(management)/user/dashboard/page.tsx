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
import { useEffect } from "react";
import { toast } from "sonner";

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
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{reservation.service}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {new Date(reservation.startTime).toLocaleDateString()}{" "}
                          -
                          {new Date(reservation.startTime).toLocaleTimeString()}{" "}
                          a{new Date(reservation.endTime).toLocaleTimeString()}
                        </p>
                      </div>
                      <div
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          reservation.status === "APPROVED"
                            ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                            : reservation.status === "PENDING"
                              ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                              : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                        }`}
                      >
                        {reservation.status === "APPROVED"
                          ? "Aprobada"
                          : reservation.status === "PENDING"
                            ? "Pendiente"
                            : "Rechazada"}
                      </div>
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
