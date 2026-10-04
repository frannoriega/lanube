"use client";

import { cn } from "@/lib/utils";
import {
  CircleUser,
  IdCard,
  KeyRound,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettingsRequests } from "./settings-requests-context";

/**
 * Secciones de "Configuración" (milestone 17). Antes era una sola pantalla con dos tarjetas
 * (datos personales + cuenta); ahora cada tema tiene su página, con una URL propia que se
 * puede compartir ("andá a Configuración → Seguridad").
 *
 * El orden va de lo que más se usa a lo que menos: el perfil, los datos que solo cambian con
 * aprobación, cómo entrás, y los datos fijos de la cuenta.
 */
export const SETTINGS_SECTIONS: ReadonlyArray<{
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    href: "/user/settings/profile",
    title: "Perfil",
    description: "Nombre e institución",
    icon: UserRound,
  },
  {
    href: "/user/settings/identity",
    title: "Identidad",
    description: "DNI y motivo para unirte",
    icon: IdCard,
  },
  {
    href: "/user/settings/security",
    title: "Seguridad",
    description: "Passkeys, recuperación y asistentes",
    icon: KeyRound,
  },
  {
    href: "/user/settings/account",
    title: "Cuenta",
    description: "Email, rol, alta y políticas",
    icon: CircleUser,
  },
];

/**
 * Navegación de secciones. Desde `lg` es una columna a la izquierda (título + una línea de
 * qué hay adentro); en pantallas chicas, una fila de pestañas que se desliza de costado
 * (la única excepción a "sin scroll horizontal": es una fila de chips, no la página).
 *
 * Marca "Identidad" con un punto cuando hay una solicitud de cambio esperando a un admin,
 * así se ve desde cualquier sección.
 */
export function SettingsNav() {
  const pathname = usePathname();
  const { data: requests } = useSettingsRequests();
  const hasPending = (requests ?? []).some((r) => r.status === "PENDING");

  return (
    <nav aria-label="Secciones de configuración" className="min-w-0">
      {/* Teléfono y tablet: pestañas deslizables. */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
        {SETTINGS_SECTIONS.map((section) => {
          const active = pathname.startsWith(section.href);
          const Icon = section.icon;
          return (
            <li key={section.href} className="shrink-0">
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-transparent bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {section.title}
                {section.href.endsWith("/identity") && hasPending ? (
                  <PendingDot label="Solicitud pendiente" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Escritorio: columna con descripción. */}
      <ul className="hidden space-y-1 lg:sticky lg:top-20 lg:block">
        {SETTINGS_SECTIONS.map((section) => {
          const active = pathname.startsWith(section.href);
          const Icon = section.icon;
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    active &&
                      "text-la-nube-selected dark:text-la-nube-secondary",
                  )}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {section.title}
                    {section.href.endsWith("/identity") && hasPending ? (
                      <PendingDot label="Solicitud pendiente" />
                    ) : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {section.description}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function PendingDot({ label }: { label: string }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full bg-amber-500"
      role="img"
      aria-label={label}
      title={label}
    />
  );
}
