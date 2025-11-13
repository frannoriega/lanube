"use client";
import { ReservationCard } from "@/components/organisms/admin/reservation-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminReservationListResult } from "@/lib/db/adminReservations";
import { CheckCircle, Clock, XCircle } from "lucide-react";

export function CoworkingReservationsTemplate({
  reservations,
  onAction,
  processing,
}: {
  reservations: AdminReservationListResult[];
  onAction: (id: string, action: "APPROVED" | "REJECTED", reason?: string) => void;
  processing: string | null;
}) {
  const pending = reservations.filter((r) => r.status === "PENDING");
  const approved = reservations.filter((r) => r.status === "APPROVED");
  const rejected = reservations.filter((r) => r.status === "REJECTED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reservas de Coworking</h1>
        <p className="text-gray-600 dark:text-gray-300">Gestiona las reservas del espacio de coworking</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pending.length}</div>
          </CardContent>
        </Card>
        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprobadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approved.length}</div>
          </CardContent>
        </Card>
        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rechazadas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejected.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pendientes ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Aprobadas ({approved.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Rechazadas ({rejected.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pending.length === 0 ? (
            <Card className="glass-card dark:glass-card-dark">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Clock className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No hay reservas pendientes</h3>
                <p className="text-gray-500">Todas las reservas han sido procesadas.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(
                pending.reduce((acc: Record<string, AdminReservationListResult[]>, r: AdminReservationListResult) => {
                  const key = new Date(r.startTime).toISOString().slice(0, 10);
                  (acc[key] ||= []).push(r);
                  return acc;
                }, {})
              ).sort((a, b) => a[0].localeCompare(b[0])).map(([date, items]) => (
                <div key={date} className="space-y-3">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{new Date(date).toLocaleDateString()}</div>
                  <div className="space-y-3">
                    {items.sort((a: AdminReservationListResult, b: AdminReservationListResult) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).map((reservation: AdminReservationListResult) => (
                      <ReservationCard key={reservation.id} reservation={reservation} onAction={onAction} processing={processing} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {approved.length === 0 ? (
            <Card className="glass-card dark:glass-card-dark">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <CheckCircle className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No hay reservas aprobadas</h3>
                <p className="text-gray-500">Las reservas aprobadas aparecerán aquí.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {approved.map((reservation) => (
                <ReservationCard key={reservation.id} reservation={reservation} onAction={onAction} processing={processing} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          {rejected.length === 0 ? (
            <Card className="glass-card dark:glass-card-dark">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <XCircle className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No hay reservas rechazadas</h3>
                <p className="text-gray-500">Las reservas rechazadas aparecerán aquí.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {rejected.map((reservation) => (
                <ReservationCard key={reservation.id} reservation={reservation} onAction={onAction} processing={processing} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}


