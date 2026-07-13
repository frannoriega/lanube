"use client";

import type { Session } from "next-auth";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

/**
 * In the `(management)` tree the session is resolved server-side (layout) and passed
 * down so the client never issues the initial `/api/auth/session` fetch. In the public
 * tree it is omitted — pages stay static and the client fetches the session lazily
 * (only the header's sign-in state depends on it).
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
