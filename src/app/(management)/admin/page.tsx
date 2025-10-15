"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Users, 
  Calendar, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye
} from "lucide-react"

interface AdminStats {
  todayUsers: number
  weekUsers: number
  monthUsers: number
  pendingReservations: number
  approvedReservations: number
  rejectedReservations: number
  currentUsers: {
    id: string
    name: string
    lastName: string
    checkInTime: string
    reservationEndTime: string
    service: string
  }[]
  recentReservations: {
    id: string
    user: {
      name: string
      lastName: string
    }
    service: string
    startTime: string
    endTime: string
    status: string
    reason: string
  }[]
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AdminStats | null>(null)

  const fetchAdminStats = async () => {
    try {
      const response = await fetch('/api/admin/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/")
      return
    }

    // TODO: Check if user is admin
    fetchAdminStats()
  }, [session, status, router, fetchAdminStats])


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-green-100 text-green-800">Aprobada</Badge>
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-800">Rechazada</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>
    }
  }

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'COWORKING':
        return <Users className="h-4 w-4 text-blue-500" />
      case 'LAB':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'AUDITORIUM':
        return <Calendar className="h-4 w-4 text-purple-500" />
      default:
        return <Calendar className="h-4 w-4 text-gray-500" />
    }
  }

  const getServiceName = (service: string) => {
    switch (service) {
      case 'COWORKING':
        return 'Coworking'
      case 'LAB':
        return 'Laboratorio'
      case 'AUDITORIUM':
        return 'Auditorio'
      default:
        return service
    }
  }

  const isReservationEndingSoon = (endTime: string) => {
    const now = new Date()
    const end = new Date(endTime)
    const diffMinutes = (end.getTime() - now.getTime()) / (1000 * 60)
    return diffMinutes <= 30 && diffMinutes > 0 // Ending in next 30 minutes
  }

  const isReservationOverdue = (endTime: string) => {
    const now = new Date()
    const end = new Date(endTime)
    return end.getTime() < now.getTime()
  }

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Panel de Administración</h1>
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
              <CardTitle className="text-sm font-medium">Reservas Pendientes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pendingReservations || 0}</div>
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
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getServiceIcon(user.service)}
                      <div>
                        <p className="font-medium">{user.name} {user.lastName}</p>
                        <p className="text-sm text-gray-600">
                          {getServiceName(user.service)} • 
                          Ingresó: {new Date(user.checkInTime).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isReservationOverdue(user.reservationEndTime) && (
                        <Badge className="bg-red-100 text-red-800">
                          Tiempo agotado
                        </Badge>
                      )}
                      {isReservationEndingSoon(user.reservationEndTime) && !isReservationOverdue(user.reservationEndTime) && (
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
        {stats?.recentReservations && stats.recentReservations.length > 0 && (
          <Card className="glass-card dark:glass-card-dark">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Reservas Recientes
              </CardTitle>
              <CardDescription>
                Últimas reservas solicitadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recentReservations.slice(0, 5).map((reservation) => (
                  <div key={reservation.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getServiceIcon(reservation.service)}
                      <div>
                        <p className="font-medium">
                          {reservation.user.name} {reservation.user.lastName}
                        </p>
                        <p className="text-sm text-gray-600">
                          {getServiceName(reservation.service)} • 
                          {new Date(reservation.startTime).toLocaleDateString()} - 
                          {new Date(reservation.startTime).toLocaleTimeString()} a 
                          {new Date(reservation.endTime).toLocaleTimeString()}
                        </p>
                        <p className="text-xs text-gray-500">{reservation.reason}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(reservation.status)}
                      {reservation.status === 'PENDING' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="text-green-600 border-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Aprobar
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-600">
                            <XCircle className="h-3 w-3 mr-1" />
                            Rechazar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </div>
      </div>
  )
}
