import { requirePagePermission } from "@/lib/page-auth";

/**
 * Guarda de la sección «Usuarios»: exige `users:manage` en el servidor, no solo el `admin:access`
 * del middleware (arreglo de seguridad del 2026-11-17, ver `admin-page-guards.test.ts`). Las
 * páginas de la sección pueden ser componentes de cliente: el layout las cubre a todas.
 */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePagePermission("users:manage");
  return children;
}
