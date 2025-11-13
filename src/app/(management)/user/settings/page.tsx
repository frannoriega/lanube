"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { toast } from "sonner"
import z from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const formSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres" }),
  lastName: z.string().min(3, { message: "El apellido debe tener al menos 3 caracteres" }),
  dni: z.coerce.number({ message: "Ingrese su DNI" }).min(0, { message: "El DNI debe ser un número positivo" }).max(999999999, { message: "El DNI debe tener menos de 9 dígitos" }),
  institution: z.string().optional(),
  reasonToJoin: z.string().min(20, { message: "El motivo debe tener al menos 20 caracteres" }).max(500, { message: "El motivo debe tener menos de 500 caracteres" })
})

type SettingsFormValues = z.infer<typeof formSchema>

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
  const [saving, setSaving] = useState(false)
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(formSchema) as Resolver<SettingsFormValues>,
    defaultValues: {
      name: "",
      lastName: "",
      dni: Number.NaN,
      institution: "",
      reasonToJoin: "",
    },
  })

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await fetch('/api/user/profile')
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        form.reset({
          name: userData.name || "",
          lastName: userData.lastName || "",
          dni: userData.dni ? Number(userData.dni) : Number.NaN,
          institution: userData.institution || "",
          reasonToJoin: userData.reasonToJoin || "",
        })
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/")
      return
    }

    fetchUserProfile()
  }, [session, status, router, fetchUserProfile])

  const onSubmit = async (values: SettingsFormValues) => {
    setSaving(true)

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          dni: values.dni.toString(),
        }),
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
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre</FormLabel>
                          <FormControl>
                            <Input placeholder="Tu nombre" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apellido</FormLabel>
                          <FormControl>
                            <Input placeholder="Tu apellido" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="dni"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DNI</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            placeholder="Número de documento"
                              value={Number.isNaN(field.value) ? "" : field.value ?? ""}
                              onChange={(event) => {
                                const nextValue = event.target.value
                                field.onChange(nextValue === "" ? Number.NaN : Number(nextValue))
                              }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="institution"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Institución (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Universidad, empresa, etc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reasonToJoin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Motivo para unirse</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Cuéntanos por qué quieres usar La Nube..."
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </form>
              </Form>
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
