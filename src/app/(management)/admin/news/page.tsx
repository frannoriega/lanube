import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/molecules/pagination";
import { FeaturedReorderButton } from "@/components/organisms/admin/featured-reorder-button";
import { NewsAdminTable } from "@/components/organisms/admin/news-admin-table";
import { auth } from "@/lib/auth";
import { listAdminNewsPosts } from "@/lib/db/news";
import { requirePagePermission } from "@/lib/page-auth";
import { hasPermission } from "@/lib/rbac";
import { Plus } from "lucide-react";
import Link from "next/link";

interface NewsSearchParams {
  page?: string;
  status?: string;
  mine?: string;
  review?: string;
  deleted?: string;
}

/** Arma un href de `/admin/news`, manteniendo los otros filtros activos y soltando `page`. */
function newsFilterHref(params: {
  status?: string;
  mine?: boolean;
  review?: boolean;
  deleted?: boolean;
}): string {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.mine) qs.set("mine", "1");
  if (params.review) qs.set("review", "1");
  if (params.deleted) qs.set("deleted", "1");
  const query = qs.toString();
  return query ? `/admin/news?${query}` : "/admin/news";
}

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<NewsSearchParams>;
}) {
  await requirePagePermission("news:manage");
  const session = await auth();
  const canApprove = hasPermission(session, "news:approve");

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const mine = sp.mine === "1";
  // Notas con una solicitud EDIT/PAUSE/DELETE pendiente contra su versión publicada. Se
  // mantiene como filtro propio y no como estado, porque el estado de la nota sigue siendo
  // PUBLISHED: nunca dejó el sitio mientras se decide.
  const hasPendingAction = sp.review === "1";
  const deleted = sp.deleted === "1" && canApprove;
  const { items, total } = await listAdminNewsPosts({
    authorId: canApprove
      ? mine
        ? session?.userId
        : undefined
      : session?.userId,
    status: sp.status,
    hasPendingAction: hasPendingAction ? true : undefined,
    deleted,
    page,
  });
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Noticias
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {canApprove
              ? "Todas las notas del equipo. Aprobá o rechazá las que están en revisión."
              : "Tus notas. Enviá a revisión cuando estén listas para publicarse."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Orden de las destacadas del landing: decisión de portada, solo para quien aprueba. */}
          {canApprove && (
            <FeaturedReorderButton
              endpoint="/api/admin/news/featured-order"
              labelKey="title"
              triggerLabel="Reordenar destacadas"
              title="Reordenar noticias destacadas"
              emptyMessage="Hace falta al menos dos noticias destacadas para reordenar."
            />
          )}
          <Button asChild>
            <Link href="/admin/news/new">
              <Plus className="mr-1 h-4 w-4" /> Nueva nota
            </Link>
          </Button>
        </div>
      </div>

      {canApprove ? (
        <div className="flex flex-wrap items-center gap-4">
          <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
            <Link
              href={newsFilterHref({ status: sp.status })}
              className={
                !mine
                  ? "rounded-md bg-background px-3 py-1 text-sm font-medium shadow-sm"
                  : "rounded-md px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
              }
            >
              Todas las notas
            </Link>
            <Link
              href={newsFilterHref({ status: sp.status, mine: true })}
              className={
                mine
                  ? "rounded-md bg-background px-3 py-1 text-sm font-medium shadow-sm"
                  : "rounded-md px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
              }
            >
              Mis notas
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={newsFilterHref({ mine })}>
              <Badge variant={!sp.status ? "default" : "outline"}>Todas</Badge>
            </Link>
            <Link href={newsFilterHref({ status: "PENDING_REVIEW", mine })}>
              <Badge
                variant={sp.status === "PENDING_REVIEW" ? "default" : "outline"}
              >
                En revisión
              </Badge>
            </Link>
            <Link href={newsFilterHref({ status: "PUBLISHED", mine })}>
              <Badge
                variant={sp.status === "PUBLISHED" ? "default" : "outline"}
              >
                Publicadas
              </Badge>
            </Link>
            {canApprove && (
              <Link href={newsFilterHref({ mine, review: true })}>
                <Badge variant={hasPendingAction ? "default" : "outline"}>
                  Solicitudes pendientes
                </Badge>
              </Link>
            )}
            {canApprove && (
              <Link href={newsFilterHref({ mine, deleted: true })}>
                <Badge variant={deleted ? "default" : "outline"}>
                  Eliminadas
                </Badge>
              </Link>
            )}
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay notas todavía.</p>
      ) : (
        <NewsAdminTable
          canApprove={canApprove}
          rows={items.map((post) => ({
            id: post.id,
            title: post.title,
            status: post.status,
            pendingAction: post.pendingAction ?? null,
            deleted: !!post.deletedAt,
            authorLabel: post.authorLabel,
            isFeatured: post.isFeatured,
            dateMs: Number(post.publishedAt ?? post.createdAt),
          }))}
        />
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/admin/news"
        query={{
          status: sp.status,
          mine: mine ? "1" : undefined,
          review: hasPendingAction ? "1" : undefined,
          deleted: deleted ? "1" : undefined,
        }}
      />
    </div>
  );
}
