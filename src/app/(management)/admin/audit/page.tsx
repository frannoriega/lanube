import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/molecules/pagination";
import { AuditLogTable } from "@/components/organisms/admin/audit-log-table";
import { entityTypeLabel } from "@/lib/audit/humanize";
import { listAuditEntityTypes, listAuditLogs } from "@/lib/db/audit";
import { requirePagePermission } from "@/lib/page-auth";
import Link from "next/link";

interface AuditSearchParams {
  page?: string;
  entityType?: string;
  /** Shows every entry written by one request — an action and its cascade. */
  requestId?: string;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<AuditSearchParams>;
}) {
  await requirePagePermission("audit:view");

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ items, total }, entityTypes] = await Promise.all([
    listAuditLogs({
      page,
      entityType: sp.entityType,
      requestId: sp.requestId,
    }),
    listAuditEntityTypes(),
  ]);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Auditoría
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Quién hizo qué, cuándo y qué cambió, en todas las escrituras del panel
          de administración. Las subidas de archivos no generan entradas
          propias: quedan registradas al guardarse el evento, formulario o nota
          que las usa.
        </p>
      </div>

      {sp.requestId ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
          <span>Mostrando una sola acción y todo lo que provocó.</span>
          <Link
            href="/admin/audit"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Ver todo
          </Link>
        </div>
      ) : null}

      {entityTypes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Tipo:
          </span>
          <Link href="/admin/audit">
            <Badge variant={!sp.entityType ? "default" : "outline"}>
              Todos
            </Badge>
          </Link>
          {/* Milestone 14 (hallazgo L): los chips mostraban el nombre interno del modelo
              en inglés ("NewsPost", "RegisteredUser"). Se muestran con la misma etiqueta
              en castellano que usa cada fila (`entityTypeLabel`) y ordenados por esa
              etiqueta; el valor del filtro en la URL sigue siendo el nombre interno. */}
          {[...entityTypes]
            .sort((a, b) =>
              entityTypeLabel(a).localeCompare(entityTypeLabel(b), "es"),
            )
            .map((et) => (
              <Link key={et} href={`/admin/audit?entityType=${et}`}>
                <Badge variant={sp.entityType === et ? "default" : "outline"}>
                  {entityTypeLabel(et)}
                </Badge>
              </Link>
            ))}
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay entradas de auditoría todavía.
        </p>
      ) : (
        <AuditLogTable items={items} />
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/admin/audit"
        query={{ entityType: sp.entityType, requestId: sp.requestId }}
      />
    </div>
  );
}
