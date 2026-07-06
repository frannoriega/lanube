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

export function updateUserProfile(body: {
  name: string;
  lastName: string;
  dni: string;
  institution?: string;
  reasonToJoin: string;
}): Promise<unknown> {
  return apiSend("/api/user/profile", "PUT", body);
}
