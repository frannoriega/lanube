"use client";

import WhatsApp from "@/components/atoms/icons/whatsapp";
import { usePathname } from "next/navigation";

/**
 * Prefijos del área de management (panel de usuario y de administración) donde el botón
 * NO se muestra. Milestone 14, hallazgo I: es un canal de contacto del sitio público, y
 * dentro del área logueada en un teléfono tapaba campos de formularios (el editor de
 * "Resumen" del evento, los inputs de configuración) y filas de tablas, sin aportar nada a
 * quien ya está trabajando dentro de la app.
 */
// `/policies/accept` (milestone 19): la pantalla del gate tiene una sola acción; el botón
// flotante tapaba el diff en celulares.
const HIDDEN_PREFIXES = ["/admin", "/user", "/policies/accept"];

/**
 * Global floating WhatsApp button (bottom-right, public pages). Opens a wa.me chat to the
 * site's own contact number — same source as the footer (`site_config.phoneClickable`) so
 * there is only one place to update it. wa.me wants just digits, no "+" or spaces.
 *
 * Es client component solo para leer la ruta actual (`usePathname`) y ocultarse en el área
 * de management; sigue montado una única vez desde el layout raíz.
 */
export function WhatsAppFloatButton({
  phoneClickable,
}: {
  phoneClickable: string;
}) {
  const pathname = usePathname();
  const digits = phoneClickable.replace(/\D/g, "");
  if (!digits) return null;
  if (
    HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  )
    return null;

  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir chat de WhatsApp con La Nube"
      className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-la-nube-selected sm:bottom-6 sm:right-6"
    >
      <WhatsApp size={28} />
    </a>
  );
}
