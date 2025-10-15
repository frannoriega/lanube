"use client"

import { CoworkingReservationsTemplate } from "@/components/templates/admin/coworking-reservations"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface Reservation {
  id: string
  registeredUser: {
    name: string
    lastName: string
    user: {
      email: string
    }
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
        console.log("reservations", data)
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
    <CoworkingReservationsTemplate
      reservations={reservations}
      onAction={handleReservationAction}
      processing={processing}
    />
  )
}
