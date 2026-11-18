"use client";

import {
  PastReservationsSection,
  UpcomingEventsSection,
  UpcomingReservationsSection,
} from "@/components/organisms/dashboard/user-activity-sections";
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
          value={stats?.totalReservations || 0}
        />
      </StatGrid>

      {/* Tres secciones (milestone 35): eventos próximos, reservas próximas e historial. */}
      <UpcomingEventsSection />
      <UpcomingReservationsSection />
      <PastReservationsSection />
    </div>
  );
}
