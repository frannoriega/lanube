"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";
import Link from "next/link";

/**
 * «Iniciar sesión» / «Ir a mi perfil» del encabezado público.
 *
 * Desde el milestone 25 (P2) el sitio público es estático y la sesión se resuelve en el
 * navegador (`SessionProvider` sin `session` en `(public)/layout.tsx`), así que hay un instante
 * con `status === "loading"`. Ahí se dibuja un esqueleto pulsante con el tamaño del botón:
 * mostrar «Iniciar sesión» a alguien que ya ingresó y cambiarlo enseguida era un parpadeo, y
 * dejar el hueco vacío hacía que el botón pareciera tardar en aparecer. El esqueleto reserva
 * el lugar (sin saltos de layout) y avisa que algo está cargando.
 */
export default function SignIn() {
  const { status } = useSession();
  if (status === "loading") {
    return (
      <Skeleton
        className="h-9 w-32 rounded-full"
        role="status"
        aria-label="Cargando sesión"
      />
    );
  }
  return (
    <div className="flex flex-col items-center">
      {status === "authenticated" ? (
        <Link href="/user/dashboard" className="rounded-full">
          <Button variant="brand" className="rounded-full">
            Ir a mi perfil
          </Button>
        </Link>
      ) : (
        <Link href="/auth/signin" className="lg:rounded-full">
          <Button variant="brand" className="lg:rounded-full">
            Iniciar sesión
          </Button>
        </Link>
      )}
    </div>
  );
}
