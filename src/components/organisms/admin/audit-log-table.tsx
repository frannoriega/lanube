"use client";

import { Fragment, useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DataTable, useStaticTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { LocalTimestamp } from "@/components/molecules/local-date";
import { auditActionLabel, CASCADED_ACTIONS } from "@/lib/audit/actions";
import {
  actionVerbTag,
  buildChangeSummary,
  EMPTY_VALUE,
  entityTypeLabel,
  entryFieldChanges,
  ordinal,
  type FieldChange,
  type ItemRow,
  type OrderRow,
} from "@/lib/audit/humanize";
import { auditEventDef } from "@/lib/audit/registry";
import type { TextDiffLine, WordPart } from "@/lib/audit/text-diff";
import { cn } from "@/lib/utils";
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

  /*
   * Columnas del `DataTable` (milestone 14, hallazgo L): en un teléfono la tabla solo dejaba
   * ver Fecha y Tags, y lo útil (Autor, Resumen) quedaba fuera de pantalla. En la tarjeta,
   * el resumen va como título, los tags como chips y fecha + autor como datos.
   */
  const columns: ColumnDef<AuditLogListItem>[] = [
    {
      id: "date",
      header: "Fecha",
      meta: { label: "Fecha" },
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          <LocalTimestamp ms={row.original.createdAt} />
        </span>
      ),
    },
    {
      id: "tags",
      header: "Tags",
      meta: { mobile: "badge", label: "Tags" },
      cell: ({ row }) => {
        const item = row.original;
        return (
          // `md:flex-nowrap`: en escritorio los chips no saltan de línea, así todas las filas
          // miden lo mismo (antes "Espacios" + "Reordenamiento" partían en dos y esa fila
          // quedaba más alta que el resto). En la tarjeta móvil sí pueden envolver.
          <div className="flex flex-wrap items-center justify-end gap-1.5 md:flex-nowrap md:justify-start md:whitespace-nowrap">
            <Badge variant="outline">{entityTypeLabel(item.entityType)}</Badge>
            <Badge variant="secondary">{actionVerbTag(item.action)}</Badge>
            {CASCADED_ACTIONS.has(item.action) ? (
              <Badge variant="outline" className="font-normal">
                En cascada
              </Badge>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "actor",
      header: "Autor",
      meta: { label: "Autor" },
      cell: ({ row }) => (
        <span className="md:whitespace-nowrap">{row.original.actorLabel}</span>
      ),
    },
    {
      id: "summary",
      header: "Resumen",
      meta: { mobile: "title", label: "Resumen" },
      cell: ({ row }) => (
        <span className="line-clamp-3 font-normal text-foreground md:line-clamp-1 md:max-w-md md:text-muted-foreground">
          {buildChangeSummary(row.original)}
        </span>
      ),
    },
  ];
  const table = useStaticTable(items, columns);

  return (
    <>
      <DataTable table={table} onRowClick={(item) => setOpenId(item.id)} />

      <Sheet
        open={openItem !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
      >
        {openItem ? <AuditDetailPanel item={openItem} /> : null}
      </Sheet>
    </>
  );
}

/**
 * Despacha cada cambio legible a su diff según su forma (ver `FieldChange`): valor, texto
 * largo, imagen, conjunto, lista de registros o reordenamiento.
 */
function ChangeDiff({ change }: { change: FieldChange }) {
  switch (change.kind) {
    case "text":
      return (
        <TextDiff
          label={change.label}
          lines={change.lines}
          wholesale={change.wholesale}
        />
      );
    case "image":
      return (
        <ImageDiff
          label={change.label}
          before={change.before}
          after={change.after}
        />
      );
    case "items":
      return (
        <ItemsDiff
          label={change.label}
          rows={change.rows}
          unchanged={change.unchanged}
        />
      );
    case "value":
      return (
        <FieldDiff
          label={change.label}
          before={change.before}
          after={change.after}
        />
      );
    case "set":
      return (
        <SetDiff
          label={change.label}
          added={change.added}
          removed={change.removed}
        />
      );
    case "order":
      return (
        <OrderDiff
          label={change.label}
          rows={change.rows}
          hasBefore={change.hasBefore}
        />
      );
  }
}

/** Encabezado + cuerpo con borde, compartido por los tres diffs. */
function DiffBox({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border text-sm">
      <div className="flex items-baseline justify-between gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** `plain`: sin tachado (un texto entero que se quitó, o uno con las palabras resaltadas). */
function RemovedLine({
  children,
  plain = false,
}: {
  children: React.ReactNode;
  plain?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 bg-red-100 px-3 py-1.5 text-red-800 dark:bg-red-950 dark:text-red-200">
      <span aria-hidden className="select-none font-mono">
        −
      </span>
      <span className="sr-only">Antes: </span>
      <span
        className={cn(
          "break-words",
          !plain &&
            "line-through decoration-red-700/40 dark:decoration-red-300/40",
        )}
      >
        {children}
      </span>
    </div>
  );
}

function AddedLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-green-100 px-3 py-1.5 text-green-800 dark:bg-green-950 dark:text-green-200">
      <span aria-hidden className="select-none font-mono">
        +
      </span>
      <span className="sr-only">Después: </span>
      <span className="break-words">{children}</span>
    </div>
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
    <DiffBox label={label}>
      {/* Un alta no "cambia" desde vacío, y una baja no "pasa" a vacío: se muestra solo el
          lado que tiene algo, como en un diff de git. */}
      {before !== EMPTY_VALUE ? <RemovedLine>{before}</RemovedLine> : null}
      {after !== EMPTY_VALUE || before === EMPTY_VALUE ? (
        <AddedLine>{after}</AddedLine>
      ) : null}
    </DiffBox>
  );
}

/**
 * Una lista sin orden (p. ej. los permisos de un rol): solo lo que se quitó y lo que se
 * agregó. Repetir la lista entera tachada y otra vez en verde obligaba a compararlas a ojo
 * para encontrar el único permiso nuevo.
 */
function SetDiff({
  label,
  added,
  removed,
}: {
  label: string;
  added: string[];
  removed: string[];
}) {
  const hint = [
    added.length ? `${added.length} agregado(s)` : null,
    removed.length ? `${removed.length} quitado(s)` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <DiffBox label={label} hint={hint}>
      {removed.map((x) => (
        <RemovedLine key={`-${x}`}>{x}</RemovedLine>
      ))}
      {added.map((x) => (
        <AddedLine key={`+${x}`}>{x}</AddedLine>
      ))}
    </DiffBox>
  );
}

/** Cuánto se movió una fila, en palabras + flecha. */
function OrderMovement({ row }: { row: OrderRow }) {
  if (row.to === null) {
    return (
      <span className="text-xs text-muted-foreground">Salió de la lista</span>
    );
  }
  if (row.from === null) {
    return (
      <span className="text-xs font-medium text-green-700 dark:text-green-300">
        Nuevo en la lista
      </span>
    );
  }
  if (row.from === row.to) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus aria-hidden className="size-3" />
        Sin cambios
      </span>
    );
  }
  const up = row.from > row.to;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium",
        up
          ? "text-green-700 dark:text-green-300"
          : "text-amber-700 dark:text-amber-300",
      )}
    >
      <Icon aria-hidden className="size-3" />
      {up ? "Subió" : "Bajó"} desde el {ordinal(row.from)}
    </span>
  );
}

/**
 * Un reordenamiento: la lista como quedó, numerada, y al lado de cada elemento cuánto subió o
 * bajó. Lo que se movió va resaltado y lo que quedó en su lugar, atenuado — así se lee de un
 * vistazo como "se movió esto", en vez de un diff rojo/verde que parecía un alta de elementos.
 *
 * Las entradas viejas (antes de guardar el orden anterior) solo saben cómo quedó la lista: se
 * muestra el orden final y se aclara que el anterior no se registró.
 */
function OrderDiff({
  label,
  rows,
  hasBefore,
}: {
  label: string;
  rows: OrderRow[];
  hasBefore: boolean;
}) {
  const moved = rows.filter((r) => r.from !== r.to).length;
  const hint = hasBefore
    ? moved === 0
      ? "Nada cambió de lugar"
      : `${moved} de ${rows.length} cambiaron de lugar`
    : "Orden final";
  return (
    <DiffBox label={label} hint={hint}>
      {!hasBefore ? (
        <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
          Esta entrada es anterior a que se guardara el orden previo: solo se
          sabe cómo quedó la lista.
        </p>
      ) : null}
      <ol className="divide-y divide-border">
        {rows.map((row) => {
          const changed = hasBefore && row.from !== row.to;
          return (
            <li
              key={row.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2",
                changed ? "bg-muted/40" : null,
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
                  changed
                    ? "border-foreground/30 font-semibold text-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {row.to ?? "–"}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 break-words",
                  row.to === null && "text-muted-foreground line-through",
                  hasBefore && !changed && "text-muted-foreground",
                  changed && "font-medium",
                )}
              >
                {row.name}
              </span>
              {hasBefore ? <OrderMovement row={row} /> : null}
            </li>
          );
        })}
      </ol>
    </DiffBox>
  );
}

/** Tramos de palabras de una línea reemplazada: lo que cambió va resaltado más fuerte. */
function WordParts({
  parts,
  tone,
}: {
  parts: WordPart[];
  tone: "del" | "add";
}) {
  return (
    <>
      {parts.map((p, i) =>
        p.op === "same" ? (
          <span key={i}>{p.text}</span>
        ) : (
          <mark
            key={i}
            className={cn(
              "rounded-sm text-inherit",
              tone === "del"
                ? "bg-red-300/70 dark:bg-red-800/80"
                : "bg-green-300/70 dark:bg-green-800/80",
            )}
          >
            {p.text}
          </mark>
        ),
      )}
    </>
  );
}

/**
 * Texto largo (descripciones, cuerpo de una noticia, markdown): diff por líneas, con las
 * palabras cambiadas resaltadas y las líneas iguales lejanas colapsadas. Así un cambio de
 * una coma en una descripción de 2000 caracteres se ve como una coma, no como dos párrafos.
 */
function TextDiff({
  label,
  lines,
  wholesale,
}: {
  label: string;
  lines: TextDiffLine[];
  wholesale: boolean;
}) {
  return (
    <DiffBox label={label}>
      <div className="whitespace-pre-wrap">
        {lines.map((line, i) => {
          if (line.op === "gap") {
            return (
              <div
                key={i}
                className="border-y border-dashed border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground"
              >
                ⋯ {line.count} línea(s) sin cambios
              </div>
            );
          }
          if (line.op === "same") {
            return (
              <div key={i} className="px-3 py-1 pl-7 text-muted-foreground">
                {line.text || " "}
              </div>
            );
          }
          const content = line.parts ? (
            <WordParts parts={line.parts} tone={line.op} />
          ) : (
            line.text || " "
          );
          // Un texto entero que aparece o desaparece no necesita tachado: ya es todo rojo o
          // todo verde.
          return line.op === "del" ? (
            <RemovedLine key={i} plain={wholesale || Boolean(line.parts)}>
              {content}
            </RemovedLine>
          ) : (
            <AddedLine key={i}>{content}</AddedLine>
          );
        })}
      </div>
    </DiffBox>
  );
}

/** Miniatura de una imagen en el diff, o un recuadro vacío si no había. */
function DiffImage({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex aspect-video items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">
        Sin imagen
      </div>
    );
  }
  return (
    <a href={src} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de un host arbitrario guardado en la auditoría; next/image exigiría allowlistear cada host histórico. */}
      <img
        src={src}
        alt={alt}
        className="aspect-video w-full rounded border border-border object-cover"
      />
    </a>
  );
}

/** Imagen: la anterior y la nueva lado a lado, en vez de dos URLs largas. */
function ImageDiff({
  label,
  before,
  after,
}: {
  label: string;
  before: string | null;
  after: string | null;
}) {
  return (
    <DiffBox label={label}>
      <div className="grid grid-cols-2 gap-3 p-3">
        <figure className="space-y-1">
          <figcaption className="text-xs text-red-700 dark:text-red-300">
            Antes
          </figcaption>
          <DiffImage src={before} alt={`${label} anterior`} />
        </figure>
        <figure className="space-y-1">
          <figcaption className="text-xs text-green-700 dark:text-green-300">
            Después
          </figcaption>
          <DiffImage src={after} alt={`${label} nueva`} />
        </figure>
      </div>
    </DiffBox>
  );
}

const ITEM_STATUS_LABELS: Record<ItemRow["status"], string> = {
  added: "Agregada",
  removed: "Quitada",
  changed: "Modificada",
};

/**
 * Lista de registros (las preguntas de un formulario, las preguntas frecuentes de un
 * espacio): qué se agregó, qué se quitó y, en lo que cambió, el diff de cada campo — en vez
 * de dos listas enteras para comparar a ojo.
 */
function ItemsDiff({
  label,
  rows,
  unchanged,
}: {
  label: string;
  rows: ItemRow[];
  unchanged: number;
}) {
  const hint = unchanged > 0 ? `${unchanged} sin cambios` : undefined;
  return (
    <DiffBox label={label} hint={hint}>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.key} className="space-y-2 px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "min-w-0 break-words font-medium",
                  row.status === "removed" &&
                    "text-muted-foreground line-through",
                )}
              >
                {row.name}
              </span>
              <span
                className={cn(
                  "shrink-0 text-xs",
                  row.status === "added" &&
                    "text-green-700 dark:text-green-300",
                  row.status === "removed" && "text-red-700 dark:text-red-300",
                  row.status === "changed" && "text-muted-foreground",
                )}
              >
                {ITEM_STATUS_LABELS[row.status]}
              </span>
            </div>
            {row.changes.length > 0 ? (
              <div className="space-y-2">
                {row.changes.map((c) => (
                  <ChangeDiff key={c.key} change={c} />
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </DiffBox>
  );
}

function AuditDetailPanel({ item }: { item: AuditLogListItem }) {
  const changes = entryFieldChanges(item);
  // En un alta o una baja no hay "cambios": son los datos con los que se creó, o los que
  // tenía lo que se eliminó.
  const kind = auditEventDef(item.action)?.kind;
  const changesTitle =
    kind === "create"
      ? "Datos"
      : kind === "delete"
        ? "Datos al eliminar"
        : "Cambios";
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
            <p className="font-medium">{changesTitle}</p>
            {changes.map((c) => (
              <ChangeDiff key={c.key} change={c} />
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
