"use client";
import { RegisteredUser } from "@prisma/client";
import { createContext, useEffect, useState } from "react";

export const UserContext = createContext<RegisteredUser | null>(null);

export default function UserProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string;
}) {
  const [user, setUser] = useState<RegisteredUser | null>(null);

  const fetchUser = async () => {
    const response = await fetch(`/api/session`);
    if (!response.ok) {
      return <div>Error al obtener el usuario</div>;
    }
    const user = await response.json();
    if (!user) {
      return <div>Usuario no encontrado</div>;
    }
    setUser(user);
  };

  useEffect(() => {
    fetchUser();
  }, [userId]);

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}
