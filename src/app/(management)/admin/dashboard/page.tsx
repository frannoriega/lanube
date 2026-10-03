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
import { ApprovalConflictsDialog } from "@/components/organisms/admin/approval-conflicts-dialog";
import { StatGrid, StatTile } from "@/components/molecules/stat-grid";
import { useServerTime } from "@/components/providers/server-time";
import { DashboardRecentReservations } from "@/components/templates/admin/dashboard-recent-reservations";
import { useAdminStats } from "@/hooks/api";
import { apiErrorMessage } from "@/lib/api/client";
import { reviewAdminReservation } from "@/lib/api/mutations";
import type {
  ApprovalConflict,
  ApprovalPreview,
} from "@/lib/reservations/approval-conflicts";
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
  type LucideIcon,
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
  /** Aprobación pendiente de confirmar: solo existe cuando rechazaría otras reservas. */
  const [confirmData, setConfirmData] = useState<{
    reservationId: string;
    conflicts: ApprovalConflict[];
    space: ApprovalPreview["space"];
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  const triggerRefetch = useCallback(() => setRefetchKey((k) => k + 1), []);

  /** Aprueba de verdad (sin `preview`) y avisa cuántas reservas se rechazaron en cascada. */
  const commitApprove = useCallback(
    async (reservationId: string) => {
      setConfirming(true);
      try {
        const data = await reviewAdminReservation(reservationId, {
          status: "APPROVED",
        });
        const count = (data.autoRejectedIds || []).length;
        toast.success(
          count > 0
            ? `Reserva aprobada. ${count} reservas rechazadas automáticamente`
            : "Reserva aprobada",
        );
        setConfirmData(null);
        refetchStats();
        triggerRefetch();
      } catch (err) {
        toast.error(apiErrorMessage(err, "Error al aprobar la reserva"));
      } finally {
        setConfirming(false);
      }
    },
    [refetchStats, triggerRefetch],
  );

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
          const conflicts = preview.conflicts ?? [];
          // Sin conflictos no hay nada que confirmar: se aprueba directo. El diálogo solo
          // aparece cuando aprobar va a rechazar automáticamente otras reservas.
          if (conflicts.length === 0) {
            await commitApprove(reservationId);
            return;
          }
          setConfirmData({
            reservationId,
            conflicts,
            space: preview.space ?? null,
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
        setProcessing(null);
      }
    },
    [commitApprove, refetchStats, triggerRefetch],
  );

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

  const statCards: { title: string; icon: LucideIcon; value: number }[] = [
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

      {/* Stats cards — grilla compartida, 2×2 compacta en teléfonos */}
      <StatGrid>
        {statCards.map(({ title, icon, value }) => (
          <StatTile
            key={title}
            title={title}
            icon={icon}
            value={value}
            loading={firstTime}
          />
        ))}
      </StatGrid>

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
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {getServiceName(user.service)} • Ingresó:{" "}
                        {new Date(user.checkInTime).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isReservationOverdue(user.reservationEndTime) && (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                        Tiempo agotado
                      </Badge>
                    )}
                    {isReservationEndingSoon(user.reservationEndTime) &&
                      !isReservationOverdue(user.reservationEndTime) && (
                        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
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

      <ApprovalConflictsDialog
        preview={confirmData}
        onCancel={() => setConfirmData(null)}
        onConfirm={() =>
          confirmData && commitApprove(confirmData.reservationId)
        }
        confirming={confirming}
      />
    </div>
  );
}
