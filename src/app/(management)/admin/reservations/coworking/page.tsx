"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from "lucide-react"
import { toast } from "sonner"

interface Reservation {
  id: string
  user: {
    name: string
    lastName: string
    email: string
    dni: string
    institution: string | null
  }
  service: string
  startTime: string
  endTime: string
  reason: string
  status: string
  createdAt: string
}

export default function CoworkingReservationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    if (status === "loading") return

    if (!session) {
      router.push("/")
      return
    }

    fetchReservations()
  }, [session, status, router])

  const fetchReservations = async () => {
    try {
      const response = await fetch('/api/admin/reservations?service=COWORKING')
      if (response.ok) {
        const data = await response.json()
        setReservations(data)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleReservationAction = async (reservationId: string, action: 'APPROVED' | 'REJECTED') => {
    setProcessing(reservationId)

    try {
      const response = await fetch(`/api/admin/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: action }),
      })

      if (response.ok) {
        toast.success(`Reserva ${action === 'APPROVED' ? 'aprobada' : 'rechazada'} exitosamente`)
        fetchReservations()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Error al procesar la reserva')
      }
    } catch {
      toast.error('Error al procesar la reserva')
    } finally {
      setProcessing(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-green-100 text-green-800">Aprobada</Badge>
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-800">Rechazada</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>
      case 'CANCELLED':
        return <Badge className="bg-gray-100 text-gray-800">Cancelada</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const pendingReservations = reservations.filter(r => r.status === 'PENDING')
  const approvedReservations = reservations.filter(r => r.status === 'APPROVED')
  const rejectedReservations = reservations.filter(r => r.status === 'REJECTED')

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-la-nube-primary"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reservas de Coworking</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Gestiona las reservas del espacio de coworking
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReservations.length}</div>
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprobadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedReservations.length}</div>
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rechazadas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedReservations.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Reservations */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pendientes ({pendingReservations.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Aprobadas ({approvedReservations.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Rechazadas ({rejectedReservations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingReservations.length === 0 ? (
            <Card className="glass-card dark:glass-card-dark">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Clock className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No hay reservas pendientes</h3>
                <p className="text-gray-500">Todas las reservas han sido procesadas.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingReservations.map((reservation) => (
                <Card key={reservation.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          {getStatusIcon(reservation.status)}
                          <h3 className="font-semibold text-lg">
                            {reservation.user.name} {reservation.user.lastName}
                          </h3>
                          {getStatusBadge(reservation.status)}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Información del Usuario</p>
                            <p className="text-sm">Email: {reservation.user.email}</p>
                            <p className="text-sm">DNI: {reservation.user.dni}</p>
                            {reservation.user.institution && (
                              <p className="text-sm">Institución: {reservation.user.institution}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Detalles de la Reserva</p>
                            <p className="text-sm">
                              {new Date(reservation.startTime).toLocaleDateString()} -
                              {new Date(reservation.startTime).toLocaleTimeString()} a
                              {new Date(reservation.endTime).toLocaleTimeString()}
                            </p>
                            <p className="text-sm">
                              Creada: {new Date(reservation.createdAt).toLocaleDateString()} a las {new Date(reservation.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Motivo de la reserva:</p>
                          <p className="text-sm bg-gray-50 p-3 rounded-lg">{reservation.reason}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleReservationAction(reservation.id, 'APPROVED')}
                          disabled={processing === reservation.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReservationAction(reservation.id, 'REJECTED')}
                          disabled={processing === reservation.id}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Rechazar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {approvedReservations.length === 0 ? (
            <Card className="glass-card dark:glass-card-dark">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <CheckCircle className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No hay reservas aprobadas</h3>
                <p className="text-gray-500">Las reservas aprobadas aparecerán aquí.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {approvedReservations.map((reservation) => (
                <Card key={reservation.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          {getStatusIcon(reservation.status)}
                          <h3 className="font-semibold text-lg">
                            {reservation.user.name} {reservation.user.lastName}
                          </h3>
                          {getStatusBadge(reservation.status)}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Información del Usuario</p>
                            <p className="text-sm">Email: {reservation.user.email}</p>
                            <p className="text-sm">DNI: {reservation.user.dni}</p>
                            {reservation.user.institution && (
                              <p className="text-sm">Institución: {reservation.user.institution}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Detalles de la Reserva</p>
                            <p className="text-sm">
                              {new Date(reservation.startTime).toLocaleDateString()} -
                              {new Date(reservation.startTime).toLocaleTimeString()} a
                              {new Date(reservation.endTime).toLocaleTimeString()}
                            </p>
                            <p className="text-sm">
                              Creada: {new Date(reservation.createdAt).toLocaleDateString()} a las {new Date(reservation.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Motivo de la reserva:</p>
                          <p className="text-sm bg-gray-50 p-3 rounded-lg">{reservation.reason}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          {rejectedReservations.length === 0 ? (
            <Card className="glass-card dark:glass-card-dark">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <XCircle className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No hay reservas rechazadas</h3>
                <p className="text-gray-500">Las reservas rechazadas aparecerán aquí.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {rejectedReservations.map((reservation) => (
                <Card key={reservation.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          {getStatusIcon(reservation.status)}
                          <h3 className="font-semibold text-lg">
                            {reservation.user.name} {reservation.user.lastName}
                          </h3>
                          {getStatusBadge(reservation.status)}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Información del Usuario</p>
                            <p className="text-sm">Email: {reservation.user.email}</p>
                            <p className="text-sm">DNI: {reservation.user.dni}</p>
                            {reservation.user.institution && (
                              <p className="text-sm">Institución: {reservation.user.institution}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Detalles de la Reserva</p>
                            <p className="text-sm">
                              {new Date(reservation.startTime).toLocaleDateString()} -
                              {new Date(reservation.startTime).toLocaleTimeString()} a
                              {new Date(reservation.endTime).toLocaleTimeString()}
                            </p>
                            <p className="text-sm">
                              Creada: {new Date(reservation.createdAt).toLocaleDateString()} a las {new Date(reservation.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Motivo de la reserva:</p>
                          <p className="text-sm bg-gray-50 p-3 rounded-lg">{reservation.reason}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
