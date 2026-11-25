import { InviteesManager } from "@/components/organisms/admin/invitees-manager";
import { requirePagePermission } from "@/lib/page-auth";

/**
 * Invitados de un evento privado (milestone 43). Los datos los trae el componente desde
 * `/api/admin/events/[id]/invitees`; la página solo exige el permiso (todas las de `/admin` lo
 * hacen: `admin-page-guards.test.ts`).
 */
export default async function InviteesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("events:manage");
  const { id } = await params;
  return <InviteesManager eventId={id} />;
}
