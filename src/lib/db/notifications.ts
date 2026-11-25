import "server-only";
import { prisma } from "@/lib/prisma";

export interface NotificationListItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  readAt: number | null;
  createdAt: number;
}

export interface NotificationsForUser {
  items: NotificationListItem[];
  unreadCount: number;
}

const LIST_LIMIT = 20;

/** Most recent notifications for the bell, plus the total unread count (not just this page). */
export async function listNotificationsForUser(
  recipientId: string,
): Promise<NotificationsForUser> {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId },
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
    }),
    prisma.notification.count({ where: { recipientId, readAt: null } }),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      data: r.data,
      readAt: r.readAt === null ? null : Number(r.readAt),
      createdAt: Number(r.createdAt),
    })),
    unreadCount,
  };
}

/** Marks given ids read, or every unread notification for the user when `ids` is omitted. */
export async function markNotificationsRead(
  recipientId: string,
  ids?: readonly string[],
): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      recipientId,
      readAt: null,
      ...(ids ? { id: { in: [...ids] } } : {}),
    },
    data: { readAt: BigInt(Date.now()) },
  });
}

/**
 * Borra notificaciones **propias** (milestone 40, F5): las `ids` dadas, o todas si se omiten.
 * Borrado real y no un `dismissedAt`: un aviso in-app es efímero, no es evidencia de nada (la
 * auditoría vive en `audit_logs` y el correo, si hubo, ya salió). El `recipientId` en el `where`
 * es lo que impide borrar avisos ajenos: un id de otra persona simplemente no coincide.
 * Devuelve cuántas se borraron.
 */
export async function deleteNotifications(
  recipientId: string,
  ids?: readonly string[],
): Promise<number> {
  const { count } = await prisma.notification.deleteMany({
    where: { recipientId, ...(ids ? { id: { in: [...ids] } } : {}) },
  });
  return count;
}
