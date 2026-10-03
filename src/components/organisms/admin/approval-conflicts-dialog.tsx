"use client";

/**
 * Confirmación de una aprobación que rechaza otras reservas.
 *
 * Aprobar una reserva puede rechazar automáticamente reservas pendientes de otras personas
 * (ver `getApprovalPreview`). Este diálogo solo aparece en ese caso —sin conflictos se aprueba
 * directo— y su trabajo es que el admin decida informado: por cada reserva que se rechazaría
 * muestra quién la pidió y cómo contactarla, cuándo choca (todas las fechas, en una
 * recurrente), cuántas personas son, para qué la pidió, cuándo la pidió (quién llegó primero)
 * y **por qué** se rechazaría. Antes listaba los ids internos, que no decían nada.
 *
 * Lo comparten el dashboard y `/admin/reservations`. Se abre desde el detalle de la reserva
 * (un `Sheet`), por eso usa `aboveSheet`.
 */

import { ToneBadge } from "@/components/atoms/status-badge";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import { Button } from "@/components/ui/button";
import type {
  ApprovalConflict,
  ApprovalConflictKind,
  ApprovalPreview,
  TimeWindow,
} from "@/lib/reservations/approval-conflicts";
import { formatTimeShort } from "@/lib/utils/date";
import { CalendarClock, Mail, Repeat, Users } from "lucide-react";

/** Cuántas franjas superpuestas se listan antes de resumir el resto ("y N fechas más"). */
const MAX_OVERLAPS_SHOWN = 3;

/** "mié 08/10 · 09:15–10:15", en la zona horaria de quien mira. */
function formatWindow({ start, end }: TimeWindow): string {
  const d = new Date(start);
  // Día de la semana y fecha por separado: juntos, es-AR devuelve "mié 08-10" (con guion).
  const weekday = d.toLocaleDateString("es-AR", { weekday: "short" });
  const day = d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
  return `${weekday} ${day} · ${formatTimeShort(d)}–${formatTimeShort(new Date(end))}`;
}

/** "08/10/2026 14:32" — cuándo se pidió la reserva. */
function formatRequestedAt(ms: number): string {
  const d = new Date(ms);
  const day = d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${day} ${formatTimeShort(d)}`;
}

/** Etiqueta corta + explicación en una frase del motivo del rechazo. */
function describeKind(
  kind: ApprovalConflictKind,
  conflict: ApprovalConflict,
  space: ApprovalPreview["space"],
): { label: string; detail: string } {
  const spaceName = space?.name ?? "el espacio";
  switch (kind) {
    case "EXCLUSIVE":
      return {
        label: "Espacio exclusivo",
        detail: `${spaceName} admite una sola reserva a la vez.`,
      };
    case "CAPACITY":
      return {
        label: "Supera la capacidad",
        detail: `Juntas superan la capacidad de ${spaceName} (${space?.capacity ?? "?"} personas).`,
      };
    case "SAME_PERSON":
      return {
        label: "Misma persona",
        detail: `Es otra reserva de la misma persona, en ${conflict.spaceName ?? "otro espacio"}, a la misma hora.`,
      };
  }
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function ConflictCard({
  conflict,
  space,
}: {
  conflict: ApprovalConflict;
  space: ApprovalPreview["space"];
}) {
  const { label, detail } = describeKind(conflict.kind, conflict, space);
  const shown = conflict.overlaps.slice(0, MAX_OVERLAPS_SHOWN);
  const hidden = conflict.overlaps.length - shown.length;
  const reason = conflict.reason.trim();

  return (
    <li className="space-y-2 rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {conflict.ownerName ?? conflict.reservationTypeName}
          </p>
          {conflict.institution ? (
            <p className="text-xs text-muted-foreground">
              {conflict.institution}
            </p>
          ) : null}
        </div>
        <ToneBadge tone="danger">{label}</ToneBadge>
      </div>

      <p className="text-xs text-muted-foreground">{detail}</p>

      {conflict.email ? (
        <p className="flex items-center gap-1.5 break-all text-xs">
          <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {conflict.email}
        </p>
      ) : null}

      <div className="flex items-start gap-1.5 text-xs">
        <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <div>
          <span className="text-muted-foreground">Se superpone: </span>
          {shown.map((w, i) => (
            <span key={w.start} className="font-medium">
              {i > 0 ? ", " : null}
              {formatWindow(w)}
            </span>
          ))}
          {hidden > 0 ? (
            <span className="text-muted-foreground">
              {" "}
              y {hidden} {plural(hidden, "fecha más", "fechas más")}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" aria-hidden />
          {conflict.actorSize}{" "}
          {plural(conflict.actorSize, "persona", "personas")}
        </span>
        {conflict.isRecurring ? (
          <span className="flex items-center gap-1.5">
            <Repeat className="h-3.5 w-3.5" aria-hidden />
            Recurrente
          </span>
        ) : null}
        {conflict.kind === "SAME_PERSON" && conflict.spaceName ? (
          <span>{conflict.spaceName}</span>
        ) : null}
        <span className="text-muted-foreground">
          Pedida el {formatRequestedAt(conflict.createdAt)}
        </span>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Motivo</p>
        {reason ? (
          <p className="mt-0.5 max-h-20 overflow-y-auto rounded border border-border/60 bg-muted/30 px-2 py-1 text-xs break-words whitespace-pre-wrap">
            {reason}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Sin motivo</p>
        )}
      </div>
    </li>
  );
}

export function ApprovalConflictsDialog({
  preview,
  onCancel,
  onConfirm,
  confirming,
}: {
  /** `null` = cerrado. */
  preview: Pick<ApprovalPreview, "conflicts" | "space"> | null;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const count = preview?.conflicts.length ?? 0;

  return (
    <ResponsiveDialog
      open={!!preview}
      onOpenChange={(open) => !open && onCancel()}
    >
      <ResponsiveDialogContent
        aboveSheet
        // En escritorio (`md`, donde es un Dialog) scrollea solo la lista: título y botones quedan siempre a la vista
        // (con varias reservas, el pie quedaba debajo del borde de la ventana).
        className="flex max-h-[85vh] flex-col sm:max-w-xl"
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {count === 1
              ? "Aprobar rechaza otra reserva"
              : `Aprobar rechaza otras ${count} reservas`}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {count === 1
              ? "Esta reserva pendiente se rechazará automáticamente y se le avisará a quien la pidió."
              : "Estas reservas pendientes se rechazarán automáticamente y se le avisará a cada persona."}{" "}
            Revisalas antes de confirmar.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ul className="space-y-3 md:-mx-1 md:min-h-0 md:flex-1 md:overflow-y-auto md:px-1">
          {preview?.conflicts.map((c) => (
            <ConflictCard key={c.id} conflict={c} space={preview.space} />
          ))}
        </ul>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={confirming}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={confirming}>
            {confirming ? "Aprobando..." : `Aprobar y rechazar ${count}`}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
