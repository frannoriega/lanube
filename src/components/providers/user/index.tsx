"use client";

import { type PermissionSet } from "@/lib/rbac";
import { RegisteredUser } from "@/types/prisma";
import { createContext } from "react";

/**
 * The current user as client components see them. Since milestone 9 roles are data, so the
 * *resolved* permission set travels with the user rather than being derivable from a role
 * name — client code calls `hasPermission(user, "…")` directly on this object.
 */
export type CurrentUser = RegisteredUser & PermissionSet;

export const UserContext = createContext<CurrentUser | null>(null);

/**
 * Receives the registered user resolved server-side by the user/admin
 * layouts — no client-side `/api/session` fetch.
 */
export default function UserProvider({
  children,
  user,
}: {
  children: React.ReactNode;
  user: CurrentUser;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}
