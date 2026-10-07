"use client";

import type { Session } from "next-auth";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

/**
 * Contexto de sesión de NextAuth para los client components.
 *
 * - En el área logueada (`(management)/layout.tsx`) recibe la sesión resuelta en el servidor,
 *   así el cliente no hace el `/api/auth/session` inicial.
 * - En el sitio público (`(public)/layout.tsx`) se monta **sin** `session` (`undefined`): la
 *   página es estática/ISR y no puede leer la cookie en el servidor (milestone 25, P2), así que
 *   la sesión se pide desde el navegador. Para un visitante anónimo ese pedido no toca la base
 *   (sin cookie no corre el callback `jwt()`). Ojo: `null` NO es lo mismo — significa «sé que no
 *   hay sesión» y no la pide nunca.
 */
export function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return (
    <NextAuthSessionProvider session={session} refetchOnWindowFocus={false}>
      {children}
    </NextAuthSessionProvider>
  );
}
