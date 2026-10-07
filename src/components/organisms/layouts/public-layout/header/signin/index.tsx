"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import Link from "next/link";

/**
 * «Iniciar sesión» / «Ir a mi perfil» del encabezado público.
 *
 * Desde el milestone 25 (P2) el sitio público es estático y la sesión se resuelve en el
 * navegador (`SessionProvider` sin `session` en `(public)/layout.tsx`), así que hay un instante
 * con `status === "loading"`. Ahí se reserva el lugar del botón sin mostrarlo: mostrar «Iniciar
 * sesión» a alguien que ya ingresó y cambiarlo enseguida era un parpadeo que antes no existía.
 * `invisible` (visibility: hidden) también lo saca del orden de tabulación.
 */
export default function SignIn() {
  const { status } = useSession();
  const loading = status === "loading";
  return (
    <div
      className={cn("flex flex-col items-center", loading && "invisible")}
      aria-hidden={loading || undefined}
    >
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
