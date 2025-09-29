"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import UserLayout from "@/components/user-layout"
import { CalendarIcon, Clock, Plus, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Reservation {
  id: string
  service: string
  startTime: string
  endTime: string
  reason: string
  status: string
  createdAt: string
}

export default function CoworkingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedStartTime, setSelectedStartTime] = useState("")
  const [selectedEndTime, setSelectedEndTime] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const timeSlots = [
    "08:00", "09:00", "10:00", "11:00", "12:00", 
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"
  ]

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
      const response = await fetch('/api/reservations?service=COWORKING')
      if (response.ok) {
        const data = await response.json()
        setReservations(data)
      }
    } catch {
      console.error('Error fetching reservations')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedDate || !selectedStartTime || !selectedEndTime || !reason) {
      toast.error("Por favor completa todos los campos")
      return
    }

    setSubmitting(true)

    try {
      const startDateTime = new Date(selectedDate)
      const [startHour, startMinute] = selectedStartTime.split(':')
      startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0)

      const endDateTime = new Date(selectedDate)
      const [endHour, endMinute] = selectedEndTime.split(':')
      endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0)

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: 'COWORKING',
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          reason
        }),
      })

      if (response.ok) {
        toast.success('Reserva solicitada exitosamente')
        setSelectedDate(undefined)
        setSelectedStartTime("")
        setSelectedEndTime("")
        setReason("")
        fetchReservations()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Error al crear la reserva')
      }
    } catch {
      toast.error('Error al crear la reserva')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'PENDING':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'Aprobada'
      case 'REJECTED':
        return 'Rechazada'
      case 'PENDING':
        return 'Pendiente'
      case 'CANCELLED':
        return 'Cancelada'
      default:
        return status
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

  return (
    <UserLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Coworking</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Reserva un espacio de trabajo colaborativo en La Nube
          </p>
        </div>

        <Tabs defaultValue="reserve" className="space-y-4">
          <TabsList>
            <TabsTrigger value="reserve">Nueva Reserva</TabsTrigger>
            <TabsTrigger value="my-reservations">Mis Reservas</TabsTrigger>
          </TabsList>

          <TabsContent value="reserve" className="space-y-4">
            <Card className="glass-card dark:glass-card-dark">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Nueva Reserva de Coworking
                </CardTitle>
                <CardDescription>
                  Selecciona la fecha y hora para tu espacio de coworking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Date selection */}
                    <div className="space-y-2">
                      <Label htmlFor="date">Fecha</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "PPP", { locale: es }) : "Selecciona una fecha"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Start time */}
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Hora de inicio</Label>
                      <Select value={selectedStartTime} onValueChange={setSelectedStartTime}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona hora de inicio" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeSlots.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* End time */}
                    <div className="space-y-2">
                      <Label htmlFor="endTime">Hora de fin</Label>
                      <Select value={selectedEndTime} onValueChange={setSelectedEndTime}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona hora de fin" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeSlots
                            .filter(time => !selectedStartTime || time > selectedStartTime)
                            .map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Reason */}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="reason">Motivo de la reserva</Label>
                      <Textarea
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Describe qué trabajarás en el espacio de coworking..."
                        rows={3}
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? 'Creando reserva...' : 'Crear Reserva'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my-reservations" className="space-y-4">
            <Card className="glass-card dark:glass-card-dark">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Mis Reservas de Coworking
                </CardTitle>
                <CardDescription>
                  Gestiona tus reservas existentes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reservations.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay reservas</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Aún no tienes reservas de coworking.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reservations.map((reservation) => (
                      <div key={reservation.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getStatusIcon(reservation.status)}
                              <span className="font-medium">
                                {format(new Date(reservation.startTime), "PPP", { locale: es })}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <p>
                                {format(new Date(reservation.startTime), "HH:mm", { locale: es })} - 
                                {format(new Date(reservation.endTime), "HH:mm", { locale: es })}
                              </p>
                              <p>{reservation.reason}</p>
                              <p className="text-xs">
                                Creada el {format(new Date(reservation.createdAt), "PPP 'a las' HH:mm", { locale: es })}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              reservation.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                              reservation.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                              reservation.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {getStatusText(reservation.status)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </UserLayout>
  )
}
