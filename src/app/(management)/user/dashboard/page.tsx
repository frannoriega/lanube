"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
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

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Próximas Reservas
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.upcomingReservations || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Esta Semana</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalTimeThisWeek || 0}h
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Este Mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalTimeThisMonth || 0}h
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Reservas Totales
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.recentReservations?.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

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
                        <p className="text-sm text-gray-600">
                          {new Date(reservation.startTime).toLocaleDateString()}{" "}
                          -
                          {new Date(reservation.startTime).toLocaleTimeString()}{" "}
                          a{new Date(reservation.endTime).toLocaleTimeString()}
                        </p>
                      </div>
                      <div
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          reservation.status === "APPROVED"
                            ? "bg-green-100 text-green-800"
                            : reservation.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
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
