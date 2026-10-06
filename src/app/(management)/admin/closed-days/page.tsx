import { Pagination } from "@/components/molecules/pagination";
import { SyncHolidaysButton } from "@/components/organisms/admin/sync-holidays-button";
import { ClosedDaysTable } from "@/components/organisms/admin/closed-days-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { todayDateKeyInAdminTz } from "@/lib/admin/admin-timezone";
import { nowMs } from "@/lib/clock";
import { closureWindowLabel } from "@/lib/closed-days/closures";
import { formatDateRange } from "@/lib/constants/closed-days";
import { listClosedDays, type ClosedDayScope } from "@/lib/db/closedDays";
import { requirePagePermission } from "@/lib/page-auth";
import Link from "next/link";

const PAGE_SIZE = 20;

const SCOPES: ClosedDayScope[] = ["upcoming", "review", "past"];

const EMPTY: Record<ClosedDayScope, string> = {
  upcoming: "No hay cierres próximos. El espacio está abierto todos los días.",
  review: "No hay propuestas por revisar.",
  past: "Todavía no hay cierres pasados.",
};

/** Mismo estilo de pestañas que Eventos y Noticias. */
function tabClass(active: boolean): string {
  return active
    ? "rounded-md bg-background px-3 py-1 text-sm font-medium shadow-sm"
    : "rounded-md px-3 py-1 text-sm text-muted-foreground hover:text-foreground";
}

/**
 * Días cerrados del espacio (milestone 23): feriados, vacaciones y cierres parciales. Un
 * cierre activo impide pedir reservas en su horario y se muestra con su motivo en el
 * calendario.
 */
export default async function ClosedDaysPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; page?: string }>;
}) {
  await requirePagePermission("closed-days:manage");
  const sp = await searchParams;
  const scope = SCOPES.find((s) => s === sp.scope) ?? "upcoming";
  const page = Math.max(1, Number(sp.page) || 1);

  const { items, total, pendingReview } = await listClosedDays({
    scope,
    todayKey: todayDateKeyInAdminTz(nowMs()),
    page,
    pageSize: PAGE_SIZE,
  });

  const rows = items.map((c) => ({
    id: c.id,
    title: c.title,
    dates: formatDateRange(c.startDate, c.endDate),
    window: closureWindowLabel(c),
    source: c.source,
    status: c.status,
    holidayKind: c.holidayKind,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Días cerrados</h1>
          <p className="text-muted-foreground">
            Feriados, vacaciones y cierres por horario. Mientras dura un cierre
            no se pueden pedir reservas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SyncHolidaysButton />
          <Button asChild>
            <Link href="/admin/closed-days/new">Nuevo día cerrado</Link>
          </Button>
        </div>
      </div>

      <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
        <Link
          href="/admin/closed-days"
          className={tabClass(scope === "upcoming")}
        >
          Próximos
        </Link>
        <Link
          href="/admin/closed-days?scope=review"
          className={tabClass(scope === "review")}
        >
          Por revisar
          {pendingReview > 0 ? (
            <Badge variant="secondary" className="ml-1.5">
              {pendingReview}
            </Badge>
          ) : null}
        </Link>
        <Link
          href="/admin/closed-days?scope=past"
          className={tabClass(scope === "past")}
        >
          Pasados
        </Link>
      </div>

      <ClosedDaysTable
        rows={rows}
        emptyMessage={EMPTY[scope]}
        selectable={scope === "review"}
      />
      <Pagination
        page={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        basePath="/admin/closed-days"
        query={{ scope: scope === "upcoming" ? undefined : scope }}
      />
    </div>
  );
}
