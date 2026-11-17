"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  OnChangeFn,
  Table as ReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/**
 * Botón «Columnas» que deja elegir qué columnas de un `DataTable` se ven (milestone 29).
 *
 * Nació en la tabla de inscriptos (`participants-table.tsx`) y se extrajo acá para que
 * cualquier tabla del panel lo use: alcanza con pasarle la instancia de TanStack Table, que
 * ya trae la visibilidad de columnas (`columnVisibility`). Lista solo las columnas que se
 * pueden ocultar (`getCanHide()`): una columna con `enableHiding: false` — selección,
 * acciones, la que identifica la fila — no aparece. El texto de cada opción es
 * `meta.label` (el mismo que usa la vista de tarjetas), o el id si no tiene.
 *
 * En teléfonos la tabla se ve como tarjetas, que leen `getVisibleCells()`: la elección se
 * respeta también ahí.
 */
export function DataTableColumnPicker<TData>({
  table,
}: {
  table: ReactTable<TData>;
}) {
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide());
  if (hideable.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-fit">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Columnas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Mostrar columnas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hideable.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(v) => column.toggleVisibility(!!v)}
            // Que el menú quede abierto al tildar: se suelen cambiar varias de una vez.
            onSelect={(e) => e.preventDefault()}
          >
            {column.columnDef.meta?.label ?? column.id}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Estado de visibilidad de columnas recordado por tabla en `localStorage` (milestone 29).
 *
 * Es una comodidad de quien mira (cada admin elige sus columnas en su navegador), no un dato
 * que tenga que compartirse o sobrevivir: si el almacenamiento no está disponible (ventana
 * privada, datos bloqueados) se usan los valores por defecto y la elección dura lo que dura
 * la página. Se lee en un efecto, no en el render, para que el HTML del servidor y el primer
 * render del cliente coincidan.
 *
 * `storageKey` identifica la tabla (p. ej. `"admin-users"`); se guarda bajo
 * `lanube:columns:<storageKey>`.
 */
export function usePersistedColumnVisibility(
  storageKey: string,
  defaults: VisibilityState = {},
): [VisibilityState, OnChangeFn<VisibilityState>] {
  const fullKey = `lanube:columns:${storageKey}`;
  const [visibility, setVisibility] = useState<VisibilityState>(defaults);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(fullKey);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const clean: VisibilityState = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "boolean") clean[k] = v;
        }
        setVisibility((prev) => ({ ...prev, ...clean }));
      }
    } catch {
      // Sin almacenamiento o con un valor corrupto: quedan los valores por defecto.
    }
  }, [fullKey]);

  const onChange = useCallback<OnChangeFn<VisibilityState>>(
    (updater) => {
      setVisibility((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        try {
          window.localStorage.setItem(fullKey, JSON.stringify(next));
        } catch {
          // Igual que al leer: si no se puede guardar, la elección vale solo en esta página.
        }
        return next;
      });
    },
    [fullKey],
  );

  return [visibility, onChange];
}
