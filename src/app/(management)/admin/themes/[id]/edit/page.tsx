import { LandingThemeForm } from "@/components/organisms/admin/config/landing-theme-form";
import { getLandingTheme } from "@/lib/db/landingThemes";
import { landingThemeToFormValues } from "@/lib/landing-themes/form-values";
import { requirePagePermission } from "@/lib/page-auth";
import { notFound } from "next/navigation";

/**
 * Edición de tema del landing como página (milestone 14: antes era un diálogo). La fila se
 * convierte a valores serializables (sin BigInt) antes de pasarla al formulario cliente.
 */
export default async function EditLandingThemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("landing-themes:manage");
  const { id } = await params;
  const theme = await getLandingTheme(id);
  if (!theme) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Editar tema
        </h1>
        <p className="text-gray-600 dark:text-gray-300">{theme.name}</p>
      </div>
      <LandingThemeForm
        themeId={theme.id}
        defaultValues={landingThemeToFormValues(theme)}
      />
    </div>
  );
}
