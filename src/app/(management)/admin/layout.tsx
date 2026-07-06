import UserProvider from "@/components/providers/user";
import ManagementLayout from "@/components/templates/management";
import { auth } from "@/lib/auth";
import { getRegisteredUserById } from "@/lib/db/users";
import { serializeJson } from "@/lib/json-bigint";
import { UserRole, type RegisteredUser } from "@/types/prisma";
import { ThemeProvider } from "next-themes";
import { redirect } from "next/navigation";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();
  if (!session?.userId) {
    redirect("/auth/signin");
  }
  if (session.role !== UserRole.ADMIN) {
    redirect("/user/dashboard");
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
        <ManagementLayout userType="admin">{children}</ManagementLayout>
      </UserProvider>
    </ThemeProvider>
  );
}
