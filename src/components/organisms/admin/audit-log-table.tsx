"use client";

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LocalTimestamp } from "@/components/molecules/local-date";
import { auditActionLabel, CASCADED_ACTIONS } from "@/lib/audit/actions";
import {
  actionVerbTag,
  buildChangeSummary,
  buildFieldChanges,
  entityTypeLabel,
} from "@/lib/audit/humanize";
import type { AuditLogListItem } from "@/lib/db/audit";

/**
 * Table + detail-drawer view of the audit trail (replaces the old one-card-per-entry list).
 * The table only ever shows human-readable text — the raw JSON diff lives behind the
 * drawer's "Información del sistema" disclosure, for whoever is chasing a bug rather than
 * reading the trail as a story.
 */
export function AuditLogTable({ items }: { items: AuditLogListItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openItem = items.find((i) => i.id === openId) ?? null;

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Autor</TableHead>
              <TableHead>Resumen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const cascaded = CASCADED_ACTIONS.has(item.action);
              return (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => setOpenId(item.id)}
                  tabIndex={0}
                  role="button"
                  aria-haspopup="dialog"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenId(item.id);
                    }
                  }}
                >
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    <LocalTimestamp ms={item.createdAt} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">
                        {entityTypeLabel(item.entityType)}
                      </Badge>
                      <Badge variant="secondary">
                        {actionVerbTag(item.action)}
                      </Badge>
                      {cascaded ? (
                        <Badge variant="outline" className="font-normal">
                          En cascada
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {item.actorLabel}
                  </TableCell>
                  <TableCell className="max-w-md truncate text-muted-foreground">
                    {buildChangeSummary(item)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Sheet
        open={openItem !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
      >
        {openItem ? <AuditDetailPanel item={openItem} /> : null}
      </Sheet>
    </>
  );
}

/** One changed field, GitHub-style: the old value struck through on a red line, the new
 * value on a green line underneath — instead of a single "before → after" sentence, which
 * reads fine for a short value but gets hard to parse for anything longer. */
function FieldDiff({
  label,
  before,
  after,
}: {
  label: string;
  before: string;
  after: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border text-sm">
      <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <div className="flex items-start gap-2 bg-red-100 px-3 py-1.5 text-red-800 dark:bg-red-950 dark:text-red-200">
        <span aria-hidden className="select-none font-mono">
          −
        </span>
        <span className="break-words line-through decoration-red-700/40 dark:decoration-red-300/40">
          {before}
        </span>
      </div>
      <div className="flex items-start gap-2 bg-green-100 px-3 py-1.5 text-green-800 dark:bg-green-950 dark:text-green-200">
        <span aria-hidden className="select-none font-mono">
          +
        </span>
        <span className="break-words">{after}</span>
      </div>
    </div>
  );
}

function AuditDetailPanel({ item }: { item: AuditLogListItem }) {
  const changes = buildFieldChanges(item.before, item.after);
  const context = item.context ?? {};
  const hasContext = Object.keys(context).length > 0;

  return (
    <SheetContent
      side="right"
      className="flex w-full flex-col gap-0 sm:max-w-md"
    >
      <SheetHeader className="border-b border-border text-left">
        <SheetTitle>{auditActionLabel(item.action)}</SheetTitle>
        <SheetDescription>
          <LocalTimestamp ms={item.createdAt} /> · {item.actorLabel}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{entityTypeLabel(item.entityType)}</Badge>
          <Badge variant="secondary">{actionVerbTag(item.action)}</Badge>
        </div>

        {hasContext ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-md border border-border p-3">
            {Object.entries(context).map(([label, value]) => (
              <Fragment key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </Fragment>
            ))}
          </dl>
        ) : null}

        {item.reason ? (
          <p>
            <span className="font-medium">Motivo: </span>
            {item.reason}
          </p>
        ) : null}

        {changes.length > 0 ? (
          <div className="space-y-3">
            <p className="font-medium">Cambios</p>
            {changes.map((c) => (
              <FieldDiff
                key={c.key}
                label={c.label}
                before={c.before}
                after={c.after}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            No hay cambios de campos registrados para esta entrada.
          </p>
        )}

        <details className="rounded-md border border-border">
          <summary className="cursor-pointer p-3 text-sm font-medium text-muted-foreground hover:text-foreground">
            Información del sistema
          </summary>
          <div className="space-y-2 border-t border-border p-3 text-xs">
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
              <dt className="text-muted-foreground">Acción</dt>
              <dd className="font-mono">{item.action}</dd>
              <dt className="text-muted-foreground">Entidad</dt>
              <dd className="font-mono">
                {item.entityType} / {item.entityId}
              </dd>
              <dt className="text-muted-foreground">Actor (id)</dt>
              <dd className="font-mono">{item.actorUserId ?? "—"}</dd>
              <dt className="text-muted-foreground">Request id</dt>
              <dd className="font-mono">{item.requestId ?? "—"}</dd>
            </dl>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="mb-1 font-medium text-muted-foreground">
                  Antes (JSON)
                </p>
                <pre className="overflow-auto rounded bg-muted p-2">
                  {JSON.stringify(item.before, null, 2) ?? "null"}
                </pre>
              </div>
              <div>
                <p className="mb-1 font-medium text-muted-foreground">
                  Después (JSON)
                </p>
                <pre className="overflow-auto rounded bg-muted p-2">
                  {JSON.stringify(item.after, null, 2) ?? "null"}
                </pre>
              </div>
            </div>
          </div>
        </details>
      </div>
    </SheetContent>
  );
}
