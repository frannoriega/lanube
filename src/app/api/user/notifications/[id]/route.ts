import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { deleteNotifications } from "@/lib/db/notifications";

/**
 * DELETE: borra una notificación propia (milestone 40, F5). Una ajena o inexistente da el mismo
 * 404 (no se distingue: no revela ids de otras personas).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireActiveSession();
  if (error) return error;
  const { id } = await params;
  try {
    const deleted = await deleteNotifications(session.userId, [id]);
    if (deleted === 0) return apiError("Notificación no encontrada", 404);
    return apiSuccess({ deleted });
  } catch (err) {
    return apiCatch("user/notifications/[id] DELETE", err);
  }
}
