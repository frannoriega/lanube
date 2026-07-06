"use client";

import { RegisteredUser } from "@/types/prisma";
import { createContext } from "react";

export const UserContext = createContext<RegisteredUser | null>(null);

/**
 * Receives the registered user resolved server-side by the user/admin
 * layouts — no client-side `/api/session` fetch.
 */
export default function UserProvider({
  children,
  user,
}: {
  children: React.ReactNode;
  user: RegisteredUser;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}
