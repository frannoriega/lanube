"use client";

/**
 * Modo "Reordenar" **dentro de la misma tabla** (milestone 16).
 *
 * En el milestone 14 "Reordenar" reemplazaba la tabla por otra lista (`ReorderList`) — o, en
 * eventos y noticias, abría un modal. Cambiaba la pantalla justo cuando el admin quería ver
 * lo que estaba ordenando. Ahora la tabla se queda donde está: al tocar "Reordenar" cada
 * fila gana una manija al final, las acciones se ocultan (no se edita mientras se ordena),
 * y arriba aparece esta barra con Guardar/Cancelar. Se mantienen las garantías de antes:
 * nada cambia por un arrastre accidental (el modo es explícito), funciona con mouse, dedo y
 * teclado, y nada se guarda hasta "Guardar orden".
 *
 * Uso:
 * ```tsx
 * const reorder = useTableReorder(spaces, (ids) => apiSend(".../reorder", "POST", { orderedIds: ids }));
 * const table = useStaticTable(reorder.rows, columns);
 * <ReorderBar reorder={reorder} hint="El de arriba aparece primero." />
 * <DataTable table={table} reorder={reorder.active ? { onMove: reorder.move, nameOf: (s) => s.name } : undefined} />
 * ```
 */

import { Button } from "@/components/ui/button";
import { arrayMove } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { useState } from "react";

export interface TableReorder<T extends { id: string }> {
  /** `true` mientras se está reordenando. */
  active: boolean;
  /** Filas a mostrar: el borrador mientras se reordena, los datos reales si no. */
  rows: T[];
  /** `true` si el borrador difiere del orden guardado. */
  dirty: boolean;
  saving: boolean;
  start: () => void;
  cancel: () => void;
  /** Mueve la fila `activeId` al lugar de `overId` (lo llama el `DataTable`). */
  move: (activeId: string, overId: string) => void;
  save: () => Promise<void>;
}

/**
 * Estado del modo reordenar sobre una lista. `onSave` recibe los ids de arriba hacia abajo;
 * si lanza, el modo sigue abierto con el borrador intacto (el error lo informa quien llama).
 */
export function useTableReorder<T extends { id: string }>(
  items: T[],
  onSave: (orderedIds: string[]) => Promise<void>,
): TableReorder<T> {
  const [draft, setDraft] = useState<T[] | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty =
    draft !== null && draft.some((row, i) => row.id !== items[i]?.id);

  return {
    active: draft !== null,
    rows: draft ?? items,
    dirty,
    saving,
    start: () => setDraft(items),
    cancel: () => setDraft(null),
    move: (activeId, overId) =>
      setDraft((prev) => {
        if (!prev) return prev;
        const from = prev.findIndex((r) => r.id === activeId);
        const to = prev.findIndex((r) => r.id === overId);
        return from < 0 || to < 0 ? prev : arrayMove(prev, from, to);
      }),
    save: async () => {
      if (!draft) return;
      setSaving(true);
      try {
        await onSave(draft.map((r) => r.id));
        setDraft(null);
      } catch {
        // Quien llama ya mostró el error; el borrador queda para reintentar.
      } finally {
        setSaving(false);
      }
    },
  };
}

/**
 * Barra del modo reordenar: instrucciones + Cancelar/Guardar. No dibuja nada fuera del
 * modo (el botón "Reordenar" vive en el encabezado de cada página, junto a "Nuevo …").
 */
export function ReorderBar<T extends { id: string }>({
  reorder,
  hint,
}: {
  reorder: TableReorder<T>;
  /** Qué significa el orden (p. ej. "El de arriba gana"). */
  hint?: string;
}) {
  if (!reorder.active) return null;
  return (
    <div
      role="region"
      aria-label="Reordenar"
      className="flex flex-col gap-3 rounded-lg border border-ring/40 bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted-foreground">
        Arrastrá desde{" "}
        <GripVertical
          className="inline h-4 w-4 align-text-bottom"
          aria-hidden
        />{" "}
        para cambiar el orden (con teclado: Espacio para levantar, flechas para
        mover, Espacio para soltar).
        {hint ? ` ${hint}` : ""}
      </p>
      <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={reorder.cancel}
          disabled={reorder.saving}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={reorder.save}
          disabled={!reorder.dirty || reorder.saving}
        >
          {reorder.saving ? "Guardando…" : "Guardar orden"}
        </Button>
      </div>
    </div>
  );
}
