"use client"

import { CoworkingReservationsTemplate } from "@/components/templates/admin/coworking-reservations"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AdminReservationListResult } from "@/lib/db/adminReservations"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

export default function ServiceReservationsPage() {
  const service = useParams<{ service: string }>().service
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reservations, setReservations] = useState<AdminReservationListResult[]>([])
  const [processing, setProcessing] = useState<string | null>(null)
  const [confirmData, setConfirmData] = useState<{ reservationId: string, conflicts: string[] } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const fetchReservations = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/reservations?service=${service}`)
      if (response.ok) {
        const data = await response.json()
        setReservations(data)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [service])

  useEffect(() => {
    if (status === "loading") return

    if (!session) {
      router.push("/")
      return
    }

    fetchReservations()
  }, [session, status, router, fetchReservations])

  const handleReservationAction = async (reservationId: string, action: 'APPROVED' | 'REJECTED', deniedReason?: string) => {
    setProcessing(reservationId)

    try {
      if (action === 'APPROVED') {
        // Preview conflicts first
        const previewRes = await fetch(`/api/admin/reservations/${reservationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: action, preview: true }),
        })
        if (!previewRes.ok) {
          const err = await previewRes.json().catch(() => ({}))
          toast.error(err.message || 'No se pudo previsualizar conflictos')
          setProcessing(null)
          return
        }
        const previewData = await previewRes.json()
        setConfirmData({ reservationId, conflicts: previewData.autoRejectedIds || [] })
      } else {
        // Directly reject with reason
        const response = await fetch(`/api/admin/reservations/${reservationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: action, deniedReason }),
        })
        if (response.ok) {
          toast.success('Reserva rechazada exitosamente')
          fetchReservations()
        } else {
          const error = await response.json()
          toast.error(error.message || 'Error al procesar la reserva')
        }
      }
    } catch {
      toast.error('Error al procesar la reserva')
    } finally {
      if (action !== 'APPROVED') setProcessing(null)
    }
  }

  const confirmApprove = async () => {
    if (!confirmData) return
    setConfirming(true)
    try {
      const res = await fetch(`/api/admin/reservations/${confirmData.reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.message || 'No se pudo aprobar la reserva')
      } else {
        const data = await res.json().catch(() => ({}))
        const count = (data.autoRejectedIds || []).length
        toast.success(`Reserva aprobada. ${count > 0 ? `${count} reservas rechazadas automáticamente` : 'Sin conflictos'}`)
        setConfirmData(null)
        fetchReservations()
      }
    } catch {
      toast.error('Error al aprobar la reserva')
    } finally {
      setConfirming(false)
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
    <>
      <CoworkingReservationsTemplate
        reservations={reservations}
        onAction={handleReservationAction}
        processing={processing}
      />

      <Dialog open={!!confirmData} onOpenChange={(open) => !open && setConfirmData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar aprobación</DialogTitle>
            <DialogDescription>
              {confirmData?.conflicts?.length
                ? `Aprobar esta reserva rechazará automáticamente ${confirmData.conflicts.length} reservas pendientes.`
                : 'No hay conflictos detectados.'}
            </DialogDescription>
          </DialogHeader>
          {confirmData?.conflicts?.length ? (
            <div className="max-h-48 overflow-auto text-sm border rounded p-2">
              {confirmData.conflicts.map((id) => (
                <div key={id} className="py-1 border-b last:border-b-0 border-gray-200 dark:border-gray-800">{id}</div>
              ))}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setConfirmData(null)}>Cancelar</Button>
            <Button onClick={confirmApprove} disabled={confirming}>{confirming ? 'Aprobando...' : 'Confirmar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
