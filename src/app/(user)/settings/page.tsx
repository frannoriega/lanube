"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{
    id: string
    name: string
    lastName: string
    email: string
    dni: string
    institution: string | null
    reasonToJoin: string
    role: string
    createdAt: string
    updatedAt: string
  } | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    lastName: "",
    dni: "",
    institution: "",
    reasonToJoin: ""
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/")
      return
    }

    fetchUserProfile()
  }, [session, status, router])

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/user/profile')
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        setFormData({
          name: userData.name || "",
          lastName: userData.lastName || "",
          dni: userData.dni || "",
          institution: userData.institution || "",
          reasonToJoin: userData.reasonToJoin || ""
        })
      }
    } catch {
      console.error('Error fetching user profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success('Perfil actualizado exitosamente')
        fetchUserProfile()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Error al actualizar el perfil')
      }
    } catch {
      toast.error('Error al actualizar el perfil')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configuración</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Gestiona tu información personal y preferencias
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Information */}
          <Card className="glass-card dark:glass-card-dark">
            <CardHeader>
              <CardTitle>Información Personal</CardTitle>
              <CardDescription>
                Actualiza tu información personal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nombre</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Apellido</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="dni">DNI</Label>
                  <Input
                    id="dni"
                    name="dni"
                    value={formData.dni}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="institution">Institución (opcional)</Label>
                  <Input
                    id="institution"
                    name="institution"
                    value={formData.institution}
                    onChange={handleChange}
                    placeholder="Universidad, empresa, etc."
                  />
                </div>

                <div>
                  <Label htmlFor="reasonToJoin">Motivo para unirse</Label>
                  <Textarea
                    id="reasonToJoin"
                    name="reasonToJoin"
                    value={formData.reasonToJoin}
                    onChange={handleChange}
                    placeholder="Cuéntanos por qué quieres usar La Nube..."
                    rows={3}
                    required
                  />
                </div>

                <Button type="submit" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card className="glass-card dark:glass-card-dark">
            <CardHeader>
              <CardTitle>Información de Cuenta</CardTitle>
              <CardDescription>
                Detalles de tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input
                  value={session.user?.email || ""}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  El email no se puede cambiar
                </p>
              </div>

              <div>
                <Label>Fecha de registro</Label>
                <Input
                  value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : ""}
                  disabled
                  className="bg-gray-50"
                />
              </div>

              <div>
                <Label>Rol</Label>
                <Input
                  value={user?.role === 'ADMIN' ? 'Administrador' : 'Usuario'}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  )
}
