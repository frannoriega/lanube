import { ProfileRequestsQueue } from "@/components/organisms/admin/profile-requests-queue";
import { requirePagePermission } from "@/lib/page-auth";

/** Cola de solicitudes de cambio de DNI / motivo para unirse (milestone 17). */
export default async function ProfileRequestsPage() {
  await requirePagePermission("users:profile-requests:review");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cambios de datos</h1>
        <p className="text-muted-foreground">
          Pedidos de cambio de DNI o de motivo para unirse. Nadie los edita
          directo: la persona pide y alguien del equipo aprueba o rechaza.
        </p>
      </div>
      <ProfileRequestsQueue />
    </div>
  );
}
