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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardRecentReservations } from "@/components/templates/admin/dashboard-recent-reservations";
import { getServiceIcon } from "@/lib/constants/services";
import { ResourceType } from "@/generated/prisma/enums";
import {
  Calendar,
  Clock,
  Eye,
  TrendingUp,
  Users,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface AdminStats {
  todayUsers: number;
  weekUsers: number;
  monthUsers: number;
  pendingReservations: number;
  approvedReservations: number;
  rejectedReservations: number;
  currentUsers: {
    id: string;
    name: string;
    lastName: string;
    checkInTime: string;
    reservationEndTime: string;
    service: string;
  }[];
  recentReservations: {
    id: string;
    user: {
      name: string;
      lastName: string;
    };
    service: string;
    startTime: string;
    endTime: string;
    status: string;
    reason: string;
  }[];
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<{
    reservationId: string;
    conflicts: string[];
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  const triggerRefetch = useCallback(() => setRefetchKey((k) => k + 1), []);

  const fetchAdminStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReservationAction = useCallback(
    async (
      reservationId: string,
      action: "APPROVED" | "REJECTED",
      deniedReason?: string
    ) => {
      setProcessing(reservationId);
      try {
        if (action === "APPROVED") {
          const previewRes = await fetch(
            `/api/admin/reservations/${reservationId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: action, preview: true }),
            }
          );
          if (!previewRes.ok) {
            const err = await previewRes.json().catch(() => ({}));
            toast.error(err.message || "No se pudo previsualizar conflictos");
            setProcessing(null);
            return;
          }
          const previewData = await previewRes.json();
          setConfirmData({
            reservationId,
            conflicts: previewData.autoRejectedIds || [],
          });
        } else {
          const response = await fetch(
            `/api/admin/reservations/${reservationId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: action, deniedReason }),
            }
          );
          if (response.ok) {
            toast.success("Reserva rechazada exitosamente");
            fetchAdminStats();
            triggerRefetch();
          } else {
            const error = await response.json();
            toast.error(error.message || "Error al procesar la reserva");
          }
        }
      } catch {
        toast.error("Error al procesar la reserva");
      } finally {
        if (action !== "APPROVED") setProcessing(null);
      }
    },
    [fetchAdminStats, triggerRefetch]
  );

  const confirmApprove = useCallback(async () => {
    if (!confirmData) return;
    setConfirming(true);
    try {
      const res = await fetch(
        `/api/admin/reservations/${confirmData.reservationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "APPROVED" }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "No se pudo aprobar la reserva");
      } else {
        const data = await res.json().catch(() => ({}));
        const count = (data.autoRejectedIds || []).length;
        toast.success(
          `Reserva aprobada. ${count > 0
            ? `${count} reservas rechazadas automáticamente`
            : "Sin conflictos"
          }`
        );
        setConfirmData(null);
        fetchAdminStats();
        triggerRefetch();
      }
    } catch {
      toast.error("Error al aprobar la reserva");
    } finally {
      setConfirming(false);
      setProcessing(null);
    }
  }, [confirmData, fetchAdminStats, triggerRefetch]);

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/");
      return;
    }

    // TODO: Check if user is admin
    fetchAdminStats();
  }, [session, status, router, fetchAdminStats]);

  const createServiceIcon = (service: ResourceType) => {
    const Icon = getServiceIcon(service);
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

  const isReservationEndingSoon = (endTime: string) => {
    const now = new Date();
    const end = new Date(endTime);
    const diffMinutes = (end.getTime() - now.getTime()) / (1000 * 60);
    return diffMinutes <= 30 && diffMinutes > 0; // Ending in next 30 minutes
  };

  const isReservationOverdue = (endTime: string) => {
    const now = new Date();
    const end = new Date(endTime);
    return end.getTime() < now.getTime();
  };

  if (status === "loading" || loading) {
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Panel de Administración
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Gestiona reservas, usuarios e incidentes de La Nube
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Hoy</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayUsers || 0}</div>
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Esta Semana</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.weekUsers || 0}</div>
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Este Mes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.monthUsers || 0}</div>
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Reservas Pendientes
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.pendingReservations || 0}
            </div>
          </CardContent>
        </Card>
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
                    {createServiceIcon(user.service as ResourceType)}
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

      {/* Quick actions */}
      {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                Gestionar Reservas
              </CardTitle>
              <CardDescription>
                Aprobar o rechazar reservas pendientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => router.push('/admin/reservations/coworking')}>
                Ver Reservas
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                Usuarios Actuales
              </CardTitle>
              <CardDescription>
                Ver usuarios actualmente en La Nube
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">
                Ver Usuarios
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Reportar Incidente
              </CardTitle>
              <CardDescription>
                Crear un nuevo reporte de incidente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" onClick={() => router.push('/admin/incidents')}>
                Crear Incidente
              </Button>
            </CardContent>
          </Card>
        </div> */}
    </div>
  );
}
