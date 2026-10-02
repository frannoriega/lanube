import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiSuccess } from "@/lib/api/response";
import { cancelProfileChangeRequest } from "@/lib/db/profileChangeRequests";
import { NextRequest } from "next/server";

/** DELETE: el usuario retira su propia solicitud mientras sigue pendiente. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;
    const { id } = await params;
    await cancelProfileChangeRequest(session.userId, id);
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiCatch("user/profile/change-requests DELETE", err);
  }
}
