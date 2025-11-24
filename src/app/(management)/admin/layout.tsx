import UserProvider from "@/components/providers/user";
import ManagementLayout from "@/components/templates/management";
import { auth } from "@/lib/auth";
import { UserRole } from "@prisma/client";
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
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="la-nube-theme"
    >
      <UserProvider userId={session.userId}>
        <ManagementLayout userType="admin">{children}</ManagementLayout>
      </UserProvider>
    </ThemeProvider>
  );
}
