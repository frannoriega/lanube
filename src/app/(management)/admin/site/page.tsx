import { SiteConfigManager } from "@/components/organisms/admin/config/site-config-manager";
import { requirePagePermission } from "@/lib/page-auth";

export default async function SitePage() {
  await requirePagePermission("site-config:manage");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Contacto
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Administra la información de contacto pública del sitio.
        </p>
      </div>
      <SiteConfigManager />
    </div>
  );
}
