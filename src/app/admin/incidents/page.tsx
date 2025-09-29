"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertTriangle,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react"
import { toast } from "sonner"

interface Incident {
  id: string
  subject: string
  description: string
  status: string
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  incidentUsers: {
    user: {
      name: string
      lastName: string
      email: string
      dni: string
    }
  }[]
}

export default function IncidentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("ALL")
  const [creating, setCreating] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newIncident, setNewIncident] = useState({
    subject: "",
    description: ""
  })

  useEffect(() => {
    if (status === "loading") return

    if (!session) {
      router.push("/")
      return
    }

    fetchIncidents()
  }, [session, status, router])

  const fetchIncidents = async () => {
    try {
      const response = await fetch('/api/admin/incidents')
      if (response.ok) {
        const data = await response.json()
        setIncidents(data)
      }
    } catch {
      console.error('Error fetching incidents')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateIncident = async () => {
    if (!newIncident.subject || !newIncident.description) {
      toast.error("Por favor completa todos los campos")
      return
    }

    setCreating(true)

    try {
      const response = await fetch('/api/admin/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newIncident),
      })

      if (response.ok) {
        toast.success('Incidente creado exitosamente')
        setNewIncident({ subject: "", description: "" })
        setShowCreateDialog(false)
        fetchIncidents()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Error al crear el incidente')
      }
    } catch {
      toast.error('Error al crear el incidente')
    } finally {
      setCreating(false)
    }
  }

  const handleStatusChange = async (incidentId: string, newStatus: string) => {
    setProcessing(incidentId)

    try {
      const response = await fetch(`/api/admin/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        toast.success(`Incidente ${newStatus === 'RESOLVED' ? 'resuelto' : newStatus === 'CLOSED' ? 'cerrado' : 'actualizado'} exitosamente`)
        fetchIncidents()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Error al actualizar el incidente')
      }
    } catch {
      toast.error('Error al actualizar el incidente')
    } finally {
      setProcessing(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <Badge className="bg-red-100 text-red-800">Abierto</Badge>
      case 'RESOLVED':
        return <Badge className="bg-green-100 text-green-800">Resuelto</Badge>
      case 'CLOSED':
        return <Badge className="bg-gray-100 text-gray-800">Cerrado</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'RESOLVED':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'CLOSED':
        return <XCircle className="h-4 w-4 text-gray-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch = incident.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatus === "ALL" || incident.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  const openIncidents = incidents.filter(i => i.status === 'OPEN').length
  const resolvedIncidents = incidents.filter(i => i.status === 'RESOLVED').length
  const closedIncidents = incidents.filter(i => i.status === 'CLOSED').length

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Incidentes</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Gestiona y reporta incidentes en La Nube
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />
              Reportar Incidente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Reportar Nuevo Incidente</DialogTitle>
              <DialogDescription>
                Crea un nuevo reporte de incidente. Se registrarán automáticamente todos los usuarios presentes en La Nube.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="subject">Asunto</Label>
                <Input
                  id="subject"
                  value={newIncident.subject}
                  onChange={(e) => setNewIncident(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Describe brevemente el incidente"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={newIncident.description}
                  onChange={(e) => setNewIncident(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Proporciona detalles del incidente"
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateIncident} disabled={creating}>
                {creating ? 'Creando...' : 'Crear Incidente'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abiertos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{openIncidents}</div>
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resueltos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{resolvedIncidents}</div>
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cerrados</CardTitle>
            <XCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-300">{closedIncidents}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-card dark:glass-card-dark">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar incidentes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="OPEN">Abiertos</SelectItem>
                  <SelectItem value="RESOLVED">Resueltos</SelectItem>
                  <SelectItem value="CLOSED">Cerrados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Incidents List */}
      {filteredIncidents.length === 0 ? (
        <Card className="glass-card dark:glass-card-dark">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchTerm || selectedStatus !== "ALL" ? 'No se encontraron incidentes' : 'No hay incidentes reportados'}
            </h3>
            <p className="text-gray-500">
              {searchTerm || selectedStatus !== "ALL"
                ? 'Intenta con otros filtros de búsqueda.'
                : 'Los incidentes reportados aparecerán aquí.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredIncidents.map((incident) => (
            <Card key={incident.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      {getStatusIcon(incident.status)}
                      <h3 className="font-semibold text-lg">{incident.subject}</h3>
                      {getStatusBadge(incident.status)}
                    </div>

                    <div className="mb-4">
                      <p className="text-gray-700">{incident.description}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Fechas</p>
                        <p className="text-sm">
                          Creado: {new Date(incident.createdAt).toLocaleDateString()} a las {new Date(incident.createdAt).toLocaleTimeString()}
                        </p>
                        {incident.resolvedAt && (
                          <p className="text-sm">
                            Resuelto: {new Date(incident.resolvedAt).toLocaleDateString()} a las {new Date(incident.resolvedAt).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Usuarios Presentes</p>
                        <p className="text-sm">{incident.incidentUsers.length} usuarios</p>
                      </div>
                    </div>

                    {incident.incidentUsers.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Usuarios presentes durante el incidente:</p>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {incident.incidentUsers.map((incidentUser, index) => (
                              <div key={index} className="text-sm">
                                {incidentUser.user.name} {incidentUser.user.lastName} - {incidentUser.user.email}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    {incident.status === 'OPEN' && (
                      <Select onValueChange={(value) => handleStatusChange(incident.id, value)}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Acción" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RESOLVED">Resolver</SelectItem>
                          <SelectItem value="CLOSED">Cerrar</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {incident.status === 'RESOLVED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(incident.id, 'CLOSED')}
                        disabled={processing === incident.id}
                      >
                        {processing === incident.id ? 'Procesando...' : 'Cerrar'}
                      </Button>
                    )}
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
