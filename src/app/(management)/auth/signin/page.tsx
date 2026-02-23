"use client";

import Logo from "@/components/atoms/logos/lanube";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Turnstile } from '@marsidev/react-turnstile'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { registerSchema, resetSchema, signInSchema } from "@/lib/schemas/auth";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

export default function LandingPage() {
  const [fadeIn, setFadeIn] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [requireCaptcha, setRequireCaptcha] = useState(false);
  const [screen, setScreen] = useState<"signin" | "register" | "reset">("signin");

  useEffect(() => {
    const confirmed = searchParams.get("confirmed");
    const error = searchParams.get("error");
    if (confirmed === "1") {
      toast.success("Correo confirmado. Inicia sesión para continuar.");
      router.replace("/auth/signin", { scroll: false });
    } else if (error === "invalid_or_expired_token") {
      toast.error("El enlace de confirmación ha expirado o no es válido.");
      router.replace("/auth/signin", { scroll: false });
    } else if (error === "missing_token") {
      toast.error("Enlace de confirmación inválido.");
      router.replace("/auth/signin", { scroll: false });
    } else if (error === "verification_failed") {
      toast.error("No pudimos verificar tu correo. Intenta de nuevo.");
      router.replace("/auth/signin", { scroll: false });
    }
  }, [searchParams, router]);

  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: standardSchemaResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: standardSchemaResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      passwordConfirmation: "",
      captcha: "",
    },
    mode: "all",
  });
  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: standardSchemaResolver(resetSchema),
    defaultValues: {
      email: "",
      captcha: "",
    },
  });
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    setTimeout(() => {
      setFadeIn(true);
    }, 100);
  }, []);

  const onSubmit = async (data: z.infer<typeof signInSchema>) => {
    setError(false);
    const res = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
      redirectTo: "/user/dashboard",
    });
    if (res?.error) {
      if (res?.code === "email_not_verified") {
        toast.error(
          "Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada."
        );
      } else {
        setError(true);
      }
    }
    if (res?.url) {
      router.replace(res.url);
    }
  };

  const onRegisterSubmit = async (data: z.infer<typeof registerSchema>) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    registerForm.reset();
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.message || "Error al crear la cuenta");
      return;
    }
    toast.success(
      body.message ??
      "Revisa tu correo para confirmar tu cuenta y continuar con el registro."
    );
    setScreen("signin");
  };

  const onResetSubmit = async (data: z.infer<typeof resetSchema>) => {
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.message || "Error al enviar el enlace de acceso");
      return;
    }
    toast.success(
      body.message ??
      "Te hemos enviado un enlace de acceso a tu email"
    );
    setScreen("signin");
  };

  const renderScreen = () => {
    switch (screen) {
      case "signin":
        return (
          <motion.div
            key="A"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
          >
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="data-[error=true]:text-red-600">
                        Correo electrónico
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-slate-200 aria-invalid:border-red-600"
                        />
                      </FormControl>
                      <FormMessage className="text-red-600" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="data-[error=true]:text-red-600">
                        Contraseña
                      </FormLabel>
                      <FormControl className="aria-invalid:border-red-600">
                        <div className="flex flex-col w-full h-fit items-center gap-1">
                          <Input
                            {...field}
                            type="password"
                            className="bg-slate-200 aria-invalid:border-red-600"
                          />
                          <div className="flex flex-row w-full justify-end h-fit items-center gap-2">
                            <Link
                              href="#"
                              onClick={() => setScreen("reset")}
                              className="text-sm text-center text-blue-900"
                            >
                              Olvidé mi contraseña
                            </Link>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-600" />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full bg-slate-200 hover:bg-slate-300 text-black font-semibold py-6 text-lg"
                  size="lg"
                  disabled={
                    !form.formState.isValid ||
                    form.formState.isSubmitting
                  }
                >
                  {form.formState.isSubmitting ? "Iniciando sesión..." : "Iniciar Sesión"}
                </Button>
                {error && (
                  <p className="text-red-600 text-sm font-semibold text-center">
                    Correo electrónico o contraseña incorrectos
                  </p>
                )}
              </form>
            </Form>
            <div className="flex flex-row w-full h-fit items-center gap-2 py-2">
              <Separator
                orientation="horizontal"
                className="flex-1 bg-slate-800"
              />
              <span className="text-slate-800 font-semibold">ó</span>
              <Separator
                orientation="horizontal"
                className="flex-1 bg-slate-800"
              />
            </div>
            <Button
              variant="outline"
              className="w-full bg-slate-200 hover:bg-slate-300 text-black font-semibold py-6 text-lg"
              size="lg"
              onClick={() => setScreen("register")}
            >
              Crear una cuenta
            </Button>
          </motion.div>
        );
      case "register":
        return (
          <motion.div
            key="B"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.3 }}
            className="w-full flex-col flex gap-4"
          >
            <Form {...registerForm}>
              <form
                onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={registerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="data-[error=true]:text-red-600">
                        Correo electrónico
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-slate-200 aria-invalid:border-red-600"
                        />
                      </FormControl>
                      <FormMessage className="text-red-600" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="data-[error=true]:text-red-600">
                        Contraseña
                      </FormLabel>
                      <FormControl className="aria-invalid:border-red-600">
                        <Input
                          {...field}
                          type="password"
                          className="bg-slate-200 aria-invalid:border-red-600"
                        />
                      </FormControl>
                      <FormMessage className="text-red-600" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="passwordConfirmation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="data-[error=true]:text-red-600">
                        Confirmar contraseña
                      </FormLabel>
                      <FormControl className="aria-invalid:border-red-600">
                        <Input
                          {...field}
                          type="password"
                          className="bg-slate-200 aria-invalid:border-red-600"
                        />
                      </FormControl>
                      <FormMessage className="text-red-600" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="captcha"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Turnstile
                          className={`w-full rounded-md overflow-hidden ${!requireCaptcha && "hidden"}`}
                          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ?? '1x00000000000000000000AA'}
                          options={{
                            action: 'submit-form',
                            size: 'flexible',
                            language: 'es',
                          }}
                          scriptOptions={{
                            appendTo: 'body'
                          }}
                          onBeforeInteractive={() => setRequireCaptcha(true)}
                          onSuccess={(token) => field.onChange(token)}
                          onExpire={() => field.onChange("")}
                          onError={() => field.onChange("")}
                        />
                      </FormControl>
                      <FormMessage className="text-red-600" />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full bg-slate-200 hover:bg-slate-300 text-black font-semibold py-6 text-lg"
                  size="lg"
                  disabled={registerForm.formState.isSubmitting || !registerForm.formState.isValid}
                >
                  {registerForm.formState.isSubmitting ? "Registrando..." : "Crear cuenta"}
                </Button>
              </form>
            </Form>
            <Button
              variant="outline"
              className="w-full font-semibold py-2 text-lg"
              size="lg"
              onClick={() => setScreen("signin")}
            >
              Volver a iniciar sesión
            </Button>
          </motion.div>
        );
      case "reset":
        return (
          <motion.div key="C"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="w-full flex-col flex gap-4"
          >
            <Form {...resetForm}>
              <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
                <FormField control={resetForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="data-[error=true]:text-red-600">
                      Correo electrónico
                    </FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-slate-200 aria-invalid:border-red-600" />
                    </FormControl>
                    <FormMessage className="text-red-600" />
                  </FormItem>
                )}
                />
                <FormField
                  control={resetForm.control}
                  name="captcha"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Turnstile
                          className={`w-full rounded-md overflow-hidden`}
                          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ?? '1x00000000000000000000AA'}
                          options={{
                            action: 'submit-form',
                            size: 'flexible',
                            language: 'es',
                          }}
                          scriptOptions={{
                            appendTo: 'body'
                          }}
                          onBeforeInteractive={() => setRequireCaptcha(true)}
                          onSuccess={(token) => field.onChange(token)}
                          onExpire={() => field.onChange("")}
                          onError={() => field.onChange("")}
                        />
                      </FormControl>
                      <FormMessage className="text-red-600" />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full bg-slate-200 hover:bg-slate-300 text-black font-semibold py-6 text-lg" size="lg" disabled={resetForm.formState.isSubmitting || !resetForm.formState.isValid}>
                  {resetForm.formState.isSubmitting ? "Enviando..." : "Enviar enlace de acceso"}
                </Button>
              </form>
            </Form>
            <Button
              variant="outline"
              className="w-full font-semibold py-2 text-lg"
              size="lg"
              onClick={() => setScreen("signin")}
            >
              Volver a iniciar sesión
            </Button>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center relative transition-opacity duration-1000 ${fadeIn ? "opacity-100" : "opacity-0"}`}
    >
      {/* Content with fade-in animation */}
      <div className={`relative z-20 max-w-md w-full space-y-8 p-8`}>
        <Card className="glass-card">
          <CardHeader className="text-center flex flex-col items-center">
            {/* La Nube Logo */}
            <div className="flex flex-col items-center bg-slate-100 p-8 w-fit rounded-full">
              <Logo size={200} />
            </div>
            <CardTitle className="text-3xl font-bold sr-only">
              La Nube
            </CardTitle>
            <p>Espacio de Coworking e Innovación</p>
          </CardHeader>
          <CardContent className="bg-transparent w-full flex flex-col gap-6">
            <div className="w-full overflow-hidden">
              <AnimatePresence mode="wait">
                {renderScreen()}
              </AnimatePresence>
            </div>
            <p className="text-sm text-center">
              Accede a nuestros espacios de coworking, laboratorio y auditorio
            </p>
            <div className="flex w-full justify-center">
              <Link
                href="/policies/privacy"
                className="text-sm text-center"
              >
                Política de privacidad
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
