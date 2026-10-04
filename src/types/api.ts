/**
 * Response payload types for the internal JSON API, shared by the typed
 * hooks in `@/hooks/api` and the mutation helpers in `@/lib/api/mutations`.
 */

/** GET /api/admin/stats */
export interface AdminStats {
  todayUsers: number;
  weekUsers: number;
  monthUsers: number;
  pendingReservations: number;
  approvedReservations: number;
  rejectedReservations: number;
  currentUsers: {
    id: string;
    name: string;
    lastName: string;
    checkInTime: number;
    reservationEndTime: number | null;
    service: string;
  }[];
  recentReservations: {
    id: string;
    user: {
      name: string;
      lastName: string;
    };
    service: string;
    startTime: number;
    endTime: number;
    status: string;
    reason: string;
  }[];
}

/** GET /api/user/stats */
export interface UserDashboardStats {
  upcomingReservations: number;
  totalTimeThisWeek: number;
  totalTimeThisMonth: number;
  recentReservations: {
    id: string;
    service: string;
    serviceType: string;
    startTime: number;
    endTime: number;
    status: string;
    reason: string | null;
  }[];
}

/** GET /api/admin/checkin/current */
export interface CheckedInUser {
  id: string;
  name: string;
  lastName: string;
  email: string;
  dni: string;
  checkInTime: number;
  reservationEndTime: number | null;
  service: string;
  reservationId: string;
}

/** GET /api/admin/incidents */
export interface Incident {
  id: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  incidentUsers: {
    user: {
      name: string;
      lastName: string;
      email: string;
      dni: string;
    };
  }[];
}

/** GET /api/user/profile */
export interface UserProfile {
  id: string;
  name: string;
  lastName: string;
  email: string;
  displayEmail: string | null;
  dni: string;
  institution: string | null;
  reasonToJoin: string;
  /** Nombre del rol, o `null` en el nivel base. */
  role: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Estado de una solicitud de cambio de DNI / motivo (milestone 17). */
export type ProfileChangeStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

/** Una solicitud de cambio de DNI / motivo, tal como la ve su autor. */
export interface ProfileChangeRequestItem {
  id: string;
  field: "DNI" | "REASON_TO_JOIN";
  currentValue: string;
  requestedValue: string;
  justification: string;
  status: ProfileChangeStatus;
  decisionReason: string | null;
  /** UNIX ms (BigInt serializado). */
  decidedAt: number | null;
  createdAt: number;
}

/** Fila de la cola del admin (`GET /api/admin/profile-requests`). */
export interface AdminProfileChangeRequestItem extends ProfileChangeRequestItem {
  requester: { id: string; name: string; lastName: string; email: string };
  decidedBy: { name: string; lastName: string } | null;
  dniConflict: boolean;
}

export interface AdminProfileChangeRequestPage {
  items: AdminProfileChangeRequestItem[];
  total: number;
  pendingCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Una passkey del usuario (sin material criptográfico). */
/** Un asistente conectado por MCP (milestone 20): un grant OAuth vigente. */
export interface ConnectedAssistantItem {
  id: string;
  /** Nombre **declarado** por el cliente ("Claude"). */
  clientName: string;
  /** Dominio verificable del cliente (el de su redirect_uri o su CIMD). */
  clientHost: string;
  kind: "DCR" | "CIMD";
  scopes: string[];
  createdAt: number;
  lastUsedAt: number | null;
}

export interface PasskeyItem {
  id: string;
  label: string;
  /** "singleDevice" | "multiDevice" (sincronizada). */
  deviceType: string;
  backedUp: boolean;
  createdAt: number;
  lastUsedAt: number | null;
}
