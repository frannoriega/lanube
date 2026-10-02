"use client";

import {
  CoverImageHint,
  ImageUpload,
} from "@/components/molecules/image-upload";
import { MarkdownEditor } from "@/components/molecules/markdown-editor";
import { Button } from "@/components/ui/button";
import {
  FormPageLayout,
  FormSection,
  StickySaveBar,
} from "@/components/molecules/form-layout";
import {
  UnsavedChangesDialog,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import {
  newsPostAdminInputSchema,
  type NewsPostAdminInput,
} from "@/lib/schemas/news";
import { slugify } from "@/lib/utils/string";
import type { NewsPost } from "@/types/prisma";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type NewsStatus = NewsPostAdminInput["status"];
type PendingAction = "EDIT" | "PAUSE" | "DELETE";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_REVIEW: "Enviada a revisión",
  PUBLISHED: "Publicada",
  REJECTED: "Rechazada",
  PAUSED: "Pausada",
};

const PENDING_ACTION_LABELS: Record<PendingAction, string> = {
  EDIT: "una edición",
  PAUSE: "una pausa",
  DELETE: "una eliminación",
};

/**
 * A button on the "next step" bar. `status` is what the field is set to before submit
 * (ignored for a `decision`/`request` action — see `runAction`). `decision` marks the two
 * buttons that must go through the approve/reject endpoint instead of a plain save (so the
 * author gets notified and the audit trail reads as a decision, not an edit). `request`
 * marks the three buttons a plain author gets on their own PUBLISHED post, which propose a
 * change instead of writing it — see the module doc comment on `prisma/models/news.prisma`.
 */
type NextStepAction = {
  key: string;
  label: string;
  status: NewsStatus;
  variant: "default" | "outline" | "destructive";
  decision?: "APPROVED" | "REJECTED";
  request?: PendingAction;
};

/**
 * Computes the "next step" buttons for the current post status + role, replacing what used
 * to be a free-form status `<Select>`. A dropdown asked the user to know the state machine;
 * buttons only ever offer the transitions valid from here, phrased as an action instead of a
 * destination state.
 */
function getNextStepActions(
  existingStatus: NewsStatus | undefined,
  canApprove: boolean,
  pendingAction: PendingAction | null,
): NextStepAction[] {
  if (canApprove && existingStatus === "PENDING_REVIEW") {
    return [
      {
        key: "hold",
        label: "Guardar sin decidir",
        status: "PENDING_REVIEW",
        variant: "outline",
      },
      {
        key: "reject",
        label: "Rechazar",
        status: "PENDING_REVIEW",
        variant: "destructive",
        decision: "REJECTED",
      },
      {
        key: "approve",
        label: "Aprobar y publicar",
        status: "PUBLISHED",
        variant: "default",
        decision: "APPROVED",
      },
    ];
  }

  if (existingStatus === "PUBLISHED") {
    if (canApprove) {
      return [
        {
          key: "save",
          label: "Guardar cambios",
          status: "PUBLISHED",
          variant: "default",
        },
        {
          key: "unpublish",
          label: "Despublicar",
          status: "PAUSED",
          variant: "outline",
        },
      ];
    }
    // Un autor sin news:approve nunca vuelve a escribir los campos en vivo de una nota
    // publicada — propone un cambio y un admin lo decide (ver el modelo NewsPost). Solo se
    // ofrece la acción ya pendiente, si hay una (para actualizarla), o las tres si no hay
    // ninguna — pedir una distinta mientras hay una pendiente lo rechaza el servidor.
    const actions: NextStepAction[] = [];
    if (!pendingAction || pendingAction === "EDIT") {
      actions.push({
        key: "request-edit",
        label: pendingAction
          ? "Actualizar edición pendiente"
          : "Enviar edición a revisión",
        status: "PUBLISHED",
        variant: "default",
        request: "EDIT",
      });
    }
    if (!pendingAction || pendingAction === "PAUSE") {
      actions.push({
        key: "request-pause",
        label: pendingAction ? "Actualizar pedido de pausa" : "Solicitar pausa",
        status: "PUBLISHED",
        variant: "outline",
        request: "PAUSE",
      });
    }
    if (!pendingAction || pendingAction === "DELETE") {
      actions.push({
        key: "request-delete",
        label: pendingAction
          ? "Actualizar pedido de eliminación"
          : "Solicitar eliminación",
        status: "PUBLISHED",
        variant: "destructive",
        request: "DELETE",
      });
    }
    return actions;
  }

  if (existingStatus === "PAUSED" && canApprove) {
    return [
      {
        key: "publish",
        label: "Publicar",
        status: "PUBLISHED",
        variant: "default",
      },
      {
        key: "draft",
        label: "Pasar a borrador",
        status: "DRAFT",
        variant: "outline",
      },
    ];
  }

  // DRAFT, REJECTED, or a brand-new post: the author's own editorial-work states.
  const actions: NextStepAction[] = [
    {
      key: "draft",
      label: "Guardar borrador",
      status: "DRAFT",
      variant: "outline",
    },
    {
      key: "review",
      label: "Enviar a revisión",
      status: "PENDING_REVIEW",
      variant: canApprove ? "outline" : "default",
    },
  ];
  if (canApprove) {
    actions.push({
      key: "publish",
      label: "Publicar",
      status: "PUBLISHED",
      variant: "default",
    });
  }
  return actions;
}

function toFormValues(post?: NewsPost | null): NewsPostAdminInput {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    summary: post?.summary ?? "",
    body: post?.body ?? "",
    coverImageUrl: post?.coverImageUrl ?? "",
    isFeatured: post?.isFeatured ?? false,
    status: (post?.status as NewsPostAdminInput["status"]) ?? "DRAFT",
  };
}

export function NewsForm({
  post,
  canApprove,
}: {
  /** Undefined for a new post. */
  post?: NewsPost;
  /** Whether the signed-in user has news:approve (Admin/Superadmin). */
  canApprove: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [requesting, setRequesting] = useState<NextStepAction | null>(null);
  const [requestReason, setRequestReason] = useState("");
  const slugTouched = useRef(!!post); // an existing post's slug is never auto-derived
  // El campo slug solo se muestra si alguien pidió editarlo (ver comentario en el JSX).
  const [slugEditing, setSlugEditing] = useState(false);

  // Always validate against the full (admin) shape client-side; the button bar below only
  // ever offers a non-privileged user the transitions they're allowed to make, and the
  // server independently enforces who may reach PUBLISHED/PAUSED either way.
  const form = useForm<NewsPostAdminInput>({
    resolver: zodResolver(newsPostAdminInputSchema),
    defaultValues: toFormValues(post),
  });

  // Guardia de cambios sin guardar (milestone 14): se suelta justo antes de cada redirect
  // posterior a un guardado exitoso.
  const guard = useUnsavedChangesGuard(form.formState.isDirty && !busy);

  const pendingAction = (post?.pendingAction as PendingAction | null) ?? null;
  const nextStepActions = getNextStepActions(
    post?.status as NewsStatus | undefined,
    canApprove,
    pendingAction,
  );

  const saveContent = (values: NewsPostAdminInput, status: NewsStatus) => {
    const payload = { ...values, status };
    return post
      ? apiSend(`/api/admin/news/${post.id}`, "PUT", payload)
      : apiSend("/api/admin/news", "POST", payload);
  };

  const runRequest = async (
    values: NewsPostAdminInput,
    action: NextStepAction,
    reason: string,
  ) => {
    if (!post) return;
    setBusy(true);
    try {
      await apiSend(`/api/admin/news/${post.id}/request`, "POST", {
        action: action.request,
        reason: reason.trim() || null,
        content:
          action.request === "EDIT"
            ? {
                title: values.title,
                slug: values.slug,
                summary: values.summary,
                body: values.body,
                coverImageUrl: values.coverImageUrl,
              }
            : undefined,
      });
      toast.success("Solicitud enviada — un administrador la va a revisar");
      setRequesting(null);
      guard.release();
      router.push("/admin/news");
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo enviar la solicitud"));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Runs one "next step" button. Approve/reject go through the decision endpoint (not a
   * plain status write) so the author gets notified and the audit trail reads as a review
   * decision — but any content edits made alongside it still need saving, so those go first,
   * keeping the reviewed status unchanged.
   */
  const runAction = async (
    values: NewsPostAdminInput,
    action: NextStepAction,
  ) => {
    setBusy(true);
    try {
      if (action.decision && post) {
        await saveContent(values, post.status as NewsStatus);
        await apiSend(`/api/admin/news/${post.id}/decision`, "POST", {
          decision: action.decision,
          reason: action.decision === "REJECTED" ? rejectReason.trim() : null,
        });
        toast.success(
          action.decision === "APPROVED"
            ? "Nota aprobada y publicada"
            : "Nota rechazada",
        );
      } else {
        await saveContent(values, action.status);
        toast.success(
          !post && action.status === "PENDING_REVIEW"
            ? "Nota enviada a revisión"
            : "Nota guardada",
        );
      }
      setRejecting(false);
      guard.release();
      router.push("/admin/news");
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar la nota"));
    } finally {
      setBusy(false);
    }
  };

  const handleAction = (action: NextStepAction) => {
    if (action.decision === "REJECTED") {
      setRejectReason("");
      setRejecting(true);
      return;
    }
    if (action.request === "PAUSE" || action.request === "DELETE") {
      setRequestReason(post?.pendingReason ?? "");
      setRequesting(action);
      return;
    }
    void form.handleSubmit((values) => runAction(values, action))();
  };

  const confirmReject = () => {
    const action = nextStepActions.find((a) => a.decision === "REJECTED");
    if (!action) return;
    void form.handleSubmit((values) => runAction(values, action))();
  };

  const confirmRequest = () => {
    if (!requesting) return;
    void form.handleSubmit((values) =>
      runRequest(values, requesting, requestReason),
    )();
  };

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()}>
        {/*
         * Milestone 14, propuesta 2: contenido en la columna principal y "Publicación" como
         * aside (sticky desde `lg`, al final en el teléfono); los botones de acción viven en
         * la barra de guardado pegada abajo en vez de solo al final de la página.
         */}
        <FormPageLayout
          main={
            <FormSection
              id="contenido"
              title="Contenido"
              description="Lo que ve el público en la tarjeta y en la nota."
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          if (!slugTouched.current) {
                            form.setValue("slug", slugify(e.target.value), {
                              shouldValidate: true,
                            });
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/*
               * Slug (milestone 14, decisión sobre las propuestas): se deriva del título al
               * crear y queda **estable** después (renombrar no rompe links compartidos). No se
               * tipea: al crear no se muestra; al editar se ve la URL y "Editar" abre el campo
               * para el arreglo manual poco frecuente. Si el slug derivado no es válido (p. ej.
               * un título solo con emojis) el campo se abre solo para mostrar el error. Las
               * colisiones las resuelve el servidor con sufijo numérico (`-2`).
               */}
              {post || slugEditing || form.formState.errors.slug ? (
                slugEditing || form.formState.errors.slug ? (
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dirección (URL)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            onChange={(e) => {
                              slugTouched.current = true;
                              field.onChange(e);
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Cambiarla rompe los links que ya se hayan compartido.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      URL: /news/…/
                      <span className="font-mono text-foreground">
                        {form.watch("slug")}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => setSlugEditing(true)}
                    >
                      Editar
                    </Button>
                  </p>
                )
              ) : null}

              <FormField
                control={form.control}
                name="summary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resumen</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Un párrafo breve para la tarjeta"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Hasta 200 caracteres.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="coverImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Imagen de portada</FormLabel>
                    <FormControl>
                      <ImageUpload
                        value={field.value || null}
                        onChange={(url) => field.onChange(url ?? "")}
                        uploadUrl={`/api/admin/news/upload${post ? `?postId=${encodeURIComponent(post.id)}` : ""}`}
                        hint={<CoverImageHint />}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contenido</FormLabel>
                    <FormControl>
                      <MarkdownEditor
                        value={field.value}
                        onChange={field.onChange}
                        rows={14}
                        uploadUrl={`/api/admin/news/upload${post ? `?postId=${encodeURIComponent(post.id)}` : ""}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>
          }
          aside={
            <FormSection
              id="publicacion"
              title="Publicación"
              description="Estado de la nota y cómo aparece en el inicio."
            >
              <div>
                <p className="text-sm text-muted-foreground">
                  Estado actual:{" "}
                  <span className="font-medium text-foreground">
                    {STATUS_LABELS[post?.status ?? "DRAFT"]}
                  </span>
                </p>
                {post?.status === "REJECTED" && post.decisionReason ? (
                  <p className="mt-1 text-sm text-destructive">
                    Motivo del rechazo: {post.decisionReason}
                  </p>
                ) : null}
                {post?.status === "PUBLISHED" && !canApprove ? (
                  pendingAction ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Tenés {PENDING_ACTION_LABELS[pendingAction]} pendiente de
                      revisión. La nota sigue publicada tal cual está hasta que
                      un administrador decida.
                      {post.pendingReason ? (
                        <>
                          {" "}
                          Tu nota para el administrador:{" "}
                          <span className="italic">
                            &ldquo;{post.pendingReason}&rdquo;
                          </span>
                        </>
                      ) : null}
                    </p>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Esta nota está publicada — no se puede editar ni bajar
                        directamente. Los cambios se envían a revisión y la nota
                        publicada no cambia hasta que un administrador los
                        apruebe.
                      </p>
                      {post.decisionReason ? (
                        <p className="mt-1 text-sm text-destructive">
                          Última decisión: {post.decisionReason}
                        </p>
                      ) : null}
                    </>
                  )
                ) : !canApprove ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Un administrador revisa y publica las notas enviadas.
                  </p>
                ) : null}
              </div>

              <div className="space-y-4 rounded-md border p-4">
                <FormField
                  control={form.control}
                  name="isFeatured"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4 space-y-0">
                      <FormLabel className="mb-0">Destacar</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Sin "Orden entre destacadas" (milestone 14): se ordena con "Reordenar
                  destacadas" en la lista de noticias. */}
              </div>
            </FormSection>
          }
        />

        <StickySaveBar dirty={form.formState.isDirty}>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/news")}
            disabled={busy}
          >
            Cancelar
          </Button>
          {nextStepActions.map((action) => (
            <Button
              key={action.key}
              type="button"
              variant={action.variant}
              disabled={busy}
              onClick={() => handleAction(action)}
            >
              {action.label}
            </Button>
          ))}
        </StickySaveBar>
      </form>

      <UnsavedChangesDialog guard={guard} />

      <ResponsiveDialog open={rejecting} onOpenChange={setRejecting}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Rechazar nota</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              El motivo es obligatorio y se muestra al autor para que sepa qué
              corregir antes de reenviarla a revisión.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motivo (obligatorio)"
          />
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejecting(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !rejectReason.trim()}
              onClick={confirmReject}
            >
              Rechazar
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={!!requesting}
        onOpenChange={(open) => !open && setRequesting(null)}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {requesting?.request === "DELETE"
                ? "Solicitar eliminación"
                : "Solicitar pausa"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              La nota sigue publicada tal cual está hasta que un administrador
              apruebe el pedido. Podés dejarle una nota explicando por qué
              (opcional).
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <Textarea
            value={requestReason}
            onChange={(e) => setRequestReason(e.target.value)}
            placeholder="Nota para el administrador (opcional)"
          />
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRequesting(null)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={
                requesting?.request === "DELETE" ? "destructive" : "default"
              }
              disabled={busy}
              onClick={confirmRequest}
            >
              Enviar solicitud
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </Form>
  );
}
