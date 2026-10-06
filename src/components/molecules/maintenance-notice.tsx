"use client";

import { MaintenanceMessage } from "@/components/organisms/maintenance/maintenance-banner";
import { useAreaWriteBlock } from "@/components/providers/maintenance";
import type { MaintenanceAreaId } from "@/lib/maintenance/areas";
import { cn } from "@/lib/utils";

/**
 * El motivo del mantenimiento **dentro de un formulario** que está apagado (milestone 22):
 * quien llegó a `/auth/signup` tiene que enterarse antes de completar nada, y el aviso del
 * sitio arriba de la página no alcanza. Pensado para usarse junto con `useAreaWriteBlock`,
 * que además deshabilita el botón de envío. No renderiza nada si el área anda.
 */
export function AreaMaintenanceNotice({
  area,
  className,
}: {
  area: MaintenanceAreaId;
  className?: string;
}) {
  const block = useAreaWriteBlock(area);
  if (!block) return null;
  return <MaintenanceMessage window={block} className={cn(className)} />;
}
