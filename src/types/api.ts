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
  role: string;
  createdAt: string;
  updatedAt: string;
}
