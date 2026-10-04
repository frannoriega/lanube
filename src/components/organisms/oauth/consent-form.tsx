"use client";

import { Button } from "@/components/ui/button";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** Los parámetros del pedido de autorización, tal como llegaron a la página. */
export type AuthorizationRequestParams = Record<string, string | null>;

/**
 * Pantalla de consentimiento del conector MCP (milestone 20). Muestra quién pide acceso
 * (nombre **declarado** por el cliente + el dominio al que va a volver, que es lo único
 * verificable), con qué cuenta, y qué va a poder hacer en castellano llano. "Permitir" y
 * "Cancelar" mandan la decisión a `POST /api/oauth/authorize`, que revalida todo y devuelve
 * a dónde ir; se navega con `window.location` porque el destino es otro sitio.
 *
 * No muestra el `logo_uri` del cliente: la CSP del sitio (`img-src`) no permite imágenes de
 * dominios arbitrarios, y abrirla para un dato que declara un tercero no vale la pena.
 *
 * No usa shadcn Form: no hay campos que validar, solo dos botones.
 */
export function OAuthConsentForm({
  clientName,
  clientHost,
  accountEmail,
  capabilities,
  request,
}: {
  clientName: string;
  clientHost: string;
  accountEmail: string;
  capabilities: string[];
  request: AuthorizationRequestParams;
}) {
  const [busy, setBusy] = useState<"allow" | "deny" | null>(null);

  const decide = async (decision: "allow" | "deny") => {
    setBusy(decision);
    try {
      const { redirectTo } = await apiSend<{ redirectTo: string }>(
        "/api/oauth/authorize",
        "POST",
        { ...request, decision },
      );
      window.location.href = redirectTo;
    } catch (err) {
      toast.error(
        apiErrorMessage(
          err,
          "No pudimos completar la conexión. Intentá de nuevo.",
        ),
      );
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-la-nube-ink dark:text-white">
            {clientName} quiere acceder a tu cuenta de La Nube
          </h1>
          <p className="text-sm text-muted-foreground">
            Vas a volver a{" "}
            <span className="font-medium text-foreground">{clientHost}</span>.
            Cuenta:{" "}
            <span className="font-medium text-foreground">{accountEmail}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-medium">Si lo permitís, va a poder:</p>
        <ul className="flex flex-col gap-2">
          {capabilities.map((c) => (
            <li key={c} className="flex items-start gap-2 text-sm">
              <Check
                className="mt-0.5 size-4 shrink-0 text-la-nube-selected dark:text-la-nube-secondary"
                aria-hidden
              />
              {c}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-sm text-muted-foreground">
        Solo actúa sobre tus propias reservas, nunca sobre funciones de
        administración. Las reservas que pida quedan pendientes hasta que el
        equipo de La Nube las apruebe. Podés desconectarlo cuando quieras desde
        Configuración → Seguridad.
      </p>
      <p className="text-sm text-muted-foreground">
        Permití el acceso solo si fuiste vos quien inició esta conexión desde{" "}
        {clientName}.
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          disabled={busy !== null}
          onClick={() => decide("deny")}
        >
          {busy === "deny" && <Loader2 className="animate-spin" aria-hidden />}
          Cancelar
        </Button>
        <Button
          variant="brand"
          disabled={busy !== null}
          onClick={() => decide("allow")}
        >
          {busy === "allow" && <Loader2 className="animate-spin" aria-hidden />}
          Permitir
        </Button>
      </div>
    </div>
  );
}
