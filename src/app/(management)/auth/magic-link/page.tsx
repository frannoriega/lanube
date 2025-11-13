"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export default function MagicLinkPage() {
  const [isValidating, setIsValidating] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Token inválido")
        setIsValidating(false)
        return
      }

      try {
        // Decode the token (in a real app, you'd validate against a database)
        const decoded = Buffer.from(token, 'base64').toString('utf-8')
        const [email, timestamp] = decoded.split(':')
        
        // Check if token is not expired (24 hours)
        const tokenTime = parseInt(timestamp)
        const now = Date.now()
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours
        
        if (now - tokenTime > maxAge) {
          setError("El enlace ha expirado. Por favor solicita uno nuevo.")
          setIsValidating(false)
          return
        }

        // Create user session (in a real app, you'd create a proper session)
        const response = await fetch("/api/auth/magic-link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, token }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || "Error al validar el enlace")
        }

        toast.success("¡Inicio de sesión exitoso!")
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push("/dashboard")
        }, 2000)

      } catch (error: unknown) {
        const knownError = error as Error;
        setError(knownError.message || "Error al validar el enlace")
        setIsValidating(false)
      }
    }

    validateToken()
  }, [token, router])

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-800">
        <Card className="glass-card dark:glass-card-dark max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-la-nube-primary flex items-center justify-center mb-4">
              <div className="text-2xl">🌩️</div>
            </div>
            <CardTitle className="text-2xl">Validando enlace...</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-la-nube-primary mx-auto"></div>
            <p className="text-muted-foreground mt-4">
              Por favor espera mientras validamos tu enlace de acceso.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-800">
        <Card className="glass-card dark:glass-card-dark max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-red-500 flex items-center justify-center mb-4">
              <div className="text-2xl text-white">⚠️</div>
            </div>
            <CardTitle className="text-2xl text-red-600">Enlace Inválido</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Button 
              onClick={() => router.push("/")}
              className="w-full glass-button"
            >
              Volver al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-800">
      <Card className="glass-card dark:glass-card-dark max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-500 flex items-center justify-center mb-4">
            <div className="text-2xl text-white">✅</div>
          </div>
          <CardTitle className="text-2xl text-green-600">¡Éxito!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Tu inicio de sesión fue exitoso. Te redirigiremos al dashboard en un momento...
          </p>
          <Button 
            onClick={() => router.push("/dashboard")}
            className="w-full glass-button"
          >
            Ir al Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
