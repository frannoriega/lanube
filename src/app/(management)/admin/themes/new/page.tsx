import { LandingThemeForm } from "@/components/organisms/admin/config/landing-theme-form";
import { requirePagePermission } from "@/lib/page-auth";

/** Alta de tema del landing como página (milestone 14: antes era un diálogo). */
export default async function NewLandingThemePage() {
  await requirePagePermission("landing-themes:manage");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Nuevo tema
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Los colores y textos disponibles están acotados a lo que ya usa la
          marca — no es un editor de estilos libre.
        </p>
      </div>
      <LandingThemeForm />
    </div>
  );
}
