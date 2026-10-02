import type { StatusTone } from "@/components/atoms/status-badge";
import type { ProfileChangeStatus } from "@/types/api";

/**
 * Textos y tonos de las solicitudes de cambio de DNI / motivo (milestone 17), compartidos
 * por la página del usuario y la cola del admin.
 */
export const PROFILE_CHANGE_STATUS: Record<
  ProfileChangeStatus,
  { label: string; tone: StatusTone }
> = {
  PENDING: { label: "Pendiente", tone: "warning" },
  APPROVED: { label: "Aprobada", tone: "success" },
  REJECTED: { label: "Rechazada", tone: "danger" },
  CANCELLED: { label: "Cancelada", tone: "neutral" },
};
