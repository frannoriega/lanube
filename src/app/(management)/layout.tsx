import { ServerTimeProvider } from "@/components/providers/server-time";
import { SessionProvider } from "@/components/providers/session";
import { auth } from "@/lib/auth";
import { nowMs } from "@/lib/clock";
import { connection } from "next/server";

/**
 * Lo que el área logueada (ingreso, panel de usuario y de administración, baneo) necesita del
 * pedido, que antes vivía en el layout raíz y volvía dinámico todo el sitio (milestone 25, P2):
 *
 * - `ServerTimeProvider`: alinea el reloj del navegador con el del servidor (libfaketime en
 *   dev). Todos sus consumidores (calendario de reservas, panel de reservas, check-in,
 *   reportes, formulario de eventos, magic link, baneo) están bajo este grupo.
 * - La sesión resuelta en el servidor, para que el cliente no la pida de nuevo.
 *
 * Esta área es dinámica de todos modos (lee la cookie de sesión).
 */
export default async function ManagementGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const serverNowMs = nowMs();
  const session = await auth();
  return (
    <ServerTimeProvider serverNowMs={serverNowMs}>
      <SessionProvider session={session}>{children}</SessionProvider>
    </ServerTimeProvider>
  );
}
