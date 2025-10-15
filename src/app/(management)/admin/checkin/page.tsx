"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Search,
  CheckCircle,
  Clock,
  Users,
  Building2,
  Microscope,
  Calendar,
  AlertTriangle
} from "lucide-react"
import { toast } from "sonner"

interface CurrentUser {
  id: string
  name: string
  lastName: string
  email: string
  dni: string
  checkInTime: string
  reservationEndTime: string
  service: string
  reservationId: string
}

export default function AdminCheckInPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentUsers, setCurrentUsers] = useState<CurrentUser[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [checkOutProcessing, setCheckOutProcessing] = useState<string | null>(null)

  useEffect(() => {
    if (status === "loading") return

    if (!session) {
      router.push("/")
      return
    }

    fetchCurrentUsers()

    // Refresh every 30 seconds
    const interval = setInterval(fetchCurrentUsers, 30000)
    return () => clearInterval(interval)
  }, [session, status, router])

  const fetchCurrentUsers = async () => {
    try {
      const response = await fetch('/api/admin/checkin/current')
      if (response.ok) {
        const data = await response.json()
        setCurrentUsers(data)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleCheckOut = async (userId: string) => {
    setCheckOutProcessing(userId)

    try {
      const response = await fetch(`/api/admin/checkin/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'checkout' }),
      })

      if (response.ok) {
        toast.success('Check-out realizado exitosamente')
        fetchCurrentUsers()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Error al realizar check-out')
      }
    } catch {
      toast.error('Error al realizar check-out')
    } finally {
      setCheckOutProcessing(null)
    }
  }

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'COWORKING':
        return <Building2 className="h-4 w-4 text-blue-500" />
      case 'LAB':
        return <Microscope className="h-4 w-4 text-green-500" />
      case 'AUDITORIUM':
        return <Calendar className="h-4 w-4 text-purple-500" />
      default:
        return <Users className="h-4 w-4 text-gray-500" />
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

  const getTimeInCoworking = (checkInTime: string) => {
    const now = new Date()
    const checkIn = new Date(checkInTime)
    const diffMinutes = Math.floor((now.getTime() - checkIn.getTime()) / (1000 * 60))

    if (diffMinutes < 60) {
      return `${diffMinutes} min`
    } else {
      const hours = Math.floor(diffMinutes / 60)
      const minutes = diffMinutes % 60
      return `${hours}h ${minutes}min`
    }
  }

  const filteredUsers = currentUsers.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.dni.includes(searchTerm)
  )

  const endingSoonUsers = filteredUsers.filter(user =>
    isReservationEndingSoon(user.reservationEndTime)
  )

  const overdueUsers = filteredUsers.filter(user =>
    isReservationOverdue(user.reservationEndTime)
  )

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Check-in / Check-out</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Gestiona el acceso de usuarios a La Nube
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Actuales</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentUsers.length}</div>
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Terminan Pronto</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{endingSoonUsers.length}</div>
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Agotado</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueUsers.length}</div>
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actualizado</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium text-green-600">
              {new Date().toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="glass-card dark:glass-card-dark">
        <CardHeader>
          <CardTitle>Buscar Usuarios</CardTitle>
          <CardDescription>
            Busca usuarios por nombre, apellido, email o DNI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar usuarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Current Users */}
      {filteredUsers.length === 0 ? (
        <Card className="glass-card dark:glass-card-dark">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios en La Nube'}
            </h3>
            <p className="text-gray-500">
              {searchTerm ? 'Intenta con otros términos de búsqueda.' : 'Los usuarios aparecerán aquí cuando hagan check-in.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredUsers.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getServiceIcon(user.service)}
                    <div>
                      <h3 className="font-semibold text-lg">
                        {user.name} {user.lastName}
                      </h3>
                      <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        <p>Email: {user.email}</p>
                        <p>DNI: {user.dni}</p>
                        <p>Servicio: {getServiceName(user.service)}</p>
                        <p>Check-in: {new Date(user.checkInTime).toLocaleTimeString()}</p>
                        <p>Tiempo en La Nube: {getTimeInCoworking(user.checkInTime)}</p>
                        <p>Reserva termina: {new Date(user.reservationEndTime).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <div className="flex gap-2">
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
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => handleCheckOut(user.id)}
                      disabled={checkOutProcessing === user.id}
                      className="min-w-[120px]"
                    >
                      {checkOutProcessing === user.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                          Procesando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Check-out
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
