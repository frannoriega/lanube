"use client";

import Logo from "@/components/atoms/logos/lanube";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

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
import { signInSchema } from "@/lib/auth";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

const registerSchema = z
  .object({
    email: z.email({ message: "Por favor ingresa un email válido" }),
    password: z
      .string()
      .min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
    passwordConfirmation: z
      .string()
      .min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Las contraseñas no coinciden",
    path: ["passwordConfirmation"],
  });

export default function LandingPage() {
  const [fadeIn, setFadeIn] = useState(false);
  const router = useRouter();
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
    },
    mode: "all",
  });

  const [error, setError] = useState<boolean>(false);
  const [isSignIn, setIsSignIn] = useState<boolean>(true);

  useEffect(() => {
    setTimeout(() => {
      setFadeIn(true);
    }, 100);
  }, []);

  // const handleEmailLogin = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   if (!email) {
  //     toast.error("Por favor ingresa tu email");
  //     return;
  //   }

  //   setIsLoading(true);
  //   try {
  //     const response = await fetch("/api/auth/email-login", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({ email }),
  //     });

  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(errorData.message || "Error al enviar el email");
  //     }

  //     toast.success(
  //       "Te hemos enviado un enlace de inicio de sesión a tu email",
  //     );
  //     setEmail("");
  //   } catch (ignored) {
  //     toast.error("Error al enviar el email");
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  const onSubmit = async (data: z.infer<typeof signInSchema>) => {
    setError(false);
    const res = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
      redirectTo: "/user/dashboard",
    });
    if (res?.error) {
      setError(true);
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
    if (!res.ok) {
      const error = await res.json();
      toast.error(error.message || "Error al crear la cuenta");
    }
    const signInRes = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
    console.log(signInRes);
    if (!signInRes.ok) {
      const error = await res.json();
      toast.error(error.message || "Error al crear la cuenta");
    }
    toast.success("Cuenta creada correctamente");
    setTimeout(() => {
      router.push("/auth/signup");
    }, 1000);
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
              <CardTitle className="text-3xl font-bold text-white sr-only">
                La Nube
              </CardTitle>
              <p className="text-white/90">Espacio de Coworking e Innovación</p>
            </CardHeader>
            <CardContent className="bg-transparent w-full flex flex-col gap-6">
              {/* <Tabs defaultValue="google" className="w-full">
                <TabsList className="grid w-full grid-cols-2 glass">
                  <TabsTrigger
                    value="google"
                    className="data-[state=active]:bg-la-nube-selected text-white"
                  >
                    Google
                  </TabsTrigger>
                  <TabsTrigger
                    value="email"
                    className="data-[state=active]:bg-la-nube-selected text-white"
                  >
                    Email
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="google" className="space-y-4 mt-6">
                  <Button
                    onClick={() =>
                      signIn("google", { redirectTo: "/user/dashboard" })
                    }
                    className="w-full bg-slate-700 text-white font-semibold py-6 text-lg"
                    size="lg"
                  >
                    Iniciar Sesión con Google
                  </Button>
                </TabsContent>

                <TabsContent value="email" className="space-y-4 mt-6">
                  <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-white">
                        Email
                      </Label>
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
              </Tabs> */}

              <div className="w-full overflow-hidden">
                <AnimatePresence mode="wait">
                  {isSignIn ? (
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
                                <FormLabel className="text-white data-[error=true]:text-red-200">
                                  Correo electrónico
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    className="bg-la-nube-primary text-white aria-invalid:border-red-300"
                                  />
                                </FormControl>
                                <FormMessage className="text-red-200" />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white data-[error=true]:text-red-200">
                                  Contraseña
                                </FormLabel>
                                <FormControl className="aria-invalid:border-red-300">
                                  <Input
                                    {...field}
                                    type="password"
                                    className="bg-la-nube-primary text-white aria-invalid:border-red-300"
                                  />
                                </FormControl>
                                <FormMessage className="text-red-200" />
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
                            Iniciar Sesión
                          </Button>
                          {error && (
                            <p className="text-red-200 text-sm font-semibold text-center">
                              Correo electrónico o contraseña incorrectos
                            </p>
                          )}
                        </form>
                      </Form>
                      <div className="flex flex-row w-full h-fit items-center gap-2">
                        <Separator
                          orientation="horizontal"
                          className="flex-1"
                        />
                        <span className="text-white">o</span>
                        <Separator
                          orientation="horizontal"
                          className="flex-1"
                        />
                      </div>
                      <Button
                        variant="outline"
                        className="w-full bg-slate-200 hover:bg-slate-300 text-black font-semibold py-6 text-lg"
                        size="lg"
                        onClick={() => setIsSignIn(false)}
                      >
                        Crear una cuenta
                      </Button>
                    </motion.div>
                  ) : (
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
                                <FormLabel className="text-white data-[error=true]:text-red-200">
                                  Correo electrónico
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    className="bg-la-nube-primary text-white aria-invalid:border-red-300"
                                  />
                                </FormControl>
                                <FormMessage className="text-red-200" />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white data-[error=true]:text-red-200">
                                  Contraseña
                                </FormLabel>
                                <FormControl className="aria-invalid:border-red-300">
                                  <Input
                                    {...field}
                                    type="password"
                                    className="bg-la-nube-primary text-white aria-invalid:border-red-300"
                                  />
                                </FormControl>
                                <FormMessage className="text-red-200" />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="passwordConfirmation"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white data-[error=true]:text-red-200">
                                  Confirmar contraseña
                                </FormLabel>
                                <FormControl className="aria-invalid:border-red-300">
                                  <Input
                                    {...field}
                                    type="password"
                                    className="bg-la-nube-primary text-white aria-invalid:border-red-300"
                                  />
                                </FormControl>
                                <FormMessage className="text-red-200" />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="submit"
                            className="w-full bg-slate-200 hover:bg-slate-300 text-black font-semibold py-6 text-lg"
                            size="lg"
                          >
                            Crear cuenta
                          </Button>
                        </form>
                      </Form>
                      <Button
                        variant="outline"
                        className="w-full text-white font-semibold py-2 text-lg"
                        size="lg"
                        onClick={() => setIsSignIn(true)}
                      >
                        Volver a iniciar sesión
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <p className="text-white/80 text-sm text-center">
                Accede a nuestros espacios de coworking, laboratorio y auditorio
              </p>
              <div className="flex w-full justify-center">
                <Link
                  href="/policies/privacy"
                  className="text-white/80 text-sm text-center"
                >
                  Política de privacidad
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
