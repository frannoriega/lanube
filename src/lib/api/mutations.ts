/**
 * Typed mutation helpers. Each throws `ApiError` (with the server's
 * `message`) on failure — see `apiErrorMessage` for toasts.
 */

import { apiSend } from "@/lib/api/client";

export type ReservationReviewResult = {
  autoRejectedIds?: string[];
};

export function reviewAdminReservation(
  reservationId: string,
  body: {
    status: "APPROVED" | "REJECTED";
    preview?: boolean;
    deniedReason?: string;
  },
): Promise<ReservationReviewResult> {
  return apiSend<ReservationReviewResult>(
    `/api/admin/reservations/${reservationId}`,
    "PATCH",
    body,
  );
}

export function checkOutUser(userId: string): Promise<unknown> {
  return apiSend(`/api/admin/checkin/${userId}`, "PATCH", {
    action: "checkout",
  });
}

export function createIncident(body: {
  subject: string;
  description: string;
}): Promise<unknown> {
  return apiSend("/api/admin/incidents", "POST", body);
}

export function updateIncidentStatus(
  incidentId: string,
  status: string,
): Promise<unknown> {
  return apiSend(`/api/admin/incidents/${incidentId}`, "PATCH", { status });
}

/** Datos personales editables (milestone 17: el DNI y el motivo ya no van acá). */
export function updateUserProfile(body: {
  name: string;
  lastName: string;
  institution: string;
}): Promise<unknown> {
  return apiSend("/api/user/profile", "PUT", body);
}

/** Pedir un cambio de DNI o de motivo para unirse; lo resuelve un admin. */
export function createProfileChangeRequest(body: {
  field: "DNI" | "REASON_TO_JOIN";
  requestedValue: string;
  justification: string;
}): Promise<unknown> {
  return apiSend("/api/user/profile/change-requests", "POST", body);
}

/** Retirar una solicitud propia pendiente. */
export function cancelProfileChangeRequest(id: string): Promise<unknown> {
  return apiSend(`/api/user/profile/change-requests/${id}`, "DELETE");
}

/** Admin: aprobar o rechazar (rechazar exige motivo). */
export function decideProfileChangeRequest(
  id: string,
  body: { decision: "approve" | "reject"; reason?: string },
): Promise<unknown> {
  return apiSend(`/api/admin/profile-requests/${id}/decision`, "POST", body);
}
