"use client";

import { Clock, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ToneBadge } from "@/components/atoms/status-badge";
import { FormSection } from "@/components/molecules/form-layout";
import { LoadError } from "@/components/molecules/load-error";
import { ChangeRequestDialog } from "@/components/organisms/settings/change-request-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettingsRequests } from "@/components/organisms/settings/settings-requests-context";
import { useUserProfile } from "@/hooks/api";
import { apiErrorMessage } from "@/lib/api/client";
import { cancelProfileChangeRequest } from "@/lib/api/mutations";
import { PROFILE_CHANGE_STATUS } from "@/lib/constants/profile-requests";
import {
  PROFILE_CHANGE_FIELD_LABELS,
  type ProfileChangeFieldKey,
} from "@/lib/schemas/profile";
import { formatDate } from "@/lib/utils/date";
import type { ProfileChangeRequestItem } from "@/types/api";

/**
 * Configuración → Identidad (milestone 17): DNI y motivo para unirse.
 *
 * Son de solo lectura. Para cambiarlos, el usuario pide el cambio y un admin lo aprueba o
 * lo rechaza: ni el usuario los edita (fraude: el DNI lo identifica en el check-in y en los
 * reportes) ni el admin (abuso: nadie le cambia el DNI a otro sin que lo haya pedido).
 */
export default function IdentitySettingsPage() {
  const profile = useUserProfile();
  const requests = useSettingsRequests();
  const [dialogField, setDialogField] = useState<ProfileChangeFieldKey | null>(
    null,
  );

  if ((profile.error && !profile.data) || (requests.error && !requests.data)) {
    return (
      <LoadError
        message="No pudimos cargar tus datos."
        onRetry={() => {
          void profile.refetch();
          void requests.refetch();
        }}
      />
    );
  }
  if (profile.firstTime || requests.firstTime || !profile.data) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  const user = profile.data;
  const history = requests.data ?? [];
  const pendingFor = (field: ProfileChangeFieldKey) =>
    history.find((r) => r.field === field && r.status === "PENDING");

  const refreshAll = () => {
    void profile.refetch();
    void requests.refetch();
  };

  const onCancel = async (request: ProfileChangeRequestItem) => {
    try {
      await cancelProfileChangeRequest(request.id);
      toast.success("Solicitud cancelada");
      refreshAll();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No pudimos cancelar la solicitud"));
    }
  };

  const rows: { field: ProfileChangeFieldKey; value: string }[] = [
    { field: "DNI", value: user.dni },
    { field: "REASON_TO_JOIN", value: user.reasonToJoin },
  ];
  const resolved = history.filter((r) => r.status !== "PENDING");

  return (
    <>
      <FormSection
        title="Datos verificados"
        description="Estos datos te identifican en La Nube. Para cambiarlos, pedilo y alguien del equipo lo revisa."
      >
        <dl className="divide-y rounded-lg border">
          {rows.map(({ field, value }) => {
            const pending = pendingFor(field);
            return (
              <div key={field} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <dt className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" aria-hidden />
                      {PROFILE_CHANGE_FIELD_LABELS[field]}
                    </dt>
                    <dd
                      className={
                        field === "DNI"
                          ? "font-mono text-base tabular-nums"
                          : "text-sm whitespace-pre-line break-words"
                      }
                    >
                      {value}
                    </dd>
                  </div>
                  {!pending ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialogField(field)}
                    >
                      Solicitar cambio
                    </Button>
                  ) : null}
                </div>
                {pending ? (
                  <PendingNotice
                    request={pending}
                    onCancel={() => void onCancel(pending)}
                  />
                ) : null}
              </div>
            );
          })}
        </dl>
      </FormSection>

      <FormSection
        title="Historial de solicitudes"
        description="Lo que pediste y qué respondió el equipo."
      >
        {resolved.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no tenés solicitudes resueltas.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {resolved.map((r) => (
              <HistoryItem key={r.id} request={r} />
            ))}
          </ul>
        )}
      </FormSection>

      {dialogField ? (
        <ChangeRequestDialog
          field={dialogField}
          currentValue={dialogField === "DNI" ? user.dni : user.reasonToJoin}
          open={dialogField !== null}
          onOpenChange={(open) => !open && setDialogField(null)}
          onCreated={refreshAll}
        />
      ) : null}
    </>
  );
}

/** Aviso dentro de la fila del dato mientras su cambio espera a un admin. */
function PendingNotice({
  request,
  onCancel,
}: {
  request: ProfileChangeRequestItem;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-200">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          Cambio pendiente de revisión
        </p>
        <p className="break-words text-foreground">
          <span className="text-muted-foreground">Pediste: </span>
          {request.requestedValue}
        </p>
        <p className="text-xs text-muted-foreground">
          Enviada el {formatDate(new Date(request.createdAt))}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancelar solicitud
      </Button>
    </div>
  );
}

function HistoryItem({ request }: { request: ProfileChangeRequestItem }) {
  const status = PROFILE_CHANGE_STATUS[request.status];
  return (
    <li className="space-y-1.5 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          {PROFILE_CHANGE_FIELD_LABELS[request.field]}
        </span>
        <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
      </div>
      <p className="break-words">
        <span className="text-muted-foreground">Pediste: </span>
        {request.requestedValue}
      </p>
      {request.decisionReason ? (
        <p className="break-words">
          <span className="text-muted-foreground">Respuesta: </span>
          {request.decisionReason}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Enviada el {formatDate(new Date(request.createdAt))}
        {request.decidedAt
          ? ` · ${request.status === "CANCELLED" ? "cancelada" : "resuelta"} el ${formatDate(new Date(request.decidedAt))}`
          : null}
      </p>
    </li>
  );
}
