import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocalTimestamp } from "@/components/molecules/local-date";
import { Pagination } from "@/components/molecules/pagination";
import { listAuditEntityTypes, listAuditLogs } from "@/lib/db/audit";
import { requirePagePermission } from "@/lib/page-auth";
import Link from "next/link";

interface AuditSearchParams {
  page?: string;
  entityType?: string;
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
    listAuditLogs({ page, entityType: sp.entityType }),
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
          Quién hizo qué, cuándo y qué cambió. Solo se registran las acciones
          instrumentadas hasta ahora (reservas y roles de usuario); el resto de
          la superficie admin todavía no escribe entradas acá.
        </p>
      </div>

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
          {entityTypes.map((et) => (
            <Link key={et} href={`/admin/audit?entityType=${et}`}>
              <Badge variant={sp.entityType === et ? "default" : "outline"}>
                {et}
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
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className="glass-card dark:glass-card-dark">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base font-medium">
                    {item.action}
                  </CardTitle>
                  <LocalTimestamp
                    ms={item.createdAt}
                    className="text-sm text-muted-foreground"
                  />
                </div>
                <CardDescription className="flex flex-wrap items-center gap-1.5">
                  <span>{item.actorLabel}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {item.entityType} {item.entityId}
                  </span>
                </CardDescription>
              </CardHeader>
              {item.before || item.after || item.reason ? (
                <CardContent className="pt-0">
                  {item.reason ? (
                    <p className="mb-2 text-sm">
                      <span className="font-medium">Motivo: </span>
                      {item.reason}
                    </p>
                  ) : null}
                  {item.before || item.after ? (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Ver cambios
                      </summary>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            Antes
                          </p>
                          <pre className="overflow-auto rounded bg-muted p-2 text-xs">
                            {JSON.stringify(item.before, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            Después
                          </p>
                          <pre className="overflow-auto rounded bg-muted p-2 text-xs">
                            {JSON.stringify(item.after, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </details>
                  ) : null}
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/admin/audit"
        query={{ entityType: sp.entityType }}
      />
    </div>
  );
}
