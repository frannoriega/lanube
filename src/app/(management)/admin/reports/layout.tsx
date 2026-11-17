import { requirePagePermission } from "@/lib/page-auth";
// Estilos de impresión de toda la sección: la página general y la de cada evento.
import "./print.css";

/**
 * Guarda de la sección «Reportes»: exige `reports:view` en el servidor, no solo el `admin:access`
 * del middleware (arreglo de seguridad del 2026-11-17, ver `admin-page-guards.test.ts`). Las
 * páginas de la sección pueden ser componentes de cliente: el layout las cubre a todas.
 */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePagePermission("reports:view");
  return children;
}
