"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Logo from "@/components/atoms/logos/lanube";
import { redirect, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { newPasswordSchema } from "@/lib/schemas/auth";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import z from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const form = useForm<z.infer<typeof newPasswordSchema>>({
    resolver: standardSchemaResolver(newPasswordSchema),
    defaultValues: {
      password: "",
      passwordConfirmation: "",
    },
    mode: "onChange",
  });
  const token = searchParams.get("token");
  if (!token) {
    return redirect("/auth/signin");
  }

  const decodedToken = decodeURIComponent(token);

  const onSubmit = async (data: z.infer<typeof newPasswordSchema>) => {
    const res = await fetch("/api/auth/reset", {
      method: "PATCH",
      body: JSON.stringify({
        token: decodedToken,
        ...data,
      }),
    });
    if (!res.ok) {
      toast.error("Error al reestablecer la contraseña");
      return;
    }
    toast.success("Contraseña reestablecida correctamente");
    setTimeout(() => {
      router.push("/auth/signin");
    }, 1000);
  };
  return (
    <div className="min-h-screen flex items-center justify-center">
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
          <CardContent className="w-full flex flex-col gap-6 items-center">
            <h1 className="text-2xl font-bold">Reestablece tu contraseña</h1>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 w-full"
              >
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
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
                  name="passwordConfirmation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar contraseña</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          {...field}
                          className="bg-slate-200 aria-invalid:border-red-600"
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
                    form.formState.isSubmitting || !form.formState.isValid
                  }
                >
                  {form.formState.isSubmitting
                    ? "Reestableciendo..."
                    : "Reestablecer contraseña"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
