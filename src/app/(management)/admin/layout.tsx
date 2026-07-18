import UserProvider from "@/components/providers/user";
import ManagementLayout from "@/components/templates/management";
import { getThemeStorageKey } from "@/config";
import { auth } from "@/lib/auth";
import { getRegisteredUserById } from "@/lib/db/users";
import { serializeJson } from "@/lib/json-bigint";
import { isAdminRole } from "@/lib/rbac";
import { type RegisteredUser } from "@/types/prisma";
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
  const registeredUser = await getRegisteredUserById(session.userId);
  if (!registeredUser) {
    redirect("/auth/signup");
  }
  // Check the DB role (not the JWT) so a demotion applies immediately.
  if (!isAdminRole(registeredUser.role)) {
    redirect("/user/dashboard");
  }
  // serializeJson turns BigInt timestamps into numbers, matching the client type
  const user = serializeJson(registeredUser) as unknown as RegisteredUser;
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={getThemeStorageKey()}
    >
      <UserProvider user={user}>
        <ManagementLayout userType="admin">{children}</ManagementLayout>
      </UserProvider>
    </ThemeProvider>
  );
}
