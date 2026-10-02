"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Cloud,
  Fingerprint,
  KeyRound,
  Pencil,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

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
import { usePasskeys } from "@/hooks/api";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import {
  browserSupportsWebAuthn,
  PasskeyCancelledError,
  passkeyErrorMessage,
  registerPasskey,
  suggestPasskeyLabel,
} from "@/lib/passkeys/client";
import { passkeyLabelSchema } from "@/lib/schemas/passkeys";
import { formatDate } from "@/lib/utils/date";
import type { PasskeyItem } from "@/types/api";

const labelFormSchema = z.object({ label: passkeyLabelSchema });
type LabelValues = z.infer<typeof labelFormSchema>;

/**
 * Passkeys de la cuenta (milestone 17): listar, agregar, renombrar y quitar.
 *
 * Al agregar, primero se pide el nombre (sugerido según el dispositivo) y recién después se
 * abre el diálogo del sistema: así la passkey nunca queda guardada como "Mi passkey" sin que
 * el usuario lo haya elegido, y si cancela el diálogo del sistema no queda nada a medias.
 */
export function PasskeysSection() {
  const { data, error, firstTime, refetch } = usePasskeys();
  // `null` hasta montar: `browserSupportsWebAuthn` mira `window`, y en el servidor no existe.
  const [supported, setSupported] = useState<boolean | null>(null);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<PasskeyItem | null>(null);
  const [removing, setRemoving] = useState<PasskeyItem | null>(null);

  useEffect(() => setSupported(browserSupportsWebAuthn()), []);

  const passkeys = data?.passkeys ?? [];
  const atMax = data ? passkeys.length >= data.max : false;

  return (
    <FormSection
      title="Passkeys"
      description="Entrá con la huella, el rostro o el PIN de tu dispositivo, sin escribir la contraseña."
    >
      {error && !data ? (
        <LoadError
          message="No pudimos cargar tus passkeys."
          onRetry={() => void refetch()}
        />
      ) : firstTime ? (
        <Skeleton className="h-24 w-full" />
      ) : passkeys.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Fingerprint className="h-5 w-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <p className="font-medium">Todavía no tenés passkeys</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Una passkey vive en tu teléfono o computadora y no se puede
              adivinar ni filtrar como una contraseña.
            </p>
          </div>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {passkeys.map((p) => (
            <PasskeyRow
              key={p.id}
              passkey={p}
              onRename={() => setRenaming(p)}
              onRemove={() => setRemoving(p)}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => setAdding(true)}
          disabled={supported !== true || atMax || firstTime}
        >
          <KeyRound className="h-4 w-4" aria-hidden />
          Agregar passkey
        </Button>
        {supported === false ? (
          <p className="text-sm text-muted-foreground">
            Este navegador no admite passkeys.
          </p>
        ) : atMax ? (
          <p className="text-sm text-muted-foreground">
            Llegaste al máximo de {data?.max} passkeys.
          </p>
        ) : null}
      </div>

      <AddPasskeyDialog
        open={adding}
        onOpenChange={setAdding}
        onAdded={() => void refetch()}
      />
      {renaming ? (
        <RenamePasskeyDialog
          passkey={renaming}
          onClose={() => setRenaming(null)}
          onRenamed={() => void refetch()}
        />
      ) : null}
      {removing ? (
        <RemovePasskeyDialog
          passkey={removing}
          onClose={() => setRemoving(null)}
          onRemoved={() => void refetch()}
        />
      ) : null}
    </FormSection>
  );
}

function PasskeyRow({
  passkey,
  onRename,
  onRemove,
}: {
  passkey: PasskeyItem;
  onRename: () => void;
  onRemove: () => void;
}) {
  // "multiDevice" = sincronizada por el gestor (iCloud Keychain, Google Password Manager…).
  const synced = passkey.deviceType === "multiDevice";
  const Icon = synced ? Cloud : Smartphone;
  return (
    <li className="flex items-center gap-3 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{passkey.label}</p>
        <p className="text-xs text-muted-foreground">
          {synced ? "Sincronizada" : "Solo en este dispositivo"} · Agregada el{" "}
          {formatDate(new Date(passkey.createdAt))}
          {passkey.lastUsedAt
            ? ` · Último uso el ${formatDate(new Date(passkey.lastUsedAt))}`
            : " · Sin usar todavía"}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRename}
          aria-label={`Renombrar ${passkey.label}`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`Quitar ${passkey.label}`}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

function AddPasskeyDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const form = useForm<LabelValues>({
    resolver: zodResolver(labelFormSchema),
    defaultValues: { label: "" },
  });

  useEffect(() => {
    if (open) form.reset({ label: suggestPasskeyLabel() });
  }, [open, form]);

  const onSubmit = async ({ label }: LabelValues) => {
    try {
      await registerPasskey(label);
      toast.success("Passkey agregada. La próxima vez podés entrar con ella.");
      onOpenChange(false);
      onAdded();
    } catch (err) {
      // Cerrar el diálogo del sistema no es un error: se deja abierto el nuestro.
      if (err instanceof PasskeyCancelledError) return;
      toast.error(passkeyErrorMessage(err, "No pudimos agregar la passkey"));
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Agregar passkey</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Después de continuar, tu dispositivo te va a pedir la huella, el
            rostro o el PIN.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormDescription>
                    Para reconocerla si tenés más de una.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <ResponsiveDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Esperando…" : "Continuar"}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </Form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function RenamePasskeyDialog({
  passkey,
  onClose,
  onRenamed,
}: {
  passkey: PasskeyItem;
  onClose: () => void;
  onRenamed: () => void;
}) {
  const form = useForm<LabelValues>({
    resolver: zodResolver(labelFormSchema),
    defaultValues: { label: passkey.label },
  });

  const onSubmit = async ({ label }: LabelValues) => {
    try {
      await apiSend(`/api/user/passkeys/${passkey.id}`, "PATCH", { label });
      toast.success("Nombre actualizado");
      onClose();
      onRenamed();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No pudimos renombrarla"));
    }
  };

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Renombrar passkey</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Solo cambia cómo la ves acá.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <ResponsiveDialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Guardar
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </Form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function RemovePasskeyDialog({
  passkey,
  onClose,
  onRemoved,
}: {
  passkey: PasskeyItem;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const onConfirm = async () => {
    setBusy(true);
    try {
      await apiSend(`/api/user/passkeys/${passkey.id}`, "DELETE");
      toast.success("Passkey quitada");
      onClose();
      onRemoved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No pudimos quitarla"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            ¿Quitar «{passkey.label}»?
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Ya no vas a poder entrar con ella. Tu contraseña y tus otras
            passkeys siguen funcionando. Para borrarla también del dispositivo,
            hacelo desde su gestor de contraseñas.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? "Quitando…" : "Quitar passkey"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
