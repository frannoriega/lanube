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
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage, apiSend, invalidateApi } from "@/lib/api/client";
import {
  siteConfigInputSchema,
  type SiteConfigInput,
} from "@/lib/schemas/config";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const EMPTY: SiteConfigInput = {
  addressText: "",
  addressUrl: "",
  email: "",
  phoneText: "",
  phoneClickable: "",
  instagramUrl: "",
  instagramText: "",
  githubUrl: "",
  githubText: "",
};

const FIELDS: Array<{
  section: string;
  items: Array<{
    name: keyof SiteConfigInput;
    label: string;
    placeholder: string;
    hint?: string;
  }>;
}> = [
  {
    section: "Dirección",
    items: [
      {
        name: "addressText",
        label: "Texto a mostrar",
        placeholder:
          "Maipú esquina Posadas, Concepción del Uruguay, Entre Ríos",
      },
      {
        name: "addressUrl",
        label: "Enlace del mapa",
        placeholder: "https://www.google.com/maps/…",
        hint: "Se abre al hacer clic en la dirección (Google Maps u otro).",
      },
    ],
  },
  {
    section: "Contacto",
    items: [
      {
        name: "email",
        label: "Email",
        placeholder: "correo@ejemplo.com",
      },
      {
        name: "phoneText",
        label: "Teléfono (a mostrar)",
        placeholder: "(+54) 9 3442 550836",
      },
      {
        name: "phoneClickable",
        label: "Teléfono (para llamar)",
        placeholder: "+5493442550836",
        hint: "Solo dígitos, con prefijo internacional. Usado en el enlace tel:.",
      },
    ],
  },
  {
    section: "Redes sociales",
    items: [
      {
        name: "instagramUrl",
        label: "Instagram — enlace",
        placeholder: "https://www.instagram.com/…",
      },
      {
        name: "instagramText",
        label: "Instagram — texto",
        placeholder: "lanubepolotec",
      },
      {
        name: "githubUrl",
        label: "GitHub — enlace",
        placeholder: "https://github.com/…",
      },
      {
        name: "githubText",
        label: "GitHub — texto",
        placeholder: "lanube",
      },
    ],
  },
];

export function SiteConfigManager() {
  const { data, firstTime } = useApi<SiteConfigInput>("/api/admin/site-config");
  const [busy, setBusy] = useState(false);

  const form = useForm<SiteConfigInput>({
    resolver: zodResolver(siteConfigInputSchema),
    defaultValues: EMPTY,
  });

  const { reset } = form;
  useEffect(() => {
    if (data) {
      reset({
        addressText: data.addressText,
        addressUrl: data.addressUrl,
        email: data.email,
        phoneText: data.phoneText,
        phoneClickable: data.phoneClickable,
        instagramUrl: data.instagramUrl,
        instagramText: data.instagramText,
        githubUrl: data.githubUrl,
        githubText: data.githubText,
      });
    }
  }, [data, reset]);

  const onSubmit = async (values: SiteConfigInput) => {
    setBusy(true);
    try {
      await apiSend("/api/admin/site-config", "PUT", values);
      toast.success("Información de contacto actualizada");
      invalidateApi("/api/admin/site-config");
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar la información"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="glass-card dark:glass-card-dark">
      <CardHeader>
        <CardTitle>Información de contacto</CardTitle>
        <CardDescription>
          Datos públicos mostrados en el pie de página del sitio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {firstTime ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {FIELDS.map((group) => (
                <fieldset key={group.section} className="space-y-4">
                  <legend className="text-sm font-semibold text-muted-foreground">
                    {group.section}
                  </legend>
                  {group.items.map((item) => (
                    <FormField
                      key={item.name}
                      control={form.control}
                      name={item.name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{item.label}</FormLabel>
                          <FormControl>
                            <Input placeholder={item.placeholder} {...field} />
                          </FormControl>
                          {item.hint && (
                            <FormDescription>{item.hint}</FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </fieldset>
              ))}
              <div className="flex justify-end">
                <Button type="submit" disabled={busy}>
                  Guardar
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
