"use client";

import { ImageUpload } from "@/components/molecules/image-upload";
import { MarkdownEditor } from "@/components/molecules/markdown-editor";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_REVIEW: "Enviada a revisión",
  PUBLISHED: "Publicada",
  PAUSED: "Pausada",
};

function toFormValues(post?: NewsPost | null): NewsPostAdminInput {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    summary: post?.summary ?? "",
    body: post?.body ?? "",
    coverImageUrl: post?.coverImageUrl ?? null,
    isFeatured: post?.isFeatured ?? false,
    featuredOrder: post?.featuredOrder ?? 0,
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
  const slugTouched = useRef(!!post); // an existing post's slug is never auto-derived

  // Always validate against the full (admin) shape client-side; the UI below only
  // ever offers a non-privileged user the DRAFT/PENDING_REVIEW options, and the
  // server independently enforces who may reach PUBLISHED/PAUSED either way.
  const form = useForm<NewsPostAdminInput>({
    resolver: zodResolver(newsPostAdminInputSchema),
    defaultValues: toFormValues(post),
  });

  const statusOptions = canApprove
    ? (["DRAFT", "PENDING_REVIEW", "PUBLISHED", "PAUSED"] as const)
    : (["DRAFT", "PENDING_REVIEW"] as const);

  const onSubmit = async (values: NewsPostAdminInput) => {
    setBusy(true);
    try {
      if (post) {
        await apiSend(`/api/admin/news/${post.id}`, "PUT", values);
        toast.success("Nota actualizada");
      } else {
        await apiSend("/api/admin/news", "POST", values);
        toast.success(
          values.status === "PENDING_REVIEW"
            ? "Nota enviada a revisión"
            : "Nota guardada",
        );
      }
      router.push("/admin/news");
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo guardar la nota"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="glass-card dark:glass-card-dark">
          <CardHeader>
            <CardTitle>{post ? "Editar nota" : "Nueva nota"}</CardTitle>
            <CardDescription>
              Título, resumen breve para la tarjeta y el contenido completo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug (URL)</FormLabel>
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
                    /noticias/{form.watch("slug") || "…"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      value={field.value ?? null}
                      onChange={field.onChange}
                      uploadUrl={`/api/admin/news/upload${post ? `?postId=${encodeURIComponent(post.id)}` : ""}`}
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
          </CardContent>
        </Card>

        <Card className="glass-card dark:glass-card-dark">
          <CardHeader>
            <CardTitle>Publicación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!canApprove ? (
                    <FormDescription>
                      Un administrador revisa y publica las notas enviadas.
                    </FormDescription>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="isFeatured"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
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
              <FormField
                control={form.control}
                name="featuredOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orden entre destacadas</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value}
                        onChange={(e) =>
                          field.onChange(
                            Number.isNaN(e.target.valueAsNumber)
                              ? 0
                              : e.target.valueAsNumber,
                          )
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/news")}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {post ? "Guardar cambios" : "Crear nota"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
