"use client";

import { useApi } from "@/hooks/use-api";
import { invalidateApi } from "@/lib/api/client";
import type { MaintenanceAreaId } from "@/lib/maintenance/areas";
import {
  findWriteBlockForArea,
  type MaintenanceSnapshot,
  type StatefulWindow,
} from "@/lib/maintenance/evaluate";
import { createContext, useContext, useEffect } from "react";

/**
 * Evento que dispara `src/lib/api/client.ts` cuando una acción choca con un 503 de
 * mantenimiento: el aviso se actualiza al instante en vez de esperar al próximo sondeo.
 */
export const MAINTENANCE_REFRESH_EVENT = "lanube:maintenance-refresh";

const EMPTY: StatefulWindow[] = [];
const MaintenanceContext = createContext<StatefulWindow[]>(EMPTY);

/**
 * Trae las ventanas de mantenimiento vigentes y próximas (`GET /api/maintenance`, público) y
 * las comparte con el aviso del sitio y con los formularios que se deshabilitan. Se actualiza
 * cada minuto. Si la consulta falla no se muestra nada: un aviso de mantenimiento nunca debe
 * ser la causa de un error en pantalla.
 */
export function MaintenanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data, refetch } = useApi<MaintenanceSnapshot>("/api/maintenance", {
    ttlMs: 30_000,
    refreshIntervalMs: 60_000,
  });

  useEffect(() => {
    const onRefresh = () => {
      invalidateApi("/api/maintenance");
      void refetch();
    };
    window.addEventListener(MAINTENANCE_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(MAINTENANCE_REFRESH_EVENT, onRefresh);
  }, [refetch]);

  return (
    <MaintenanceContext.Provider value={data?.windows ?? EMPTY}>
      {children}
    </MaintenanceContext.Provider>
  );
}

/** Las ventanas vigentes y próximas. */
export function useMaintenanceWindows(): StatefulWindow[] {
  return useContext(MaintenanceContext);
}

/**
 * La ventana vigente que impide escribir en `area` (o `null`). Un formulario la usa para
 * deshabilitar su botón y mostrar el motivo **antes** de que la persona lo complete.
 */
export function useAreaWriteBlock(
  area: MaintenanceAreaId,
): StatefulWindow | null {
  return findWriteBlockForArea(useContext(MaintenanceContext), area);
}
