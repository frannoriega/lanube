"use client";

import {
  CalendarPlus,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CopyField } from "@/components/molecules/copy-field";
import { FormSection } from "@/components/molecules/form-layout";
import { LoadError } from "@/components/molecules/load-error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage, apiSend } from "@/lib/api/client";

interface FeedView {
  kind: string;
  name: string;
  description: string;
  sensitive: boolean;
  url: string;
  google: string;
  webcal: string;
}

interface FeedsResponse {
  enabled: boolean;
  feeds: FeedView[];
}

/**
 * Configuración → «Calendario» (milestone 45): suscribirse desde Google Calendar, Apple o
 * Outlook. Cada feed es un **calendario aparte** (su color y su interruptor en la app de
 * calendario): «Mis reservas», «Mis eventos» y, para admins, uno por espacio. Los enlaces son
 * credenciales: «Regenerar enlaces» invalida los anteriores, «Desactivar» los apaga todos. La
 * confirmación de «Regenerar»/«Desactivar» va en el mismo lugar (sin modales).
 */
export function CalendarFeedsSection() {
  const { data, error, loading, refetch } = useApi<FeedsResponse>(
    "/api/user/calendar-feeds",
  );
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<null | "regenerate" | "disable">(
    null,
  );

  const act = async (action: "enable" | "disable" | "regenerate") => {
    setBusy(true);
    try {
      await apiSend("/api/user/calendar-feeds", "POST", { action });
      await refetch();
      toast.success(
        action === "enable"
          ? "Listo: ya podés agregar tus calendarios"
          : action === "disable"
            ? "Suscripciones desactivadas"
            : "Enlaces nuevos generados: volvé a agregar los calendarios",
      );
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo actualizar"));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  return (
    <FormSection
      title="Calendario"
      description="Mirá tus reservas y eventos en Google Calendar, Apple o Outlook. Se actualizan solos."
    >
      {error && !data ? (
        <LoadError onRetry={() => void refetch()} busy={loading} />
      ) : !data ? (
        <Skeleton className="h-24 w-full" />
      ) : !data.enabled ? (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            Cada calendario se agrega una vez y después se actualiza solo. En
            Google puede tardar unas horas en mostrar un cambio: lo decide
            Google, no La Nube.
          </p>
          <Button
            type="button"
            onClick={() => void act("enable")}
            disabled={busy}
          >
            <CalendarPlus className="h-4 w-4" />
            Activar suscripciones
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cada uno se agrega como un calendario aparte: elegís su color y lo
            mostrás u ocultás desde tu app. En Google puede tardar unas horas en
            reflejar un cambio.
          </p>
          <ul className="divide-y rounded-lg border">
            {data.feeds.map((f) => (
              <li key={f.kind} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{f.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {f.description}
                    </p>
                    {f.sensitive && (
                      <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                        <ShieldAlert
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          aria-hidden
                        />
                        Tiene datos de otras personas: no compartas el enlace.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={f.google}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Agregar a Google Calendar
                      </a>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <a href={f.webcal}>Apple / Outlook</a>
                    </Button>
                  </div>
                </div>
                <CopyField
                  value={f.url}
                  label="Enlace de suscripción"
                  buttonLabel="Copiar"
                  successMessage="Enlace copiado"
                  mono
                />
              </li>
            ))}
          </ul>

          {confirming ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 p-3 text-sm">
              <span className="mr-auto">
                {confirming === "regenerate"
                  ? "Los enlaces actuales dejan de andar: vas a tener que volver a agregar los calendarios."
                  : "Todos tus calendarios suscriptos dejan de actualizarse."}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(null)}
                disabled={busy}
              >
                Volver
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void act(confirming)}
                disabled={busy}
              >
                {confirming === "regenerate" ? "Regenerar" : "Desactivar"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirming("regenerate")}
              >
                <RefreshCw className="h-4 w-4" />
                Regenerar enlaces
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirming("disable")}
              >
                Desactivar suscripciones
              </Button>
            </div>
          )}
        </div>
      )}
    </FormSection>
  );
}
