import { LandingThemesManager } from "@/components/organisms/admin/config/landing-themes-manager";
import { requirePagePermission } from "@/lib/page-auth";

export default async function LandingThemesPage() {
  await requirePagePermission("landing-themes:manage");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Temas del landing
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Fechas especiales (aniversario, fin de año, …) en las que la portada
          celebra con la comunidad. Solo un tema está activo a la vez — el de
          mayor prioridad cuya ventana incluya la fecha de hoy.
        </p>
      </div>
      <LandingThemesManager />
    </div>
  );
}
