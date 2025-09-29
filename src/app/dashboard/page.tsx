"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import UserLayout from "@/components/user-layout"
import { Building2, Microscope, Users, Calendar, Clock, TrendingUp } from "lucide-react"
import { useSession } from "next-auth/react"

interface DashboardStats {
  upcomingReservations: number
  totalTimeThisWeek: number
  totalTimeThisMonth: number
  recentReservations: {
    id: string
    service: string
    startTime: string
    endTime: string
    status: string
    reason: string
  }[]
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log(session)
    console.log(status)
    if (status === "loading") return
    
    if (!session) {
      router.push("/")
      return
    }

    fetchDashboardStats()
  }, [status])

  const fetchDashboardStats = async () => {
    try {
      console.log("Fetching dashboard stats")
      const response = await fetch('/api/dashboard/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <UserLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-la-nube-primary"></div>
        </div>
      </UserLayout>
    )
  }

  if (!session) {
    return null
  }

  const services = [
    {
      name: "Coworking",
      description: "Reserva un espacio de trabajo colaborativo",
      icon: Building2,
      href: "/coworking",
      color: "bg-blue-500"
    },
    {
      name: "Laboratorio",
      description: "Accede a equipamiento especializado",
      icon: Microscope,
      href: "/lab",
      color: "bg-green-500"
    },
    {
      name: "Auditorio",
      description: "Organiza eventos y presentaciones",
      icon: Users,
      href: "/auditorium",
      color: "bg-purple-500"
    }
  ]

  return (
    <UserLayout>
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

        {/* Services */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Servicios Disponibles</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => {
              const Icon = service.icon
              return (
                <Card key={service.name} className="hover:shadow-md transition-shadow glass-card dark:glass-card-dark">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${service.color} text-white`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{service.name}</CardTitle>
                        <CardDescription>{service.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button asChild className="w-full">
                      <a href={service.href}>Acceder</a>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
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
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        reservation.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
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
    </UserLayout>
  )
}
