"use client";

import Logo from "@/components/atoms/logos/lanube";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { safeCallbackUrl, signInUrl } from "@/lib/signin/callback-url";
import { useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  allPoliciesChecked,
  PolicyCheckboxes,
  type PolicyToAccept,
} from "@/components/organisms/policies/policy-checkboxes";
import { Separator } from "@/components/ui/separator";
import {
  recoverySchema,
  registerSchema,
  resetSchema,
  signInSchema,
} from "@/lib/schemas/auth";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { signIn } from "next-auth/react";
import {
  browserSupportsWebAuthn,
  PasskeyCancelledError,
  passkeyErrorMessage,
  signInWithPasskey,
} from "@/lib/passkeys/client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

/**
 * Pantalla de ingreso / registro / recuperación. La renderiza `page.tsx` (servidor), que le
 * pasa las políticas que hoy hay que aceptar para crear una cuenta (milestone 19).
 */
export function SignInScreen({
  requiredPolicies,
}: {
  requiredPolicies: PolicyToAccept[];
}) {
  const [fadeIn, setFadeIn] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  // A dónde volver después de ingresar (milestone 20: la pantalla de autorización OAuth
  // manda acá con `?callbackUrl=`). Validado: solo rutas internas permitidas.
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));
  const registerCaptchaRef = useRef<TurnstileInstance>(undefined);
  const resetCaptchaRef = useRef<TurnstileInstance>(undefined);
  const recoveryCaptchaRef = useRef<TurnstileInstance>(undefined);
  const [screen, setScreen] = useState<
    "signin" | "register" | "reset" | "recovery"
  >("signin");

  useEffect(() => {
    const confirmed = searchParams.get("confirmed");
    const error = searchParams.get("error");
    if (confirmed === "1") {
      toast.success("Correo confirmado. Inicia sesión para continuar.");
      router.replace(signInUrl(callbackUrl), { scroll: false });
    } else if (error === "invalid_or_expired_token") {
      toast.error("El enlace de confirmación ha expirado o no es válido.");
      router.replace(signInUrl(callbackUrl), { scroll: false });
    } else if (error === "missing_token") {
      toast.error("Enlace de confirmación inválido.");
      router.replace(signInUrl(callbackUrl), { scroll: false });
    } else if (error === "verification_failed") {
      toast.error("No pudimos verificar tu correo. Intenta de nuevo.");
      router.replace(signInUrl(callbackUrl), { scroll: false });
    }
  }, [searchParams, router, callbackUrl]);

  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: standardSchemaResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  // Además de lo que valida `registerSchema`, del lado del cliente se exige tildar cada
  // política requerida (el servidor lo vuelve a chequear contra el registro).
  const registerFormSchema = registerSchema.refine(
    (d) => allPoliciesChecked(requiredPolicies, d.acceptedPolicies),
    {
      message: "Tenés que aceptar las políticas para crear la cuenta",
      path: ["acceptedPolicies"],
    },
  );
  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: standardSchemaResolver(registerFormSchema),
    defaultValues: {
      email: "",
      password: "",
      passwordConfirmation: "",
      captcha: "",
      acceptedPolicies: [],
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
  // Recuperar la cuenta con un código de recuperación (milestone 17).
  const recoveryForm = useForm<z.infer<typeof recoverySchema>>({
    resolver: standardSchemaResolver(recoverySchema),
    defaultValues: {
      email: "",
      code: "",
      password: "",
      passwordConfirmation: "",
      captcha: "",
    },
  });
  const [error, setError] = useState<boolean>(false);
  // Passkeys (milestone 17). `null` hasta montar: la detección mira `window`.
  const [passkeySupported, setPasskeySupported] = useState<boolean | null>(
    null,
  );
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  useEffect(() => {
    setPasskeySupported(browserSupportsWebAuthn());
  }, []);

  const onPasskeySignIn = async () => {
    setError(false);
    setPasskeyBusy(true);
    try {
      const url = await signInWithPasskey(callbackUrl);
      // Navegación completa por la misma razón que en `onSubmit` (Router Cache).
      window.location.href = url;
    } catch (err) {
      if (!(err instanceof PasskeyCancelledError)) {
        toast.error(
          passkeyErrorMessage(
            err,
            "No pudimos iniciar sesión. Intenta de nuevo.",
          ),
        );
      }
      setPasskeyBusy(false);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      setFadeIn(true);
    }, 100);
  }, []);

  const onSubmit = async (data: z.infer<typeof signInSchema>) => {
    setError(false);
    try {
      const res = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
        redirectTo: callbackUrl,
      });
      if (res?.error) {
        if (res?.code === "email_not_verified") {
          toast.error(
            "Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.",
          );
        } else {
          setError(true);
        }
        return;
      }
      if (res?.url) {
        // Hard navigation on purpose: a client-side router.replace() can be
        // served from Next.js's Router Cache, which may still hold a stale
        // logged-out redirect for the target route (e.g. from a prefetch
        // before sign-in) and silently no-op on the first attempt while the
        // session cookie has actually been set. A full reload always hits
        // the server fresh with the new cookie.
        window.location.href = res.url;
      } else {
        toast.error("No pudimos iniciar sesión. Intenta de nuevo.");
      }
    } catch (err) {
      console.error("[signin] signIn() failed", err);
      toast.error("No pudimos iniciar sesión. Intenta de nuevo.");
    }
  };

  const onRegisterSubmit = async (data: z.infer<typeof registerSchema>) => {
    let res: Response;
    let body: { message?: string };
    try {
      res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      body = await res.json().catch(() => ({}));
    } catch (err) {
      // A rejected fetch (offline, DNS, aborted) never reaches the !res.ok branch.
      console.error("[signin] register request failed", err);
      toast.error(
        "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.",
      );
      return;
    } finally {
      // Turnstile tokens are single-use and consumed by this request (the server
      // verifies before it can fail), so a fresh token is always required for the
      // next attempt. Reset the captcha field + widget instead of the whole form
      // so the user keeps their corrected inputs and the button re-enables.
      registerForm.setValue("captcha", "");
      registerCaptchaRef.current?.reset();
    }
    if (!res.ok) {
      toast.error(body.message || "Error al crear la cuenta");
      // 409: una política cambió mientras el formulario estaba abierto. Se recarga la lista
      // (la página de servidor la vuelve a leer del registro) y se destildan, para que la
      // persona vea y acepte la versión nueva.
      if (res.status === 409) {
        registerForm.setValue("acceptedPolicies", [], {
          shouldValidate: true,
        });
        router.refresh();
      }
      return;
    }
    registerForm.reset();
    toast.success(
      body.message ??
        "Revisa tu correo para confirmar tu cuenta y continuar con el registro.",
    );
    setScreen("signin");
  };

  /**
   * Canjea el código (que deja puesta la contraseña nueva) y entra con esa contraseña. Si
   * el canje salió bien pero el ingreso no, la contraseña ya cambió: se avisa y se vuelve
   * al formulario normal.
   */
  const onRecoverySubmit = async (data: z.infer<typeof recoverySchema>) => {
    let res: Response;
    let body: { message?: string };
    try {
      res = await fetch("/api/auth/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      body = await res.json().catch(() => ({}));
    } catch (err) {
      console.error("[signin] recovery request failed", err);
      toast.error(
        "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.",
      );
      return;
    } finally {
      // Igual que en el registro: el token de Turnstile es de un solo uso.
      recoveryForm.setValue("captcha", "");
      recoveryCaptchaRef.current?.reset();
    }
    if (!res.ok) {
      toast.error(body.message || "No pudimos recuperar la cuenta");
      return;
    }
    try {
      const signed = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
        redirectTo: callbackUrl,
      });
      if (signed?.url && !signed.error) {
        toast.success(
          "Listo: ya tenés tu contraseña nueva. Generá códigos nuevos si te quedan pocos.",
        );
        window.location.href = signed.url;
        return;
      }
      if (signed?.code === "email_not_verified") {
        toast.error(
          "Tu contraseña cambió, pero tenés que confirmar tu correo antes de entrar.",
        );
      } else {
        toast.success("Tu contraseña cambió. Iniciá sesión con ella.");
      }
    } catch (err) {
      console.error("[signin] signIn() after recovery failed", err);
      toast.success("Tu contraseña cambió. Iniciá sesión con ella.");
    }
    recoveryForm.reset();
    setScreen("signin");
  };

  const onResetSubmit = async (data: z.infer<typeof resetSchema>) => {
    let res: Response;
    let body: { message?: string };
    try {
      res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      body = await res.json().catch(() => ({}));
    } catch (err) {
      console.error("[signin] reset request failed", err);
      toast.error(
        "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.",
      );
      return;
    } finally {
      // The captcha token is single-use and spent by this request; mint a fresh
      // one so a retry after a failure isn't stuck with a stale token.
      resetForm.setValue("captcha", "");
      resetCaptchaRef.current?.reset();
    }
    if (!res.ok) {
      toast.error(body.message || "Error al enviar el enlace de acceso");
      return;
    }
    toast.success(
      body.message ?? "Te hemos enviado un enlace de acceso a tu email",
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
            // Mismo ritmo vertical (gap-4) que los campos del formulario: sin esto,
            // "Iniciar Sesión" y "Entrar con passkey" quedaban pegados.
            className="flex flex-col gap-4"
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
                    !form.formState.isValid || form.formState.isSubmitting
                  }
                >
                  {form.formState.isSubmitting
                    ? "Iniciando sesión..."
                    : "Iniciar Sesión"}
                </Button>
                {error && (
                  <p className="text-red-600 text-sm font-semibold text-center">
                    Correo electrónico o contraseña incorrectos
                  </p>
                )}
              </form>
            </Form>
            {passkeySupported ? (
              <Button
                type="button"
                variant="outline"
                className="w-full border-slate-400 bg-white hover:bg-slate-100 text-slate-900 font-semibold py-6 text-base"
                size="lg"
                onClick={onPasskeySignIn}
                disabled={passkeyBusy}
              >
                <KeyRound className="h-5 w-5" aria-hidden />
                {passkeyBusy ? "Esperando tu passkey…" : "Entrar con passkey"}
              </Button>
            ) : null}
            <div className="flex flex-row w-full h-fit items-center gap-2">
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
                {requiredPolicies.length > 0 && (
                  <FormField
                    control={registerForm.control}
                    name="acceptedPolicies"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <PolicyCheckboxes
                            policies={requiredPolicies}
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage className="text-red-600" />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={registerForm.control}
                  name="captcha"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Turnstile
                          ref={registerCaptchaRef}
                          className="w-full rounded-md overflow-hidden"
                          siteKey={
                            process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ??
                            "1x00000000000000000000AA"
                          }
                          options={{
                            action: "submit-form",
                            size: "flexible",
                            language: "es",
                            // Let Cloudflare manage visibility: the widget only
                            // appears if interaction is required. Never hide it
                            // with `display:none` (Tailwind `hidden`) — a
                            // Turnstile iframe inside a hidden container can't
                            // run its challenge, which made the captcha appear
                            // to "fail" and only resolve once un-hidden.
                            appearance: "interaction-only",
                          }}
                          scriptOptions={{
                            appendTo: "body",
                          }}
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
                  disabled={
                    registerForm.formState.isSubmitting ||
                    !registerForm.formState.isValid
                  }
                >
                  {registerForm.formState.isSubmitting
                    ? "Registrando..."
                    : "Crear cuenta"}
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
          <motion.div
            key="C"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="w-full flex-col flex gap-4"
          >
            <Form {...resetForm}>
              <form
                onSubmit={resetForm.handleSubmit(onResetSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={resetForm.control}
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
                  control={resetForm.control}
                  name="captcha"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Turnstile
                          ref={resetCaptchaRef}
                          className={`w-full rounded-md overflow-hidden`}
                          siteKey={
                            process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ??
                            "1x00000000000000000000AA"
                          }
                          options={{
                            action: "submit-form",
                            size: "flexible",
                            language: "es",
                          }}
                          scriptOptions={{
                            appendTo: "body",
                          }}
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
                  disabled={
                    resetForm.formState.isSubmitting ||
                    !resetForm.formState.isValid
                  }
                >
                  {resetForm.formState.isSubmitting
                    ? "Enviando..."
                    : "Enviar enlace de acceso"}
                </Button>
              </form>
            </Form>
            <button
              type="button"
              onClick={() => setScreen("recovery")}
              className="text-sm text-center text-blue-900 underline-offset-4 hover:underline"
            >
              ¿Ya no tenés acceso a tu email? Usá un código de recuperación
            </button>
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
      case "recovery":
        return (
          <motion.div
            key="D"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="w-full flex-col flex gap-4"
          >
            <p className="text-sm text-slate-800">
              Ingresá uno de los códigos de recuperación que guardaste y elegí
              una contraseña nueva. Cada código sirve una sola vez.
            </p>
            <Form {...recoveryForm}>
              <form
                onSubmit={recoveryForm.handleSubmit(onRecoverySubmit)}
                className="space-y-4"
              >
                <FormField
                  control={recoveryForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="data-[error=true]:text-red-600">
                        Correo electrónico
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="username"
                          className="bg-slate-200 aria-invalid:border-red-600"
                        />
                      </FormControl>
                      <FormMessage className="text-red-600" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={recoveryForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="data-[error=true]:text-red-600">
                        Código de recuperación
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="one-time-code"
                          autoCapitalize="characters"
                          spellCheck={false}
                          placeholder="XXXX-XXXX-XXXX"
                          className="bg-slate-200 font-mono uppercase aria-invalid:border-red-600"
                        />
                      </FormControl>
                      <FormMessage className="text-red-600" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={recoveryForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="data-[error=true]:text-red-600">
                        Contraseña nueva
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="new-password"
                          className="bg-slate-200 aria-invalid:border-red-600"
                        />
                      </FormControl>
                      <FormMessage className="text-red-600" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={recoveryForm.control}
                  name="passwordConfirmation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="data-[error=true]:text-red-600">
                        Confirmar contraseña nueva
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="new-password"
                          className="bg-slate-200 aria-invalid:border-red-600"
                        />
                      </FormControl>
                      <FormMessage className="text-red-600" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={recoveryForm.control}
                  name="captcha"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Turnstile
                          ref={recoveryCaptchaRef}
                          className="w-full rounded-md overflow-hidden"
                          siteKey={
                            process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ??
                            "1x00000000000000000000AA"
                          }
                          options={{
                            action: "submit-form",
                            size: "flexible",
                            language: "es",
                          }}
                          scriptOptions={{
                            appendTo: "body",
                          }}
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
                  disabled={recoveryForm.formState.isSubmitting}
                >
                  {recoveryForm.formState.isSubmitting
                    ? "Recuperando..."
                    : "Recuperar mi cuenta"}
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
      <div className={`relative z-20 max-w-md w-full space-y-4 p-8`}>
        {/* Way out of the auth flow — this page is reachable directly (and is where
            signing out lands), so it can't rely on browser history to get home. */}
        <Link
          href="/"
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-blue-900 transition-opacity hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>

        <Card className="glass-card">
          <CardHeader className="text-center flex flex-col items-center">
            {/* La Nube Logo — also a way home, the convention everywhere else in the app. */}
            <Link
              href="/"
              aria-label="Ir al inicio de La Nube"
              className="flex flex-col items-center bg-slate-100 p-8 w-fit rounded-full transition-opacity hover:opacity-90"
            >
              <Logo size={200} />
            </Link>
            <CardTitle className="text-3xl font-bold sr-only">
              La Nube
            </CardTitle>
            <p>Espacio de Coworking e Innovación</p>
          </CardHeader>
          <CardContent className="bg-transparent w-full flex flex-col gap-6">
            {/* px-1 -mx-1: the slide transition needs overflow-hidden, but a
                zero-padding clip box crops the inputs' focus ring on the
                left/right edges. Padding gives the ring room; the matching
                negative margin keeps the visible width unchanged. */}
            <div className="w-full overflow-hidden px-1 -mx-1">
              <AnimatePresence mode="wait">{renderScreen()}</AnimatePresence>
            </div>
            <p className="text-sm text-center">
              Accede a nuestros espacios de coworking, laboratorio y auditorio
            </p>
            <div className="flex w-full justify-center">
              <Link href="/policies/privacy" className="text-sm text-center">
                Política de privacidad
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
