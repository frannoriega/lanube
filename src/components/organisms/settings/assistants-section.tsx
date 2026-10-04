"use client";

import { Bot, Unplug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CopyField } from "@/components/molecules/copy-field";
import { FormSection } from "@/components/molecules/form-layout";
import { LoadError } from "@/components/molecules/load-error";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConnectedAssistants } from "@/hooks/api";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import { type OAuthScope, SCOPE_DESCRIPTIONS } from "@/lib/oauth/config";
import { formatDate } from "@/lib/utils/date";
import type { ConnectedAssistantItem } from "@/types/api";

/**
 * Configuración → Seguridad → «Asistentes de IA» (milestone 20).
 *
 * Dos bloques: cómo conectar un asistente (la URL del endpoint MCP, que es **lo único que la
 * persona tiene que saber**, más dos líneas para Claude y ChatGPT) y la lista de asistentes
 * conectados, cada uno con «Desconectar» (revoca el grant y todos sus tokens).
 *
 * El nombre de cada asistente lo declara el propio cliente; se muestra junto a su dominio,
 * que es lo verificable.
 */
export function AssistantsSection() {
  const { data, error, firstTime, refetch } = useConnectedAssistants();
  const [removing, setRemoving] = useState<ConnectedAssistantItem | null>(null);
  const assistants = data?.assistants ?? [];

  return (
    <FormSection
      title="Asistentes de IA"
      description="Conectá tu asistente (Claude, ChatGPT…) para gestionar tus reservas y consultar La Nube conversando."
    >
      <div className="space-y-3 rounded-lg border p-4">
        <p className="font-medium">Conectar un asistente</p>
        {firstTime && !data ? (
          <Skeleton className="h-10 w-full" />
        ) : data ? (
          <CopyField
            value={data.mcpUrl}
            label="URL del conector"
            mono
            successMessage="URL copiada"
          />
        ) : null}
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Claude:</span> en
            claude.ai, Configuración → Conectores → «Agregar conector
            personalizado», pegá la URL y seguí los pasos.
          </li>
          <li>
            <span className="font-medium text-foreground">ChatGPT:</span> en
            Configuración → Conectores (modo desarrollador), creá un conector
            con esta URL y autenticación OAuth.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Te va a pedir que entres a La Nube y autorices el acceso. El asistente
          puede consultar la información pública de La Nube, ver tus reservas,
          pedir reservas (que quedan pendientes de aprobación) y cancelarlas. Si
          tenés permisos de gestión, también puede consultar (solo lectura) lo
          que tu rol te deja ver y redactar borradores de noticias — nunca
          publicar ni aprobar nada.
        </p>
      </div>

      {error && !data ? (
        <LoadError
          message="No pudimos cargar tus asistentes conectados."
          onRetry={() => void refetch()}
        />
      ) : firstTime ? (
        <Skeleton className="h-20 w-full" />
      ) : assistants.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Bot className="h-5 w-5" aria-hidden />
          </span>
          <p className="font-medium">No tenés asistentes conectados</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {assistants.map((a) => (
            <AssistantRow
              key={a.id}
              assistant={a}
              onRemove={() => setRemoving(a)}
            />
          ))}
        </ul>
      )}

      {removing ? (
        <DisconnectDialog
          assistant={removing}
          onClose={() => setRemoving(null)}
          onRemoved={() => void refetch()}
        />
      ) : null}
    </FormSection>
  );
}

function AssistantRow({
  assistant,
  onRemove,
}: {
  assistant: ConnectedAssistantItem;
  onRemove: () => void;
}) {
  const capabilities = assistant.scopes.flatMap(
    (s) => SCOPE_DESCRIPTIONS[s as OAuthScope] ?? [],
  );
  return (
    <li className="flex items-start gap-3 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Bot className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-medium">
          {assistant.clientName}{" "}
          <span className="font-normal text-muted-foreground">
            · {assistant.clientHost}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          Conectado el {formatDate(new Date(assistant.createdAt))}
          {assistant.lastUsedAt
            ? ` · Último uso el ${formatDate(new Date(assistant.lastUsedAt))}`
            : " · Sin usar todavía"}
        </p>
        {capabilities.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Puede: {capabilities.join(" · ")}
          </p>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="shrink-0 text-destructive hover:text-destructive"
      >
        <Unplug className="h-4 w-4" aria-hidden />
        Desconectar
      </Button>
    </li>
  );
}

function DisconnectDialog({
  assistant,
  onClose,
  onRemoved,
}: {
  assistant: ConnectedAssistantItem;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const onConfirm = async () => {
    setBusy(true);
    try {
      await apiSend(`/api/user/assistants/${assistant.id}`, "DELETE");
      toast.success("Asistente desconectado");
      onClose();
      onRemoved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No pudimos desconectarlo"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            ¿Desconectar «{assistant.clientName}»?
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Va a dejar de poder ver y pedir reservas en tu nombre de inmediato.
            Las reservas que ya pidió no se tocan. Para volver a usarlo,
            conectalo de nuevo desde el asistente.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? "Desconectando…" : "Desconectar"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
