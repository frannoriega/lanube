"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import Logo from "@/components/atoms/logos/lanube";
import { z } from "zod";
import {
  dniSchema,
  sanitizeDni,
  signupProfileSchema,
} from "@/lib/schemas/profile";

/**
 * Las mismas reglas que valida `POST /api/auth/signup` (`signupProfileSchema`); solo cambia el
 * DNI, que el input ya entrega como número (el servidor acepta además texto).
 */
const signUpSchema = signupProfileSchema.extend({ dni: dniSchema });

export default function SignUpPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: standardSchemaResolver(signUpSchema),
    defaultValues: {
      name: session?.user?.name?.split(" ")[0] || "",
      lastName: session?.user?.name?.split(" ").slice(1).join(" ") || "",
      dni: undefined,
      institution: "",
      reasonToJoin: "",
    },
    // Mismo modo que las vistas de ingreso/registro (milestone 40, F2).
    mode: "onTouched",
  });
  const [loading, setLoading] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);
  const { reasonToJoin } = form.watch();

  useEffect(() => {
    setCharacterCount(reasonToJoin.length);
  }, [reasonToJoin]);

  const handleSubmit = async (data: z.infer<typeof signUpSchema>) => {
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          email: session?.user?.email,
          image: session?.user?.image,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        await update({
          ...session,
          user: {
            ...session?.user,
            signedUp: data.signedUp,
          },
        });
        toast.success("Perfil completado exitosamente");
        setTimeout(() => {
          router.push("/user/dashboard");
        }, 1000);
      } else {
        // F1.7: this branch used to optimistically set `signedUp: true` on FAILURE —
        // exactly backwards. It was also inert: the jwt() callback takes only { token }
        // and recomputes signedUp/banned/role/permissions from the DB on every call,
        // deliberately ignoring NextAuth's `trigger`/`session` arguments, so a client
        // update() can never forge session state. Removed rather than "fixed".
        const error = await response.json().catch(() => ({}));
        toast.error(error.message || "Error al completar el perfil");
      }
    } catch {
      toast.error("Error al completar el perfil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Content */}
      <Card className="w-full max-w-md relative z-20 glass-card">
        <CardHeader className="text-center flex flex-col items-center">
          {/* La Nube Logo */}
          <div className="flex flex-col items-center bg-slate-100 p-8 w-fit rounded-full">
            <Logo size={200} />
          </div>
          <CardTitle className="text-2xl">Completar Perfil</CardTitle>
          <CardDescription className="text-slate-700">
            Completa tu información para acceder a La Nube
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              // POST explícito (milestone 40, F2): si se envía antes de que cargue el JS, un GET
              // pondría el email y la contraseña en la URL (historial, logs del servidor).
              method="post"
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              {/* Nombre + Apellido van siempre de a par (par semántico). DNI e Institución
                  ocupan el ancho completo por debajo de `sm`: en un teléfono de 390px el par
                  quedaba apretado (milestone 14, "fine as-is" con este ajuste). */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="items-start h-fit">
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-slate-200" />
                      </FormControl>
                      <FormDescription className="sr-only">
                        Ingresá tu nombre
                      </FormDescription>
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
                        <Input {...field} className="bg-slate-200" />
                      </FormControl>
                      <FormDescription className="sr-only">
                        Ingresá tu apellido
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dni"
                  render={({ field }) => (
                    <FormItem className="col-span-2 items-start h-fit sm:col-span-1">
                      <FormLabel>DNI</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          value={
                            field.value === undefined ||
                            Number.isNaN(field.value)
                              ? ""
                              : field.value
                          }
                          onChange={(e) => {
                            const digits = sanitizeDni(e.target.value);
                            field.onChange(
                              digits === "" ? undefined : Number(digits),
                            );
                          }}
                          className="bg-slate-200"
                        />
                      </FormControl>
                      <FormDescription className="sr-only">
                        Ingresá tu DNI
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="institution"
                  render={({ field }) => (
                    <FormItem className="col-span-2 items-start h-fit sm:col-span-1">
                      <FormLabel className="h-fit">Institución</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-slate-200" />
                      </FormControl>
                      <FormDescription className="sr-only">
                        Ingresá tu institución
                      </FormDescription>
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
                        <Textarea
                          {...field}
                          maxLength={500}
                          className="bg-slate-200 max-h-40"
                        />
                      </FormControl>
                      <p className="w-full text-right text-sm text-slate-700">
                        {characterCount}/500
                      </p>
                      <FormDescription className="sr-only">
                        Ingresá tu motivo para unirte
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button
                type="submit"
                variant="brand"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Completando..." : "Completar Perfil"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
