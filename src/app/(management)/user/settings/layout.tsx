import { SettingsNav } from "@/components/organisms/settings/settings-nav";
import { SettingsRequestsProvider } from "@/components/organisms/settings/settings-requests-context";

/**
 * Marco de "Configuración" (milestone 17): título, navegación de secciones y la sección
 * activa. Cada sección es su propia ruta (`/user/settings/<sección>`), así el botón Atrás,
 * los breadcrumbs y los links directos funcionan sin estado en el cliente.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">
          Tu perfil, tus datos verificados y cómo entrás a La Nube.
        </p>
      </header>
      <SettingsRequestsProvider>
        <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <SettingsNav />
          <div className="min-w-0 max-w-3xl space-y-6">{children}</div>
        </div>
      </SettingsRequestsProvider>
    </div>
  );
}
