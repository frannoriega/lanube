import UserProvider from "@/components/providers/user";
import ManagementLayout from "@/components/templates/management";
import { auth } from "@/lib/auth";
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
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="la-nube-theme"
    >
      <UserProvider userId={session.userId}>
        <ManagementLayout userType="user">{children}</ManagementLayout>
      </UserProvider>
    </ThemeProvider>
  );
}
