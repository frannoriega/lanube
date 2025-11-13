import { prisma } from "@/lib/prisma";
import { ReservationStatus, ResourceType, UserRole } from "@prisma/client";

/**
 * Admin Reservations DB helpers
 *
 * These functions encapsulate admin-facing queries and updates related
 * to reservations, and are intended to be used by API routes.
 */

/**
 * Returns true if the given userId belongs to an admin RegisteredUser.
 */
/**
 * Returns whether a given userId corresponds to an ADMIN registered user.
 */
export async function isAdminUser(id: string): Promise<boolean> {
  const user = await prisma.registeredUser.findUnique({ where: { id } });
  return !!user && user.role === UserRole.ADMIN;
}

/**
 * Lists reservations for a given resource type, including related user and resource data.
 */
/**
 * Lists reservations filtered by resource type, including basic user and resource info.
 */
export interface AdminReservationListResult {
  id: string;
  startTime: Date;
  endTime: Date;
  reason: string;
  status: string;
  createdAt: Date;
  deniedReason?: string | null;
  resource: {
    id: string;
    name: string;
    type: ResourceType;
  };
  registeredUser: {
    name: string;
    lastName: string;
    dni: string;
    institution: string | null;
    user: {
      email: string;
    }
  };
}

export async function listAdminReservationsByType(
  service: ResourceType
): Promise<AdminReservationListResult[]> {
  return prisma.reservation.findMany({
    where: {
      resource: {
        type: service,
      },
    },
    include: {
      resource: true,
      registeredUser: {
        select: {
          name: true,
          lastName: true,
          dni: true,
          institution: true,
          user: {
            select: { email: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Updates reservation status for admin workflows.
 */
/**
 * Updates the status of a reservation by id.
 */
export async function setReservationStatus(
  reservationId: string,
  status: ReservationStatus,
  deniedReason?: string
) {
  return prisma.reservation.update({
    where: { id: reservationId },
    data: {
      status,
      ...(status === 'REJECTED' && deniedReason ? { deniedReason } : {}),
    },
  });
}

/**
 * Approves a reservation and rejects conflicting pending reservations in one DB transaction.
 * Returns the approved id and the list of auto-rejected ids.
 */
export async function approveReservationAndRejectConflicts(
  reservationId: string,
  // deniedReason?: string
): Promise<{ approvedId: string | null; autoRejectedIds: string[] }> {
  // Call the SQL function that handles approval and conflict resolution
  const rows = await prisma.$queryRaw<{ approved_id: string; auto_rejected_ids: string }[]>`
    SELECT * FROM approve_reservation(${reservationId}::text)
  `;
  
  const approvedId = rows?.[0]?.approved_id ?? null;
  const autoRejectedCsv = rows?.[0]?.auto_rejected_ids as string | null;
  const autoRejectedIds = autoRejectedCsv ? autoRejectedCsv.split(',').filter(Boolean) : [];
  
  return { approvedId, autoRejectedIds };
}

/**
 * Previews which pending reservations would be rejected if the given reservation is approved.
 * This is the same as approveReservationAndRejectConflicts but without actually making changes.
 */
export async function previewConflictingPending(/*reservationId: string*/): Promise<string[]> {
  // We can simulate this by checking the ledger for conflicts
  // For now, we'll just return empty since the SQL function doesn't have a preview mode
  // The admin can see the result after approval
  return [];
}


