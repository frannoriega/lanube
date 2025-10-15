"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

const signUpSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres" }),
  lastName: z.string().min(3, { message: "El apellido debe tener al menos 3 caracteres" }),
  dni: z.number({ message: "Ingrese su DNI" }).min(0, { message: "El DNI debe ser un número" }).max(99999999, { message: "El DNI debe tener al menos 8 caracteres" }),
  institution: z.string().optional(),
  reasonToJoin: z.string().min(20, { message: "El motivo debe tener al menos 20 caracteres" }).max(500, { message: "El motivo debe tener menos de 500 caracteres" })
})

export default function SignUpPage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: standardSchemaResolver(signUpSchema),
    defaultValues: {
      name: session?.user?.name?.split(' ')[0] || '',
      lastName: session?.user?.name?.split(' ').slice(1).join(' ') || '',
      dni: undefined,
      institution: '',
      reasonToJoin: ''
    }
  })
  const [loading, setLoading] = useState(false)
  const [characterCount, setCharacterCount] = useState(0)
  const { reasonToJoin } = form.watch()

  useEffect(() => {
    setCharacterCount(reasonToJoin.length)
  }, [reasonToJoin])

  const handleSubmit = async (data: z.infer<typeof signUpSchema>) => {
    setLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          email: session?.user?.email,
          image: session?.user?.image
        }),
      })

      if (response.ok) {
        const data = await response.json()
        await update({
          ...session,
          user: {
            ...session?.user,
            signedUp: data.signedUp
          }
        })
        toast.success('Perfil completado exitosamente')
        setTimeout(() => {
          router.push('/user/dashboard')
        }, 1000)
      } else {
        await update({
          ...session,
          user: {
            ...session?.user,
            signedUp: true
          }
        })
        const error = await response.json()
        toast.error(error.message || 'Error al completar el perfil')
      }
    } catch {
      toast.error('Error al completar el perfil')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">


      {/* Content */}
      <Card className="w-full max-w-md relative z-20 glass-card text-white">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-la-nube-primary flex items-center justify-center mb-4">
            <span className="text-2xl">🌩️</span>
          </div>
          <CardTitle className="text-2xl">Completar Perfil</CardTitle>
          <CardDescription className="text-white">
            Completa tu información para acceder a La Nube
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 text-white">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="items-start h-fit">
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormDescription className="sr-only">Ingresa tu nombre</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem className="items-start h-fit">
                      <FormLabel>Apellido</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormDescription className="sr-only">Ingresa tu apellido</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dni"
                  render={({ field }) => (
                    <FormItem className="items-start h-fit">
                      <FormLabel>DNI</FormLabel>
                      <FormControl>
                        <Input {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                      </FormControl>
                      <FormDescription className="sr-only">Ingresa tu DNI</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="institution"
                  render={({ field }) => (
                    <FormItem className="items-start h-fit">
                      <FormLabel className="h-fit">Institución</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormDescription className="sr-only">Ingresa tu institución</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reasonToJoin"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Motivo para unirse</FormLabel>
                      <FormControl>
                        <Textarea {...field} maxLength={500} />
                      </FormControl>
                      <p className="w-full text-right text-sm text-muted-foreground">{characterCount}/500</p>
                      <FormDescription className="sr-only">Ingresa tu motivo para unirse</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Completando...' : 'Completar Perfil'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}