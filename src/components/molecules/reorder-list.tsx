"use client";

/**
 * Modo "Reordenar" compartido (milestone 14, decisión Part B.3).
 *
 * Reemplaza los campos numéricos de orden ("Orden", "Prioridad", "Orden entre destacados")
 * y las flechas arriba/abajo por **arrastrar y soltar dentro de un modo explícito**: la lista
 * solo se puede reordenar después de tocar "Reordenar", para que un arrastre accidental
 * (scrolleando en el teléfono, por ejemplo) nunca cambie nada. En ese modo:
 *   - cada fila muestra una **manija de puntos al final** (estilo playlist de Spotify) que es
 *     lo único que se arrastra; el resto de la fila es estático;
 *   - funciona con mouse, con dedo (sensor táctil con una pequeña demora, así un deslizamiento
 *     sigue siendo scroll) y con **teclado**: foco en la manija → Espacio para levantar →
 *     flechas para mover → Espacio para soltar (Esc cancela). `@dnd-kit` anuncia cada paso
 *     por una región `aria-live`, con los textos en castellano de abajo;
 *   - nada se guarda hasta "Guardar orden"; "Cancelar" descarta.
 *
 * El componente no sabe nada de la entidad: recibe `{ id, label }` y llama a `onSave` con
 * los ids en el nuevo orden (de arriba hacia abajo). Cada lista decide qué significa ese
 * orden al persistir (p. ej. en los temas del landing, arriba = mayor prioridad).
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState } from "react";

export interface ReorderItem {
  id: string;
  label: string;
  /** Texto secundario opcional (p. ej. la ventana de un tema). */
  description?: string;
}

/** Textos para lectores de pantalla durante el arrastre con teclado. */
function announcements(items: ReorderItem[]): Announcements {
  const name = (id: string | number) =>
    items.find((i) => i.id === id)?.label ?? String(id);
  const pos = (id: string | number | undefined) =>
    id === undefined ? 0 : items.findIndex((i) => i.id === id) + 1;
  return {
    onDragStart: ({ active }) =>
      `Levantaste ${name(active.id)}, posición ${pos(active.id)} de ${items.length}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${name(active.id)} pasó a la posición ${pos(over.id)} de ${items.length}.`
        : `${name(active.id)} está fuera de la lista.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Soltaste ${name(active.id)} en la posición ${pos(over.id)} de ${items.length}.`
        : `Soltaste ${name(active.id)}.`,
    onDragCancel: ({ active }) =>
      `Se canceló el movimiento de ${name(active.id)}.`,
  };
}

export function ReorderList({
  items: initialItems,
  onSave,
  onCancel,
  hint,
}: {
  items: ReorderItem[];
  /** Persiste el nuevo orden (ids de arriba hacia abajo). Si lanza, la lista queda en modo edición. */
  onSave: (orderedIds: string[]) => Promise<void>;
  onCancel: () => void;
  /** Una línea que explica qué significa el orden (p. ej. "El de arriba gana"). */
  hint?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [saving, setSaving] = useState(false);
  const dirty = items.some((item, i) => item.id !== initialItems[i]?.id);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // En táctil, mantener apretado un instante antes de arrastrar: un deslizamiento rápido
    // sobre la manija sigue siendo scroll de la página.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === active.id);
      const to = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, from, to);
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(items.map((i) => i.id));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements: announcements(items),
          screenReaderInstructions: {
            draggable:
              "Para mover este elemento, presioná Espacio. Usá las flechas para cambiarlo de lugar y Espacio de nuevo para soltarlo. Escape cancela.",
          },
        }}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {items.map((item, index) => (
              <SortableRow key={item.id} item={item} position={index + 1} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </Button>
        <Button type="button" onClick={save} disabled={!dirty || saving}>
          {saving ? "Guardando…" : "Guardar orden"}
        </Button>
      </div>
    </div>
  );
}

function SortableRow({
  item,
  position,
}: {
  item: ReorderItem;
  position: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 bg-card px-4 py-3",
        isDragging && "relative z-10 shadow-lg ring-2 ring-ring",
      )}
    >
      <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
        {position}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium [overflow-wrap:anywhere]">{item.label}</div>
        {item.description ? (
          <div className="text-sm text-muted-foreground">
            {item.description}
          </div>
        ) : null}
      </div>
      {/* La manija es lo único que se arrastra (y lo único enfocable para mover con teclado). */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Mover ${item.label}`}
        className="-mr-2 flex h-10 w-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5" aria-hidden />
      </button>
    </li>
  );
}
