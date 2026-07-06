"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useServerTime } from "@/components/providers/server-time";
import { DashboardRecentReservations } from "@/components/templates/admin/dashboard-recent-reservations";
import { useAdminStats } from "@/hooks/api";
import { apiErrorMessage } from "@/lib/api/client";
import { reviewAdminReservation } from "@/lib/api/mutations";
import {
  Building2,
  Calendar,
  Clock,
  Eye,
  FlaskConical,
  Loader2,
  MessagesSquare,
  Presentation,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { now } = useServerTime();
  const {
    data: stats,
    loading,
    firstTime,
    refetch: refetchStats,
  } = useAdminStats();
  const [processing, setProcessing] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<{
    reservationId: string;
    conflicts: string[];
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  const triggerRefetch = useCallback(() => setRefetchKey((k) => k + 1), []);

  const handleReservationAction = useCallback(
    async (
      reservationId: string,
      action: "APPROVED" | "REJECTED",
      deniedReason?: string,
    ) => {
      setProcessing(reservationId);
      try {
        if (action === "APPROVED") {
          const preview = await reviewAdminReservation(reservationId, {
            status: action,
            preview: true,
          });
          setConfirmData({
            reservationId,
            conflicts: preview.autoRejectedIds || [],
          });
        } else {
          await reviewAdminReservation(reservationId, {
            status: action,
            deniedReason,
          });
          toast.success("Reserva rechazada exitosamente");
          refetchStats();
          triggerRefetch();
        }
      } catch (err) {
        toast.error(apiErrorMessage(err, "Error al procesar la reserva"));
      } finally {
        if (action !== "APPROVED") setProcessing(null);
      }
    },
    [refetchStats, triggerRefetch],
  );

  const confirmApprove = useCallback(async () => {
    if (!confirmData) return;
    setConfirming(true);
    try {
      const data = await reviewAdminReservation(confirmData.reservationId, {
        status: "APPROVED",
      });
      const count = (data.autoRejectedIds || []).length;
      toast.success(
        `Reserva aprobada. ${
          count > 0
            ? `${count} reservas rechazadas automáticamente`
            : "Sin conflictos"
        }`,
      );
      setConfirmData(null);
      refetchStats();
      triggerRefetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Error al aprobar la reserva"));
    } finally {
      setConfirming(false);
      setProcessing(null);
    }
  }, [confirmData, refetchStats, triggerRefetch]);

  const createServiceIcon = (service: string) => {
    const icons: Record<string, React.ElementType> = {
      COWORKING: Building2,
      LAB: FlaskConical,
      AUDITORIUM: Presentation,
      MEETING: MessagesSquare,
    };
    const Icon = icons[service] ?? Building2;
    return <Icon className="h-8 w-8 text-blue-500" />;
  };

  const getServiceName = (service: string) => {
    switch (service) {
      case "COWORKING":
        return "Coworking";
      case "LAB":
        return "Laboratorio";
      case "AUDITORIUM":
        return "Auditorio";
      default:
        return service;
    }
  };

  const isReservationEndingSoon = (endTime: number | null) => {
    if (endTime == null || endTime <= 0) return false;
    const t = now();
    const end = new Date(endTime);
    const diffMinutes = (end.getTime() - t.getTime()) / (1000 * 60);
    return diffMinutes <= 30 && diffMinutes > 0; // Ending in next 30 minutes
  };

  const isReservationOverdue = (endTime: number | null) => {
    if (endTime == null || endTime <= 0) return false;
    const t = now();
    const end = new Date(endTime);
    return end.getTime() < t.getTime();
  };

  const statCards: { title: string; icon: React.ElementType; value: number }[] =
    [
      { title: "Usuarios Hoy", icon: Users, value: stats?.todayUsers || 0 },
      { title: "Esta Semana", icon: TrendingUp, value: stats?.weekUsers || 0 },
      { title: "Este Mes", icon: Calendar, value: stats?.monthUsers || 0 },
      {
        title: "Reservas Pendientes",
        icon: Clock,
        value: stats?.pendingReservations || 0,
      },
    ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Panel de Administración
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Gestiona reservas, usuarios e incidentes de La Nube
          </p>
        </div>
        {loading && !firstTime ? (
          <Loader2
            className="h-5 w-5 animate-spin text-muted-foreground"
            aria-label="Actualizando"
          />
        ) : null}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ title, icon: Icon, value }) => (
          <Card key={title} className="glass-card dark:glass-card-dark">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {firstTime ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Current users */}
      {stats?.currentUsers && stats.currentUsers.length > 0 && (
        <Card className="glass-card dark:glass-card-dark">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Usuarios Actualmente en La Nube
            </CardTitle>
            <CardDescription>
              Usuarios que están usando los espacios ahora
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.currentUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {createServiceIcon(user.service)}
                    <div>
                      <p className="font-medium">
                        {user.name} {user.lastName}
                      </p>
                      <p className="text-sm text-gray-600">
                        {getServiceName(user.service)} • Ingresó:{" "}
                        {new Date(user.checkInTime).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isReservationOverdue(user.reservationEndTime) && (
                      <Badge className="bg-red-100 text-red-800">
                        Tiempo agotado
                      </Badge>
                    )}
                    {isReservationEndingSoon(user.reservationEndTime) &&
                      !isReservationOverdue(user.reservationEndTime) && (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          Termina pronto
                        </Badge>
                      )}
                    <Button size="sm" variant="outline">
                      Check-out
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent reservations */}
      <DashboardRecentReservations
        onAction={handleReservationAction}
        processing={processing}
        refetchKey={refetchKey}
      />

      <Dialog
        open={!!confirmData}
        onOpenChange={(open) => !open && setConfirmData(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar aprobación</DialogTitle>
            <DialogDescription>
              {confirmData?.conflicts?.length
                ? `Aprobar esta reserva rechazará automáticamente ${confirmData.conflicts.length} reservas pendientes.`
                : "No hay conflictos detectados."}
            </DialogDescription>
          </DialogHeader>
          {confirmData?.conflicts?.length ? (
            <div className="max-h-48 overflow-auto text-sm border rounded p-2">
              {confirmData.conflicts.map((id) => (
                <div
                  key={id}
                  className="py-1 border-b last:border-b-0 border-gray-200 dark:border-gray-800"
                >
                  {id}
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setConfirmData(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmApprove} disabled={confirming}>
              {confirming ? "Aprobando..." : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
