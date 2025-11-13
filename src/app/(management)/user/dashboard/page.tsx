"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, TrendingUp } from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface DashboardStats {
  upcomingReservations: number
  totalTimeThisWeek: number
  totalTimeThisMonth: number
  recentReservations: {
    id: string
    service: string
    serviceType: string
    startTime: string
    endTime: string
    status: string
    reason: string | null
  }[]
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "loading") return

    if (!session) {
      router.push("/")
      return
    }

    fetchDashboardStats()
  }, [router, session, status])

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/user/stats', { cache: "no-store" })
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (ignored) {
      toast.error("Error al obtener las estadísticas")
    } finally {
      setLoading(false)
    }
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
        {/* Welcome section */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            ¡Bienvenido, {session.user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Gestiona tus reservas y accede a los servicios de La Nube
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="glass-card dark:glass-card-dark">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próximas Reservas</CardTitle>
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
              <CardTitle className="text-sm font-medium">Reservas Totales</CardTitle>
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Reservas Recientes</h2>
            <Card className="glass-card dark:glass-card-dark">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {stats.recentReservations.slice(0, 5).map((reservation, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{reservation.service}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(reservation.startTime).toLocaleDateString()} -
                          {new Date(reservation.startTime).toLocaleTimeString()} a
                          {new Date(reservation.endTime).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${reservation.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          reservation.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                        }`}>
                        {reservation.status === 'APPROVED' ? 'Aprobada' :
                          reservation.status === 'PENDING' ? 'Pendiente' : 'Rechazada'}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
  )
}
