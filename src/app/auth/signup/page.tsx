"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

export default function SignUpPage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: session?.user?.name?.split(' ')[0] || '',
    lastName: session?.user?.name?.split(' ').slice(1).join(' ') || '',
    dni: '',
    institution: '',
    reasonToJoin: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          email: session?.user?.email,
          image: session?.user?.image
        }),
      })

      if (response.ok) {
        await update()
        toast.success('Perfil completado exitosamente')
        router.push('/dashboard')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Error al completar el perfil')
      }
    } catch {
      toast.error('Error al completar el perfil')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Background overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-la-nube-primary via-la-nube-secondary to-la-nube-accent opacity-90" />
      
      {/* Content */}
      <Card className="w-full max-w-md relative z-20 glass-card dark:glass-card-dark">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-la-nube-primary flex items-center justify-center mb-4">
            <span className="text-2xl">🌩️</span>
          </div>
          <CardTitle className="text-2xl">Completar Perfil</CardTitle>
          <CardDescription>
            Completa tu información para acceder a La Nube
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
                placeholder="12345678"
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
                required
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Completando...' : 'Completar Perfil'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
