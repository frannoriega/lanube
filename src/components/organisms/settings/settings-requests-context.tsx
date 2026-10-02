"use client";

import { createContext, useContext } from "react";
import { useOwnProfileChangeRequests } from "@/hooks/api";
import type { UseApiResult } from "@/hooks/use-api";
import type { ProfileChangeRequestItem } from "@/types/api";

/**
 * Las solicitudes de cambio del usuario las leen dos piezas a la vez: la navegación (punto
 * de "pendiente" en Identidad) y la página de Identidad. Dos `useApi` separados comparten
 * caché pero no estado, así que al crear o cancelar una solicitud el punto quedaba viejo.
 * Este contexto, montado en el layout de Configuración, hace que las dos lean la misma
 * instancia y un `refetch` actualice ambas.
 */
const SettingsRequestsContext = createContext<UseApiResult<
  ProfileChangeRequestItem[]
> | null>(null);

export function SettingsRequestsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useOwnProfileChangeRequests();
  return (
    <SettingsRequestsContext.Provider value={value}>
      {children}
    </SettingsRequestsContext.Provider>
  );
}

export function useSettingsRequests(): UseApiResult<
  ProfileChangeRequestItem[]
> {
  const ctx = useContext(SettingsRequestsContext);
  if (!ctx) {
    throw new Error(
      "useSettingsRequests debe usarse dentro de SettingsRequestsProvider",
    );
  }
  return ctx;
}
