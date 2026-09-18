import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LocalTimestamp } from "@/components/molecules/local-date";
import { Pagination } from "@/components/molecules/pagination";
import { NewsRowActions } from "@/components/organisms/admin/news-row-actions";
import { auth } from "@/lib/auth";
import { listAdminNewsPosts } from "@/lib/db/news";
import { requirePagePermission } from "@/lib/page-auth";
import { hasPermission } from "@/lib/rbac";
import { Plus } from "lucide-react";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_REVIEW: "En revisión",
  PUBLISHED: "Publicada",
  REJECTED: "Rechazada",
  PAUSED: "Pausada",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "outline",
  PENDING_REVIEW: "secondary",
  PUBLISHED: "default",
  REJECTED: "destructive",
  PAUSED: "outline",
};

interface NewsSearchParams {
  page?: string;
  status?: string;
}

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<NewsSearchParams>;
}) {
  await requirePagePermission("news:manage");
  const session = await auth();
  const canApprove = hasPermission(session?.role, "news:approve");

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = await listAdminNewsPosts({
    authorId: canApprove ? undefined : session?.userId,
    status: sp.status,
    page,
  });
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
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
        <Button asChild>
          <Link href="/admin/news/new">
            <Plus className="mr-1 h-4 w-4" /> Nueva nota
          </Link>
        </Button>
      </div>

      {canApprove ? (
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/news">
            <Badge variant={!sp.status ? "default" : "outline"}>Todas</Badge>
          </Link>
          <Link href="/admin/news?status=PENDING_REVIEW">
            <Badge
              variant={sp.status === "PENDING_REVIEW" ? "default" : "outline"}
            >
              En revisión
            </Badge>
          </Link>
          <Link href="/admin/news?status=PUBLISHED">
            <Badge variant={sp.status === "PUBLISHED" ? "default" : "outline"}>
              Publicadas
            </Badge>
          </Link>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay notas todavía.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Autor</TableHead>
              <TableHead>Destacada</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((post) => (
              <TableRow key={post.id}>
                <TableCell className="font-medium">{post.title}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[post.status]}>
                    {STATUS_LABELS[post.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {post.authorLabel}
                </TableCell>
                <TableCell>{post.isFeatured ? "Sí" : "—"}</TableCell>
                <TableCell>
                  <LocalTimestamp
                    ms={Number(post.publishedAt ?? post.createdAt)}
                    className="text-sm text-muted-foreground"
                  />
                </TableCell>
                <TableCell>
                  <NewsRowActions
                    id={post.id}
                    title={post.title}
                    canApprove={canApprove}
                    showDecision={post.status === "PENDING_REVIEW"}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/admin/news"
        query={{ status: sp.status }}
      />
    </div>
  );
}
