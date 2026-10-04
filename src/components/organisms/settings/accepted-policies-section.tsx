"use client";

import { FormSection } from "@/components/molecules/form-layout";
import { LoadError } from "@/components/molecules/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import type { AcceptedPolicyItem } from "@/lib/db/policies";
import { formatPolicyDate } from "@/lib/policies/format";
import { formatDate } from "@/lib/utils/date";
import { ExternalLink } from "lucide-react";

/**
 * Configuración → Cuenta → "Políticas aceptadas" (milestone 19): qué versión de cada política
 * aceptó la persona y cuándo, con enlace al texto exacto. Solo lectura — una aceptación es
 * evidencia y no se edita ni se retira desde acá (retirar el consentimiento es pedir la baja,
 * que hoy se hace por email; ver la política).
 */
export function AcceptedPoliciesSection() {
  const { data, error, firstTime, refetch } =
    useApi<AcceptedPolicyItem[]>("/api/user/policies");

  return (
    <FormSection
      title="Políticas aceptadas"
      description="Qué versión de cada política aceptaste y cuándo."
    >
      {error && !data ? (
        <LoadError
          message="No pudimos cargar tus políticas aceptadas."
          onRetry={() => void refetch()}
        />
      ) : firstTime || !data ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no aceptaste ninguna política.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data.map((item) => (
            <li
              key={`${item.policyKey}-${item.version}`}
              className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                  >
                    {item.title}
                    <ExternalLink className="size-3" aria-hidden />
                    <span className="sr-only">(se abre en otra pestaña)</span>
                  </a>
                ) : (
                  <span className="font-medium">{item.title}</span>
                )}
                <span className="block text-xs text-muted-foreground">
                  Versión del {formatPolicyDate(item.version)}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                Aceptada el {formatDate(new Date(item.acceptedAt))}
                {item.context === "SIGNUP" ? " (al registrarte)" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  );
}
