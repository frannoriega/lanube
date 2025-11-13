"use client"

import Logo from "@/components/atoms/logos/lanube"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { signIn } from "next-auth/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export default function LandingPage() {
  const [fadeIn, setFadeIn] = useState(false);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setFadeIn(true);
    }, 100);
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Por favor ingresa tu email");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/email-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al enviar el email");
      }

      toast.success("Te hemos enviado un enlace de inicio de sesión a tu email");
      setEmail("");
    } catch (ignored) {
      toast.error("Error al enviar el email");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* {!init && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4 animate-pulse">
              <span className="text-2xl">🌩️</span>
            </div>
            <div className="text-la-nube-accent font-semibold">Cargando La Nube...</div>
          </div>
        </div>
      )} */}
      <div className={`min-h-screen flex items-center justify-center relative transition-opacity duration-1000 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>

        {/* Content with fade-in animation */}
        <div className={`relative z-20 max-w-md w-full space-y-8 p-8`}>
          <Card className="glass-card">
            <CardHeader className="text-center flex flex-col items-center">
              {/* La Nube Logo */}
              <div className="flex flex-col items-center bg-slate-100 p-8 w-fit rounded-full">
                <Logo size={200}/>
              </div>
              <CardTitle className="text-3xl font-bold text-white sr-only">
                La Nube
              </CardTitle>
              <p className="text-white/90">
                Espacio de Coworking e Innovación
              </p>
            </CardHeader>
            <CardContent className="bg-transparent">
              <Tabs defaultValue="google" className="w-full">
                <TabsList className="grid w-full grid-cols-2 glass">
                  <TabsTrigger value="google" className="data-[state=active]:bg-la-nube-selected text-white">Google</TabsTrigger>
                  <TabsTrigger value="email" className="data-[state=active]:bg-la-nube-selected text-white">Email</TabsTrigger>
                </TabsList>

                <TabsContent value="google" className="space-y-4 mt-6">
                  <Button
                    onClick={() => signIn("google", { redirectTo: "/user/dashboard" })}
                    className="w-full bg-slate-700 text-white font-semibold py-6 text-lg"
                    size="lg"
                  >
                    Iniciar Sesión con Google
                  </Button>
                </TabsContent>

                <TabsContent value="email" className="space-y-4 mt-6">
                  <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-white">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="glass text-white placeholder:text-white/60"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-slate-700 text-white font-semibold py-6 text-lg"
                      size="lg"
                      disabled={isLoading}
                    >
                      {isLoading ? "Enviando..." : "Enviar enlace de acceso"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <p className="text-white/80 text-sm text-center mt-6">
                Accede a nuestros espacios de coworking, laboratorio y auditorio
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}