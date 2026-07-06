import UserProvider from "@/components/providers/user";
import ManagementLayout from "@/components/templates/management";
import { auth } from "@/lib/auth";
import { getRegisteredUserById } from "@/lib/db/users";
import { serializeJson } from "@/lib/json-bigint";
import type { RegisteredUser } from "@/types/prisma";
import { ThemeProvider } from "next-themes";
import { redirect } from "next/navigation";

interface UserLayoutProps {
  children: React.ReactNode;
}

export default async function UserLayout({ children }: UserLayoutProps) {
  const session = await auth();
  if (!session?.userId) {
    redirect("/auth/signin");
  }
  const registeredUser = await getRegisteredUserById(session.userId);
  if (!registeredUser) {
    redirect("/auth/signup");
  }
  // serializeJson turns BigInt timestamps into numbers, matching the client type
  const user = serializeJson(registeredUser) as unknown as RegisteredUser;
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="la-nube-theme"
    >
      <UserProvider user={user}>
        <ManagementLayout userType="user">{children}</ManagementLayout>
      </UserProvider>
    </ThemeProvider>
  );
}
